ALTER TABLE "TelegramLogin" ADD COLUMN "autoApprove" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "TelegramOtp"(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"browserHash" VARCHAR(64) NOT NULL,"codeHash" VARCHAR(64) NOT NULL,"telegramId" BIGINT, attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),"expiresAt" TIMESTAMPTZ(3) NOT NULL,"consumedAt" TIMESTAMPTZ(3),"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now());
CREATE INDEX telegram_otp_expiry ON "TelegramOtp"("expiresAt");
