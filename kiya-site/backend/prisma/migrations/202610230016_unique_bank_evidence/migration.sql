ALTER TABLE "ManualPayment" ADD COLUMN "bankVerifiedReference" VARCHAR(100), ADD COLUMN "bankProofKey" VARCHAR(64) UNIQUE;
-- NOT VALID preserves any historical terminal records without inventing bank evidence.
-- It still enforces evidence on all new confirmations/refund-required transitions.
ALTER TABLE "ManualPayment" ADD CONSTRAINT verified_bank_evidence CHECK(status NOT IN ('CONFIRMED','REFUND_REQUIRED') OR ("bankVerifiedReference" IS NOT NULL AND "bankProofKey" IS NOT NULL)) NOT VALID;
