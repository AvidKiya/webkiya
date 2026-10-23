-- Telegram proves identity, never a role. OWNER/MFA role management is still enforced by services.
ALTER TABLE "User" DROP CONSTRAINT telegram_identity;
ALTER TABLE "User" ADD CONSTRAINT telegram_identity CHECK(("telegramId" IS NULL AND "telegramVerifiedAt" IS NULL) OR ("telegramId">0 AND "telegramVerifiedAt" IS NOT NULL AND NOT "isDemo"));
