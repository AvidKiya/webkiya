CREATE TABLE "PurchaseOrder" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "cartId" UUID NOT NULL REFERENCES "ServerCart"("id") ON DELETE RESTRICT, "cartVersion" INTEGER NOT NULL CHECK("cartVersion">0),
 "mode" VARCHAR(12) NOT NULL CHECK(mode IN ('RETAIL','WHOLESALE')), "requestId" UUID NOT NULL UNIQUE, "digest" VARCHAR(64) NOT NULL,
 "snapshot" JSONB NOT NULL CHECK(jsonb_typeof(snapshot)='object'), "subtotalToman" DECIMAL(14,0) NOT NULL CHECK("subtotalToman">0),
 "status" VARCHAR(12) NOT NULL DEFAULT 'RESERVED' CHECK(status IN ('RESERVED','EXPIRED','CANCELLED')), "version" INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 "reservedUntil" TIMESTAMPTZ(3) NOT NULL, "endedAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 CHECK("reservedUntil">"createdAt"), CHECK((status='RESERVED' AND "endedAt" IS NULL) OR (status<>'RESERVED' AND "endedAt" IS NOT NULL)), UNIQUE("cartId","cartVersion")
);
CREATE INDEX "PurchaseOrder_userId_createdAt_idx" ON "PurchaseOrder"("userId","createdAt");
CREATE INDEX "PurchaseOrder_status_reservedUntil_idx" ON "PurchaseOrder"(status,"reservedUntil");
CREATE TABLE "OrderHold" (
 "orderId" UUID NOT NULL REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT,
 "variantId" UUID NOT NULL REFERENCES "ProductVariant"("id") ON DELETE RESTRICT, "units" INTEGER NOT NULL CHECK(units>0), PRIMARY KEY("orderId","variantId")
);
CREATE INDEX "OrderHold_variantId_idx" ON "OrderHold"("variantId");
CREATE TABLE "ReservationMovement" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "orderId" UUID NOT NULL REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT,
 "variantId" UUID NOT NULL REFERENCES "ProductVariant"("id") ON DELETE RESTRICT, "kind" VARCHAR(12) NOT NULL CHECK(kind IN ('RESERVE','RELEASE')),
 "delta" INTEGER NOT NULL CHECK((kind='RESERVE' AND delta>0) OR (kind='RELEASE' AND delta<0)), "reservedAfter" INTEGER NOT NULL CHECK("reservedAfter">=0),
 "beforeVersion" INTEGER NOT NULL CHECK("beforeVersion">0), "versionAfter" INTEGER NOT NULL CHECK("versionAfter"="beforeVersion"+1),
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(), UNIQUE("orderId","variantId","kind")
);
CREATE TRIGGER hold_immutable BEFORE UPDATE OR DELETE ON "OrderHold" FOR EACH ROW EXECUTE FUNCTION kiya_audit_immutable();
CREATE TRIGGER reservation_movement_immutable BEFORE UPDATE OR DELETE ON "ReservationMovement" FOR EACH ROW EXECUTE FUNCTION kiya_audit_immutable();
CREATE FUNCTION kiya_order_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Order history is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (
  OLD.status<>'RESERVED' OR NEW.status NOT IN ('CANCELLED','EXPIRED') OR NEW.version<>OLD.version+1 OR
  (to_jsonb(NEW)-ARRAY['status','version','endedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version','endedAt']) OR
  (NEW.status='EXPIRED' AND OLD."reservedUntil">clock_timestamp())
 ) THEN RAISE EXCEPTION 'Invalid order transition or immutable snapshot' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_guard BEFORE UPDATE OR DELETE ON "PurchaseOrder" FOR EACH ROW EXECUTE FUNCTION kiya_order_guard();
-- Shared release primitive for HTTP and scheduled maintenance. Locks order first,
-- then SKU IDs sorted; repeated/cross-worker calls can release each hold only once.
CREATE FUNCTION kiya_release_order(target UUID, final_status TEXT, actor UUID DEFAULT NULL) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE ord "PurchaseOrder"%ROWTYPE; hold RECORD; v "ProductVariant"%ROWTYPE;
BEGIN
 IF final_status NOT IN ('EXPIRED','CANCELLED') THEN RAISE EXCEPTION 'Invalid release status'; END IF;
 SELECT * INTO ord FROM "PurchaseOrder" WHERE id=target FOR UPDATE;
 IF NOT FOUND OR ord.status<>'RESERVED' THEN RETURN false; END IF;
 IF final_status='EXPIRED' AND ord."reservedUntil">clock_timestamp() THEN RETURN false; END IF;
 FOR hold IN SELECT * FROM "OrderHold" WHERE "orderId"=target ORDER BY "variantId" LOOP
  SELECT * INTO STRICT v FROM "ProductVariant" WHERE id=hold."variantId" FOR UPDATE;
  IF v.reserved<hold.units THEN RAISE EXCEPTION 'Reservation consistency failure' USING ERRCODE='23514'; END IF;
  UPDATE "ProductVariant" SET reserved=reserved-hold.units,version=version+1 WHERE id=v.id;
  INSERT INTO "ReservationMovement"("orderId","variantId",kind,delta,"reservedAfter","beforeVersion","versionAfter") VALUES(target,v.id,'RELEASE',-hold.units,v.reserved-hold.units,v.version,v.version+1);
 END LOOP;
 UPDATE "PurchaseOrder" SET status=final_status,version=version+1,"endedAt"=clock_timestamp() WHERE id=target;
 INSERT INTO "AuditLog"("actorId",action,"resourceId",data) VALUES(actor,'order:'||lower(final_status),target::text,jsonb_build_object('version',ord.version+1));
 RETURN true;
END $$;
