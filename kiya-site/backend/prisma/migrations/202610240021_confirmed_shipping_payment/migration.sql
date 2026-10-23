-- ManualPayment terminal status is CONFIRMED; PurchaseOrder terminal payment status is PAID.
CREATE OR REPLACE FUNCTION kiya_guard_shipment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Shipment history cannot be deleted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PurchaseOrder" o JOIN "ManualPayment" p ON p."orderId"=o.id WHERE o.id=NEW."orderId" AND o.status='PAID' AND p.status='CONFIRMED') THEN RAISE EXCEPTION 'Confirmed payment required'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'PREPARING' OR NEW.version<>1 THEN RAISE EXCEPTION 'Shipment must begin in preparation'; END IF;
 ELSE
  IF NEW.id<>OLD.id OR NEW."orderId"<>OLD."orderId" OR NEW."createdAt"<>OLD."createdAt" OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Immutable shipment identity/version'; END IF;
  IF NOT ((OLD.status='PREPARING' AND NEW.status='SHIPPED') OR (OLD.status='SHIPPED' AND NEW.status='DELIVERED')) THEN RAISE EXCEPTION 'Invalid shipment transition'; END IF;
  IF OLD.status='SHIPPED' AND (NEW.carrier<>OLD.carrier OR NEW."trackingCode"<>OLD."trackingCode" OR NEW."shippedAt"<>OLD."shippedAt") THEN RAISE EXCEPTION 'Dispatch proof is immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
