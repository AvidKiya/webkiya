ALTER TABLE "PartnerAccount" ADD COLUMN "expiresAt" TIMESTAMPTZ(3);
CREATE TABLE "WholesaleOffer" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "productId" VARCHAR(80) NOT NULL, "packId" UUID NOT NULL,
 "partnerId" UUID NOT NULL REFERENCES "PartnerAccount"("id") ON DELETE RESTRICT, "packVersion" INTEGER NOT NULL CHECK("packVersion">0),
 "mode" VARCHAR(12) NOT NULL CHECK("mode" IN ('PRICED','INQUIRY')), "unitPriceToman" DECIMAL(14,0),
 "validFrom" TIMESTAMPTZ(3) NOT NULL, "validUntil" TIMESTAMPTZ(3),
 "status" VARCHAR(12) NOT NULL DEFAULT 'DRAFT' CHECK("status" IN ('DRAFT','PUBLISHED','ARCHIVED')),
 "version" INTEGER NOT NULL DEFAULT 1 CHECK("version">0), "createdBy" UUID NOT NULL, "reviewerId" UUID,
 "reason" VARCHAR(500) NOT NULL, "requestId" UUID NOT NULL UNIQUE, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 FOREIGN KEY("packId","productId") REFERENCES "PackDefinition"("id","productId") ON DELETE RESTRICT,
 CHECK(("mode"='INQUIRY' AND "unitPriceToman" IS NULL) OR ("mode"='PRICED' AND "unitPriceToman">0 AND "unitPriceToman" IS NOT NULL)),
 CHECK("validUntil" IS NULL OR "validUntil">"validFrom"),
 CHECK("status"<>'PUBLISHED' OR ("reviewerId" IS NOT NULL AND "reviewerId"<>"createdBy"))
);
CREATE UNIQUE INDEX "WholesaleOffer_one_published" ON "WholesaleOffer"("partnerId","packId") WHERE status='PUBLISHED';
CREATE INDEX "WholesaleOffer_productId_createdAt_idx" ON "WholesaleOffer"("productId","createdAt");
CREATE INDEX "WholesaleOffer_partnerId_status_idx" ON "WholesaleOffer"("partnerId","status");
CREATE FUNCTION kiya_offer_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Wholesale price history cannot be deleted' USING ERRCODE='23514'; END IF;
 IF ROW(NEW.id,NEW."productId",NEW."packId",NEW."partnerId",NEW."packVersion",NEW.mode,NEW."unitPriceToman",NEW."validFrom",NEW."validUntil",NEW."createdBy",NEW.reason,NEW."requestId",NEW."createdAt") IS DISTINCT FROM ROW(OLD.id,OLD."productId",OLD."packId",OLD."partnerId",OLD."packVersion",OLD.mode,OLD."unitPriceToman",OLD."validFrom",OLD."validUntil",OLD."createdBy",OLD.reason,OLD."requestId",OLD."createdAt") OR NEW.version<>OLD.version+1 OR NOT ((OLD.status='DRAFT' AND NEW.status IN ('PUBLISHED','ARCHIVED')) OR (OLD.status='PUBLISHED' AND NEW.status='ARCHIVED')) THEN
 RAISE EXCEPTION 'Archive and create a replacement wholesale offer' USING ERRCODE='23514'; END IF;
 IF NEW.status='ARCHIVED' AND NEW."reviewerId" IS DISTINCT FROM OLD."reviewerId" THEN RAISE EXCEPTION 'Reviewer is immutable after publication' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER wholesale_offer_immutable BEFORE UPDATE OR DELETE ON "WholesaleOffer" FOR EACH ROW EXECUTE FUNCTION kiya_offer_immutable();
UPDATE "Role" SET permissions=array_append(permissions,'wholesale:price:read') WHERE key='OWNER' AND NOT('wholesale:price:read'=ANY(permissions));
UPDATE "Role" SET permissions=array_append(permissions,'wholesale:price:manage') WHERE key='OWNER' AND NOT('wholesale:price:manage'=ANY(permissions));
UPDATE "Role" SET permissions=array_append(permissions,'wholesale:price:publish') WHERE key='OWNER' AND NOT('wholesale:price:publish'=ANY(permissions));
