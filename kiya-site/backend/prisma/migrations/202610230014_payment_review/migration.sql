ALTER TABLE "ManualPayment" DROP CONSTRAINT "ManualPayment_status_check";
ALTER TABLE "ManualPayment" ADD CONSTRAINT "ManualPayment_status_check" CHECK(status IN ('AWAITING_TRANSFER','UNDER_REVIEW','REJECTED','CONFIRMED','REFUND_REQUIRED'));
UPDATE "Role" SET permissions=array_append(permissions,'payment:review') WHERE key='OWNER' AND NOT ('payment:review'=ANY(permissions));
