-- Deferred checks allow atomic hold/ledger/status updates but reject partial writes.
CREATE FUNCTION kiya_order_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target UUID; state TEXT;
BEGIN
 IF TG_TABLE_NAME='PurchaseOrder' THEN target=NEW.id; ELSE target=NEW."orderId"; END IF;
 SELECT status INTO state FROM "PurchaseOrder" WHERE id=target;
 IF NOT EXISTS(SELECT 1 FROM "OrderHold" WHERE "orderId"=target) OR EXISTS(
  SELECT 1 FROM "OrderHold" h
  LEFT JOIN "ReservationMovement" r ON r."orderId"=h."orderId" AND r."variantId"=h."variantId" AND r.kind='RESERVE'
  LEFT JOIN "ReservationMovement" e ON e."orderId"=h."orderId" AND e."variantId"=h."variantId" AND e.kind='RELEASE'
  WHERE h."orderId"=target AND (r.delta IS DISTINCT FROM h.units OR (state='RESERVED' AND e.id IS NOT NULL) OR (state<>'RESERVED' AND e.delta IS DISTINCT FROM -h.units))
 ) OR EXISTS(SELECT 1 FROM "ReservationMovement" m WHERE m."orderId"=target AND NOT EXISTS(SELECT 1 FROM "OrderHold" h WHERE h."orderId"=m."orderId" AND h."variantId"=m."variantId")) THEN
 RAISE EXCEPTION 'Order hold and reservation ledger do not reconcile' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER order_consistent AFTER INSERT OR UPDATE ON "PurchaseOrder" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION kiya_order_consistency();
CREATE CONSTRAINT TRIGGER hold_consistent AFTER INSERT ON "OrderHold" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION kiya_order_consistency();
CREATE CONSTRAINT TRIGGER reservation_consistent AFTER INSERT ON "ReservationMovement" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION kiya_order_consistency();
CREATE FUNCTION kiya_reserved_floor() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actual INTEGER; managed BIGINT;
BEGIN
 SELECT reserved INTO actual FROM "ProductVariant" WHERE id=NEW.id;
 SELECT coalesce(sum(h.units),0) INTO managed FROM "OrderHold" h JOIN "PurchaseOrder" o ON o.id=h."orderId" WHERE h."variantId"=NEW.id AND o.status='RESERVED';
 IF actual<managed THEN RAISE EXCEPTION 'Reserved inventory below active order holds' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER reserved_floor AFTER INSERT OR UPDATE ON "ProductVariant" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION kiya_reserved_floor();
