-- Admin order processing for initial orders.
-- Reservation lifecycle: RESERVED -> CONFIRMED (stock consumed) -> PREPARING -> SHIPPED -> COMPLETED.
-- CANCELLED/EXPIRED remain release-only closes; no payment or shipping carrier is implied.
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_status_check";
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_status_check"
 CHECK (status IN ('RESERVED','CONFIRMED','PREPARING','SHIPPED','COMPLETED','CANCELLED','EXPIRED'));
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_check1";
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_check1"
 CHECK (("endedAt" IS NULL) = (status IN ('RESERVED','CONFIRMED','PREPARING','SHIPPED')));
CREATE TABLE "OrderEvent" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 "orderId" UUID NOT NULL REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT,
 "actorId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "fromStatus" VARCHAR(12) NOT NULL, "toStatus" VARCHAR(12) NOT NULL,
 "reason" VARCHAR(500) NOT NULL CHECK (char_length(btrim("reason"))>=3),
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId","createdAt");
CREATE TRIGGER order_event_immutable BEFORE UPDATE OR DELETE ON "OrderEvent" FOR EACH ROW EXECUTE FUNCTION kiya_audit_immutable();
-- Only the documented forward chain is valid; snapshots and money stay immutable.
CREATE OR REPLACE FUNCTION kiya_order_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Order history is immutable' USING ERRCODE='23514'; END IF;
 IF OLD.status IN ('CANCELLED','EXPIRED','COMPLETED') THEN
  RAISE EXCEPTION 'Closed orders are immutable' USING ERRCODE='23514';
 END IF;
 IF NEW.version<>OLD.version+1 OR
  (to_jsonb(NEW)-ARRAY['status','version','endedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version','endedAt'])
 THEN RAISE EXCEPTION 'Invalid order transition or immutable snapshot' USING ERRCODE='23514'; END IF;
 IF NOT (
  (OLD.status='RESERVED' AND NEW.status IN ('CONFIRMED','CANCELLED','EXPIRED')) OR
  (OLD.status='CONFIRMED' AND NEW.status IN ('PREPARING','SHIPPED','COMPLETED')) OR
  (OLD.status='PREPARING' AND NEW.status IN ('SHIPPED','COMPLETED')) OR
  (OLD.status='SHIPPED' AND NEW.status='COMPLETED')
 ) THEN RAISE EXCEPTION 'Invalid order transition' USING ERRCODE='23514'; END IF;
 IF NEW.status='EXPIRED' AND OLD."reservedUntil">clock_timestamp() THEN
  RAISE EXCEPTION 'Only time-expired holds can expire' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
-- Confirmation consumes the hold: stock and reserved both drop, the reservation is
-- released once in the ledger, and the existing consistency trigger reconciles it.
CREATE FUNCTION kiya_confirm_order(target UUID, actor UUID, note TEXT) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE ord "PurchaseOrder"%ROWTYPE; hold RECORD; v "ProductVariant"%ROWTYPE; after_stock INTEGER;
BEGIN
 IF note IS NULL OR char_length(btrim(note))<3 THEN RAISE EXCEPTION 'Confirmation reason required' USING ERRCODE='23514'; END IF;
 SELECT * INTO ord FROM "PurchaseOrder" WHERE id=target FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF ord.status<>'RESERVED' THEN RAISE EXCEPTION 'Order is not reserved' USING ERRCODE='23514'; END IF;
 IF ord."reservedUntil"<=clock_timestamp() THEN RAISE EXCEPTION 'Reservation has expired' USING ERRCODE='23514'; END IF;
 FOR hold IN SELECT * FROM "OrderHold" WHERE "orderId"=target ORDER BY "variantId" LOOP
  SELECT * INTO STRICT v FROM "ProductVariant" WHERE id=hold."variantId" FOR UPDATE;
  IF v.stock<hold.units OR v.reserved<hold.units THEN
   RAISE EXCEPTION 'Insufficient stock for fulfilment' USING ERRCODE='23514';
  END IF;
  after_stock := v.stock-hold.units;
  UPDATE "ProductVariant" SET stock=after_stock, reserved=reserved-hold.units, version=version+1 WHERE id=v.id;
  INSERT INTO "InventoryMovement"("variantId","actorId","requestId",delta,reason,"stockAfter","beforeVersion","versionAfter")
   VALUES(v.id,actor,gen_random_uuid(),-hold.units,'ORDER_CONFIRM:'||target::text,after_stock,v.version,v.version+1);
  INSERT INTO "ReservationMovement"("orderId","variantId",kind,delta,"reservedAfter","beforeVersion","versionAfter")
   VALUES(target,v.id,'RELEASE',-hold.units,v.reserved-hold.units,v.version,v.version+1);
 END LOOP;
 UPDATE "PurchaseOrder" SET status='CONFIRMED',version=version+1 WHERE id=target;
 INSERT INTO "OrderEvent"("orderId","actorId","fromStatus","toStatus",reason) VALUES(target,actor,'RESERVED','CONFIRMED',note);
 INSERT INTO "AuditLog"("actorId",action,"resourceId","data") VALUES(actor,'order:confirm',target::text,jsonb_build_object('version',ord.version+1));
 RETURN true;
END $$;
CREATE FUNCTION kiya_advance_order(target UUID, next TEXT, actor UUID, note TEXT) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE ord "PurchaseOrder"%ROWTYPE;
BEGIN
 IF next NOT IN ('PREPARING','SHIPPED','COMPLETED') THEN RAISE EXCEPTION 'Invalid fulfilment status' USING ERRCODE='23514'; END IF;
 IF note IS NULL OR char_length(btrim(note))<3 THEN RAISE EXCEPTION 'Transition reason required' USING ERRCODE='23514'; END IF;
 SELECT * INTO ord FROM "PurchaseOrder" WHERE id=target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE='23503'; END IF;
 UPDATE "PurchaseOrder" SET status=next,version=version+1,
  "endedAt"=CASE WHEN next='COMPLETED' THEN clock_timestamp() ELSE "endedAt" END WHERE id=target;
 INSERT INTO "OrderEvent"("orderId","actorId","fromStatus","toStatus",reason) VALUES(target,actor,ord.status,next,note);
 INSERT INTO "AuditLog"("actorId",action,"resourceId","data") VALUES(actor,'order:'||lower(next),target::text,jsonb_build_object('from',ord.status,'version',ord.version+1));
 RETURN true;
END $$;
UPDATE "Role" SET permissions=array_append(permissions,'order:read')
 WHERE key IN ('OWNER','SUPPORT') AND NOT ('order:read'=ANY(permissions));
UPDATE "Role" SET permissions=array_append(permissions,'order:manage')
 WHERE key='OWNER' AND NOT ('order:manage'=ANY(permissions));
