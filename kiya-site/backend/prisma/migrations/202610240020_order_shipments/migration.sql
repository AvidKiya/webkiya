CREATE TABLE "OrderShipment" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "orderId" uuid NOT NULL UNIQUE REFERENCES "PurchaseOrder"(id) ON DELETE RESTRICT,
 status varchar(12) NOT NULL DEFAULT 'PREPARING', version integer NOT NULL DEFAULT 1 CHECK(version>0),
 carrier varchar(80) NOT NULL DEFAULT '', "trackingCode" varchar(80) NOT NULL DEFAULT '',
 "createdAt" timestamptz(3) NOT NULL DEFAULT now(), "updatedAt" timestamptz(3) NOT NULL DEFAULT now(),
 "shippedAt" timestamptz(3), "deliveredAt" timestamptz(3),
 CHECK((status='PREPARING' AND carrier='' AND "trackingCode"='' AND "shippedAt" IS NULL AND "deliveredAt" IS NULL)
 OR(status='SHIPPED' AND length(trim(carrier))>=2 AND "trackingCode"~'^[A-Za-z0-9][A-Za-z0-9/-]{3,79}$' AND "shippedAt" IS NOT NULL AND "deliveredAt" IS NULL)
 OR(status='DELIVERED' AND length(trim(carrier))>=2 AND "trackingCode"~'^[A-Za-z0-9][A-Za-z0-9/-]{3,79}$' AND "shippedAt" IS NOT NULL AND "deliveredAt" IS NOT NULL AND "deliveredAt">="shippedAt"))
);
CREATE INDEX "OrderShipment_status_createdAt_idx" ON "OrderShipment"(status,"createdAt");
CREATE FUNCTION kiya_guard_shipment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Shipment history cannot be deleted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PurchaseOrder" o JOIN "ManualPayment" p ON p."orderId"=o.id WHERE o.id=NEW."orderId" AND o.status='PAID' AND p.status='PAID') THEN RAISE EXCEPTION 'Confirmed payment required'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'PREPARING' OR NEW.version<>1 THEN RAISE EXCEPTION 'Shipment must begin in preparation'; END IF;
 ELSE
  IF NEW.id<>OLD.id OR NEW."orderId"<>OLD."orderId" OR NEW."createdAt"<>OLD."createdAt" OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Immutable shipment identity/version'; END IF;
  IF NOT ((OLD.status='PREPARING' AND NEW.status='SHIPPED') OR (OLD.status='SHIPPED' AND NEW.status='DELIVERED')) THEN RAISE EXCEPTION 'Invalid shipment transition'; END IF;
  IF OLD.status='SHIPPED' AND (NEW.carrier<>OLD.carrier OR NEW."trackingCode"<>OLD."trackingCode" OR NEW."shippedAt"<>OLD."shippedAt") THEN RAISE EXCEPTION 'Dispatch proof is immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shipment_guard BEFORE INSERT OR UPDATE OR DELETE ON "OrderShipment" FOR EACH ROW EXECUTE FUNCTION kiya_guard_shipment();
UPDATE "Role" SET permissions=array_append(array_append(array_remove(array_remove(permissions,'order:read'),'order:manage'),'order:read'),'order:manage'),version=version+1 WHERE key='OWNER';
UPDATE "User" SET "permissionVersion"="permissionVersion"+1 WHERE id IN (SELECT ur."userId" FROM "UserRole" ur JOIN "Role" r ON r.id=ur."roleId" WHERE r.key='OWNER');
