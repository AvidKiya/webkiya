CREATE OR REPLACE FUNCTION kiya_capture_manual(target UUID,actor UUID) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
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
  INSERT INTO "InventoryMovement"("id","variantId","actorId","requestId",delta,reason,"stockAfter","beforeVersion","versionAfter") VALUES(gen_random_uuid(),v.id,actor,gen_random_uuid(),-hold.units,'manual-payment:'||target::text,v.stock-hold.units,v.version,v.version+1);
 END LOOP;
 UPDATE "PurchaseOrder" SET status='PAID',version=version+1,"endedAt"=clock_timestamp() WHERE id=target;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION kiya_payment_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target UUID;
BEGIN
 IF TG_TABLE_NAME='PurchaseOrder' THEN target=NEW.id; ELSE target=NEW."orderId"; END IF;
 IF EXISTS(SELECT 1 FROM "ManualPayment" p JOIN "PurchaseOrder" o ON o.id=p."orderId" WHERE o.id=target AND ((p.status='CONFIRMED')<>(o.status='PAID'))) THEN RAISE EXCEPTION 'Paid order/payment do not reconcile'; END IF;
 IF EXISTS(SELECT 1 FROM "PurchaseOrder" o JOIN "ManualPayment" p ON p."orderId"=o.id JOIN "OrderHold" h ON h."orderId"=o.id WHERE o.id=target AND o.status='PAID' AND NOT EXISTS(SELECT 1 FROM "InventoryMovement" m WHERE m."variantId"=h."variantId" AND m.reason='manual-payment:'||target::text AND m.delta=-h.units AND m."actorId"=p."reviewerId")) THEN RAISE EXCEPTION 'Paid order lacks inventory sale ledger'; END IF;
 RETURN NEW;
END $$;
CREATE UNIQUE INDEX manual_sale_once ON "InventoryMovement"("variantId",reason) WHERE reason LIKE 'manual-payment:%';
CREATE OR REPLACE FUNCTION kiya_manual_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ord "PurchaseOrder"%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payment history is immutable'; END IF;
 IF TG_OP='INSERT' THEN
  SELECT * INTO STRICT ord FROM "PurchaseOrder" WHERE id=NEW."orderId";
  IF NEW.status<>'AWAITING_TRANSFER' OR NEW."imageHash" IS NOT NULL OR NEW."reviewerId" IS NOT NULL OR NEW."userId"<>ord."userId" OR NEW."amountToman"<>ord."subtotalToman"+NEW."shippingToman"+NEW."taxToman" THEN RAISE EXCEPTION 'Payment snapshot mismatch'; END IF;
 ELSE
  IF OLD.status IN ('CONFIRMED','REFUND_REQUIRED') OR NEW.version<>OLD.version+1 OR ROW(NEW.id,NEW."orderId",NEW."userId",NEW."amountToman",NEW."shippingToman",NEW."taxToman",NEW.destination,NEW."shippingAddress",NEW."createdAt") IS DISTINCT FROM ROW(OLD.id,OLD."orderId",OLD."userId",OLD."amountToman",OLD."shippingToman",OLD."taxToman",OLD.destination,OLD."shippingAddress",OLD."createdAt") THEN RAISE EXCEPTION 'Payment snapshot is immutable'; END IF;
  IF (OLD.status IN ('AWAITING_TRANSFER','REJECTED') AND NEW.status<>'UNDER_REVIEW') OR (OLD.status='UNDER_REVIEW' AND NEW.status NOT IN ('CONFIRMED','REJECTED','REFUND_REQUIRED')) THEN RAISE EXCEPTION 'Invalid receipt transition'; END IF;
  IF OLD.status='UNDER_REVIEW' AND ROW(OLD."imageHash",OLD."transferReference",OLD."submittedAt") IS DISTINCT FROM ROW(NEW."imageHash",NEW."transferReference",NEW."submittedAt") THEN RAISE EXCEPTION 'Review cannot replace evidence'; END IF;
 END IF;
 IF NEW.status='UNDER_REVIEW' AND (NEW."imageHash" IS NULL OR NEW."transferReference" IS NULL OR NEW."submittedAt" IS NULL) THEN RAISE EXCEPTION 'Receipt evidence required'; END IF;
 IF NEW.status IN ('CONFIRMED','REFUND_REQUIRED','REJECTED') AND (NEW."reviewReason" IS NULL OR length(NEW."reviewReason")<10 OR NOT EXISTS(SELECT 1 FROM "User" WHERE id=NEW."reviewerId" AND kind='STAFF' AND "isActive")) THEN RAISE EXCEPTION 'Independent staff review required'; END IF;
 RETURN NEW;
END $$;
