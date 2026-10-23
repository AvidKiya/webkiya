ALTER TABLE "Role" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version">0);
UPDATE "Role" SET "permissions"=array_append("permissions",'staff:manage') WHERE "key"='OWNER' AND NOT ('staff:manage'=ANY("permissions"));
UPDATE "Role" SET "permissions"=array_append("permissions",'role:manage') WHERE "key"='OWNER' AND NOT ('role:manage'=ANY("permissions"));
