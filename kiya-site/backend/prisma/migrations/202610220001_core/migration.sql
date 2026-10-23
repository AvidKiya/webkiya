CREATE TABLE "User" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "kind" TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK ("kind" IN ('CUSTOMER','STAFF')),
 "displayName" VARCHAR(80) NOT NULL, "handle" VARCHAR(60) UNIQUE, "phone" VARCHAR(20) UNIQUE,
 "phoneVerifiedAt" TIMESTAMPTZ(3), "isDemo" BOOLEAN NOT NULL DEFAULT false, "passwordHash" TEXT,
 "mfaSecret" TEXT, "mfaEnabled" BOOLEAN NOT NULL DEFAULT false, "isActive" BOOLEAN NOT NULL DEFAULT true,
 "permissionVersion" INTEGER NOT NULL DEFAULT 1 CHECK ("permissionVersion">0), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE TABLE "Role" ("id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "key" VARCHAR(40) NOT NULL UNIQUE, "name" VARCHAR(80) NOT NULL, "permissions" TEXT[] NOT NULL);
CREATE TABLE "UserRole" ("userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "roleId" UUID NOT NULL REFERENCES "Role"("id") ON DELETE RESTRICT, PRIMARY KEY ("userId","roleId"));
CREATE TABLE "Session" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "tokenHash" TEXT NOT NULL UNIQUE,
 "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "permissionVersion" INTEGER NOT NULL,
 "mfaVerified" BOOLEAN NOT NULL DEFAULT false, "expiresAt" TIMESTAMPTZ(3) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(), "revokedAt" TIMESTAMPTZ(3)
);
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId","expiresAt");
CREATE TABLE "Product" ("id" VARCHAR(80) PRIMARY KEY,"name" VARCHAR(160) NOT NULL,"status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','PUBLISHED','ARCHIVED')),"price" DECIMAL(14,0) NOT NULL CHECK ("price">=0),"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now());
CREATE TABLE "Comment" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),"postId" VARCHAR(80) NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT,
 "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,"parentId" UUID REFERENCES "Comment"("id") ON DELETE RESTRICT,
 "body" VARCHAR(1500) NOT NULL CHECK(length(trim("body"))>0),"status" TEXT NOT NULL DEFAULT 'VISIBLE' CHECK ("status" IN ('VISIBLE','HIDDEN','DELETED')),
 "clientMutationId" UUID NOT NULL,"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),UNIQUE("userId","clientMutationId")
);
CREATE INDEX "Comment_postId_status_createdAt_id_idx" ON "Comment"("postId","status","createdAt","id");
CREATE FUNCTION kiya_comment_parent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE root "Comment"%ROWTYPE;
BEGIN
 IF NEW."parentId" IS NOT NULL THEN
  SELECT * INTO root FROM "Comment" WHERE "id"=NEW."parentId" FOR KEY SHARE;
  IF NOT FOUND OR root."postId"<>NEW."postId" OR root."parentId" IS NOT NULL OR NEW."id"=NEW."parentId" THEN
   RAISE EXCEPTION 'Invalid comment parent' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER comment_parent_guard BEFORE INSERT OR UPDATE OF "parentId","postId" ON "Comment" FOR EACH ROW EXECUTE FUNCTION kiya_comment_parent_guard();
CREATE TABLE "PartnerAccount" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),"userId" UUID NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE RESTRICT,
 "businessName" VARCHAR(100) NOT NULL,"city" VARCHAR(80) NOT NULL,"note" VARCHAR(500) NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','APPROVED','REJECTED','SUSPENDED')),
 "reason" VARCHAR(500),"version" INTEGER NOT NULL DEFAULT 1 CHECK("version">0),"reviewerId" UUID,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),"updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX "PartnerAccount_status_createdAt_idx" ON "PartnerAccount"("status","createdAt");
CREATE TABLE "AuditLog" ("id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),"actorId" UUID,"action" VARCHAR(100) NOT NULL,"resourceId" VARCHAR(100),"data" JSONB NOT NULL,"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now());
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE FUNCTION kiya_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit records are append-only' USING ERRCODE='42501'; END $$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION kiya_audit_immutable();
CREATE TABLE "RateBucket" ("key" TEXT PRIMARY KEY,"count" INTEGER NOT NULL DEFAULT 1 CHECK("count">0),"expiresAt" TIMESTAMPTZ(3) NOT NULL);
