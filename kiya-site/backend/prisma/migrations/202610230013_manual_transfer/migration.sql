ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_status_check";
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_status_check" CHECK(status IN ('RESERVED','EXPIRED','CANCELLED','PAID'));
CREATE TABLE "ManualPayment"(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"orderId" UUID NOT NULL UNIQUE REFERENCES "PurchaseOrder"(id) ON DELETE RESTRICT,"userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,"amountToman" DECIMAL(14,0) NOT NULL CHECK("amountToman">0),"shippingToman" DECIMAL(14,0) NOT NULL CHECK("shippingToman">=0),"taxToman" DECIMAL(14,0) NOT NULL CHECK("taxToman">=0),destination JSONB NOT NULL,"shippingAddress" JSONB NOT NULL,status VARCHAR(24) NOT NULL DEFAULT 'AWAITING_TRANSFER' CHECK(status IN ('AWAITING_TRANSFER','UNDER_REVIEW','REJECTED','CONFIRMED')),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),"imageHash" VARCHAR(64) UNIQUE,"transferReference" VARCHAR(80),"submittedAt" TIMESTAMPTZ(3),"reviewerId" UUID REFERENCES "User"(id),"reviewReason" VARCHAR(500),"reviewedAt" TIMESTAMPTZ(3),"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(), CHECK("reviewerId" IS NULL OR "reviewerId"<>"userId"),CHECK(status<>'CONFIRMED' OR ("reviewerId" IS NOT NULL AND "imageHash" IS NOT NULL AND "reviewReason" IS NOT NULL)));
CREATE FUNCTION kiya_manual_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ord "PurchaseOrder"%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payment history is immutable'; END IF;
 IF TG_OP='INSERT' THEN
  SELECT * INTO STRICT ord FROM "PurchaseOrder" WHERE id=NEW."orderId";
  IF NEW."userId"<>ord."userId" OR NEW."amountToman"<>ord."subtotalToman"+NEW."shippingToman"+NEW."taxToman" THEN RAISE EXCEPTION 'Payment snapshot mismatch'; END IF;
 ELSE
  IF OLD.status='CONFIRMED' OR NEW.version<>OLD.version+1 OR ROW(NEW.id,NEW."orderId",NEW."userId",NEW."amountToman",NEW."shippingToman",NEW."taxToman",NEW.destination,NEW."shippingAddress",NEW."createdAt") IS DISTINCT FROM ROW(OLD.id,OLD."orderId",OLD."userId",OLD."amountToman",OLD."shippingToman",OLD."taxToman",OLD.destination,OLD."shippingAddress",OLD."createdAt") THEN RAISE EXCEPTION 'Payment snapshot is immutable'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER manual_payment_guard BEFORE INSERT OR UPDATE OR DELETE ON "ManualPayment" FOR EACH ROW EXECUTE FUNCTION kiya_manual_guard();
CREATE OR REPLACE FUNCTION kiya_order_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Order history is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.status<>'RESERVED' OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Invalid order transition' USING ERRCODE='23514'; END IF;
  IF NEW.status='RESERVED' THEN
   IF NEW."reservedUntil"<=OLD."reservedUntil" OR (to_jsonb(NEW)-ARRAY['version','reservedUntil']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['version','reservedUntil']) OR NOT EXISTS(SELECT 1 FROM "ManualPayment" WHERE "orderId"=OLD.id) THEN RAISE EXCEPTION 'Invalid payment deadline extension' USING ERRCODE='23514'; END IF;
  ELSE
   IF NEW.status NOT IN ('CANCELLED','EXPIRED','PAID') OR (to_jsonb(NEW)-ARRAY['status','version','endedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version','endedAt']) OR (NEW.status='EXPIRED' AND OLD."reservedUntil">clock_timestamp()) OR (NEW.status='PAID' AND NOT EXISTS(SELECT 1 FROM "ManualPayment" WHERE "orderId"=OLD.id AND status='CONFIRMED')) THEN RAISE EXCEPTION 'Invalid order transition or immutable snapshot' USING ERRCODE='23514'; END IF;
  END IF;
 END IF;RETURN NEW;
END $$;
CREATE FUNCTION kiya_capture_manual(target UUID,actor UUID) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE ord "PurchaseOrder"%ROWTYPE; hold RECORD; v "ProductVariant"%ROWTYPE;
BEGIN
 SELECT * INTO STRICT ord FROM "PurchaseOrder" WHERE id=target FOR UPDATE;
 IF ord.status='PAID' THEN RETURN false; END IF;
 IF ord.status<>'RESERVED' OR ord."reservedUntil"<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM "ManualPayment" WHERE "orderId"=target AND status='CONFIRMED' AND "reviewerId"=actor AND "userId"<>actor) THEN RAISE EXCEPTION 'Payment cannot be captured'; END IF;
 FOR hold IN SELECT * FROM "OrderHold" WHERE "orderId"=target ORDER BY "variantId" LOOP
  SELECT * INTO STRICT v FROM "ProductVariant" WHERE id=hold."variantId" FOR UPDATE;
  IF v.reserved<hold.units OR v.stock<hold.units THEN RAISE EXCEPTION 'Inventory consistency failure'; END IF;
  UPDATE "ProductVariant" SET stock=stock-hold.units,reserved=reserved-hold.units,version=version+1 WHERE id=v.id;
  INSERT INTO "ReservationMovement"("orderId","variantId",kind,delta,"reservedAfter","beforeVersion","versionAfter") VALUES(target,v.id,'RELEASE',-hold.units,v.reserved-hold.units,v.version,v.version+1);
  INSERT INTO "InventoryMovement"("id","variantId","actorId","requestId",delta,reason,"stockAfter","beforeVersion","versionAfter") VALUES(gen_random_uuid(),v.id,actor,gen_random_uuid(),-hold.units,'manual-payment-capture',v.stock-hold.units,v.version,v.version+1);
 END LOOP;
 UPDATE "PurchaseOrder" SET status='PAID',version=version+1,"endedAt"=clock_timestamp() WHERE id=target;
 RETURN true;
END $$;
CREATE FUNCTION kiya_payment_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target UUID;
BEGIN
 target=CASE WHEN TG_TABLE_NAME='PurchaseOrder' THEN NEW.id ELSE NEW."orderId" END;
 IF EXISTS(SELECT 1 FROM "ManualPayment" p JOIN "PurchaseOrder" o ON o.id=p."orderId" WHERE o.id=target AND ((p.status='CONFIRMED')<>(o.status='PAID'))) THEN RAISE EXCEPTION 'Paid order/payment do not reconcile'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER payment_consistent AFTER INSERT OR UPDATE ON "ManualPayment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION kiya_payment_consistency();
CREATE CONSTRAINT TRIGGER paid_order_consistent AFTER INSERT OR UPDATE ON "PurchaseOrder" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION kiya_payment_consistency();
