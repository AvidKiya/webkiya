ALTER TABLE "Product" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version">0), ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now();
UPDATE "Role" SET "permissions"=array_append("permissions",'product:write') WHERE "key"='OWNER' AND NOT ('product:write'=ANY("permissions"));
