ALTER TABLE "Product" ADD COLUMN "subtitle" VARCHAR(160) NOT NULL DEFAULT '', ADD COLUMN "category" VARCHAR(80) NOT NULL DEFAULT '', ADD COLUMN "description" VARCHAR(3000) NOT NULL DEFAULT '', ADD COLUMN "imagePath" VARCHAR(160) NOT NULL DEFAULT '', ADD COLUMN "packSize" INTEGER CHECK ("packSize">0 AND "packSize"<=10000), ADD COLUMN "tag" VARCHAR(40) NOT NULL DEFAULT '', ADD COLUMN "collection" VARCHAR(80) NOT NULL DEFAULT '', ADD COLUMN "previousPrice" DECIMAL(14,0), ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 100;
CREATE TABLE "MediaAsset" ("id" VARCHAR(64) PRIMARY KEY, "width" INTEGER NOT NULL CHECK("width">0), "height" INTEGER NOT NULL CHECK("height">0), "bytes" INTEGER NOT NULL CHECK("bytes">0), "createdBy" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now());
CREATE TABLE "ProductVariant" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "productId" VARCHAR(80) NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT,
 "sku" VARCHAR(60) NOT NULL UNIQUE,"name" VARCHAR(60) NOT NULL,"hex" VARCHAR(7) NOT NULL CHECK("hex" ~ '^#[0-9a-fA-F]{6}$'),"isActive" BOOLEAN NOT NULL DEFAULT true,
 "stock" INTEGER NOT NULL DEFAULT 0 CHECK("stock">=0 AND "stock"<=1000000000),"reserved" INTEGER NOT NULL DEFAULT 0 CHECK("reserved">=0 AND "reserved"<="stock"),"version" INTEGER NOT NULL DEFAULT 1 CHECK("version">0),
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(), UNIQUE("productId","name")
);
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId","isActive");
CREATE TABLE "InventoryMovement" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),"variantId" UUID NOT NULL REFERENCES "ProductVariant"("id") ON DELETE RESTRICT,
 "actorId" UUID NOT NULL,"requestId" UUID NOT NULL UNIQUE,"delta" INTEGER NOT NULL CHECK("delta"<>0),"reason" VARCHAR(500) NOT NULL,
 "stockAfter" INTEGER NOT NULL CHECK("stockAfter">=0),"beforeVersion" INTEGER NOT NULL,"versionAfter" INTEGER NOT NULL,"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX "InventoryMovement_variantId_createdAt_idx" ON "InventoryMovement"("variantId","createdAt");
CREATE TRIGGER inventory_append_only BEFORE UPDATE OR DELETE ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION kiya_audit_immutable();
UPDATE "Role" SET "permissions"=array_append("permissions",'product:publish') WHERE "key"='OWNER' AND NOT ('product:publish'=ANY("permissions"));
UPDATE "Role" SET "permissions"=array_append("permissions",'inventory:read') WHERE "key"='OWNER' AND NOT ('inventory:read'=ANY("permissions"));
UPDATE "Role" SET "permissions"=array_append("permissions",'inventory:manage') WHERE "key"='OWNER' AND NOT ('inventory:manage'=ANY("permissions"));
