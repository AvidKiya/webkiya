ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_id_productId_key" UNIQUE ("id","productId");
CREATE TABLE "PackDefinition" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "productId" VARCHAR(80) NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT,
 "label" VARCHAR(80) NOT NULL, "mode" VARCHAR(24) NOT NULL CHECK("mode" IN ('FIXED_ASSORTMENT','HOMOGENEOUS')),
 "unitsPerPack" INTEGER NOT NULL CHECK("unitsPerPack">0 AND "unitsPerPack"<=10000),
 "status" VARCHAR(12) NOT NULL DEFAULT 'DRAFT' CHECK("status" IN ('DRAFT','ACTIVE','ARCHIVED')),
 "version" INTEGER NOT NULL DEFAULT 1 CHECK("version">0), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 UNIQUE("id","productId")
);
CREATE INDEX "PackDefinition_productId_status_idx" ON "PackDefinition"("productId","status");
CREATE TABLE "PackComponent" (
 "packId" UUID NOT NULL, "productId" VARCHAR(80) NOT NULL, "variantId" UUID NOT NULL,
 "units" INTEGER NOT NULL CHECK("units">0 AND "units"<=10000), PRIMARY KEY("packId","variantId"),
 FOREIGN KEY("packId","productId") REFERENCES "PackDefinition"("id","productId") ON DELETE RESTRICT,
 FOREIGN KEY("variantId","productId") REFERENCES "ProductVariant"("id","productId") ON DELETE RESTRICT
);
CREATE INDEX "PackComponent_variantId_idx" ON "PackComponent"("variantId");
-- The final transaction state of active BOMs must be internally consistent.
CREATE FUNCTION kiya_check_pack_bom() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target UUID; p "PackDefinition"%ROWTYPE; total BIGINT; count_rows INTEGER; bad INTEGER;
BEGIN
 IF TG_TABLE_NAME='PackDefinition' THEN target=NEW.id;
 ELSIF TG_OP='DELETE' THEN target=OLD."packId";
 ELSE target=NEW."packId"; END IF;
 SELECT * INTO p FROM "PackDefinition" WHERE id=target;
 IF FOUND AND p.status='ACTIVE' THEN
 SELECT COALESCE(sum(c.units),0),count(*),count(*) FILTER(WHERE NOT v."isActive") INTO total,count_rows,bad FROM "PackComponent" c JOIN "ProductVariant" v ON v.id=c."variantId" WHERE c."packId"=target;
 IF total<>p."unitsPerPack" OR count_rows=0 OR count_rows>30 OR bad>0 OR (p.mode='HOMOGENEOUS' AND count_rows<>1) THEN RAISE EXCEPTION 'Invalid active pack BOM' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER pack_bom_valid AFTER INSERT OR UPDATE ON "PackDefinition" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION kiya_check_pack_bom();
CREATE CONSTRAINT TRIGGER pack_component_bom_valid AFTER INSERT OR UPDATE OR DELETE ON "PackComponent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION kiya_check_pack_bom();
UPDATE "Role" SET permissions=array_append(permissions,'wholesale:pack:manage') WHERE key='OWNER' AND NOT('wholesale:pack:manage'=ANY(permissions));
UPDATE "Role" SET permissions=array_append(permissions,'wholesale:pack:publish') WHERE key='OWNER' AND NOT('wholesale:pack:publish'=ANY(permissions));
