ALTER TABLE "TelegramLogin" ADD COLUMN "verifiedPhone" VARCHAR(20);
ALTER TABLE "TelegramOutbox" ADD COLUMN "requestContact" BOOLEAN NOT NULL DEFAULT false;
