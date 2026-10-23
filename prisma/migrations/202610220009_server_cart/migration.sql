CREATE TABLE "ServerCart" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "mode" VARCHAR(12) NOT NULL CHECK("mode" IN ('RETAIL','WHOLESALE')), "version" INTEGER NOT NULL DEFAULT 1 CHECK("version">0),
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(), UNIQUE("userId","mode"), UNIQUE("id","mode")
);
CREATE TABLE "ServerCartLine" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "cartId" UUID NOT NULL, "mode" VARCHAR(12) NOT NULL,
 "variantId" UUID REFERENCES "ProductVariant"("id") ON DELETE RESTRICT, "packId" UUID REFERENCES "PackDefinition"("id") ON DELETE RESTRICT,
 "quantity" INTEGER NOT NULL CHECK("quantity">0 AND "quantity"<=1000),
 FOREIGN KEY("cartId","mode") REFERENCES "ServerCart"("id","mode") ON DELETE RESTRICT,
 CHECK((mode='RETAIL' AND "variantId" IS NOT NULL AND "packId" IS NULL) OR (mode='WHOLESALE' AND "packId" IS NOT NULL AND "variantId" IS NULL)),
 UNIQUE("cartId","variantId"), UNIQUE("cartId","packId")
);
CREATE TABLE "CartOperation" (
 "requestId" UUID PRIMARY KEY, "cartId" UUID NOT NULL REFERENCES "ServerCart"("id") ON DELETE RESTRICT,
 "digest" VARCHAR(64) NOT NULL, "result" JSONB NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX "CartOperation_cartId_idx" ON "CartOperation"("cartId");
CREATE TRIGGER cart_operation_immutable BEFORE UPDATE OR DELETE ON "CartOperation" FOR EACH ROW EXECUTE FUNCTION kiya_audit_immutable();
