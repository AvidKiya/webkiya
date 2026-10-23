ALTER TABLE "User" ADD COLUMN "mfaLastStep" BIGINT;
CREATE TABLE "RecoveryCode" ("id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),"userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"codeHash" TEXT NOT NULL UNIQUE,"consumedAt" TIMESTAMPTZ(3));
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");
UPDATE "Role" SET "permissions"=array_append("permissions",'comment:reply') WHERE "key" IN ('OWNER','SUPPORT') AND NOT ('comment:reply'=ANY("permissions"));
