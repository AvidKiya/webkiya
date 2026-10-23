CREATE TABLE "SupportThread" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "userId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
 "orderId" uuid REFERENCES "PurchaseOrder"(id) ON DELETE RESTRICT, "requestId" uuid NOT NULL, digest varchar(64) NOT NULL,
 subject varchar(120) NOT NULL CHECK(length(trim(subject))>=3), status varchar(8) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), "createdAt" timestamptz(3) NOT NULL DEFAULT now(), "publicUpdatedAt" timestamptz(3) NOT NULL DEFAULT now(),
 UNIQUE("userId","requestId")
);
CREATE INDEX "SupportThread_userId_publicUpdatedAt_idx" ON "SupportThread"("userId","publicUpdatedAt");
CREATE INDEX "SupportThread_status_publicUpdatedAt_idx" ON "SupportThread"(status,"publicUpdatedAt");
CREATE TABLE "SupportMessage" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "threadId" uuid NOT NULL REFERENCES "SupportThread"(id) ON DELETE RESTRICT,
 "authorId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT, "authorKind" varchar(8) NOT NULL CHECK("authorKind" IN ('CUSTOMER','STAFF')),
 "requestId" uuid NOT NULL, digest varchar(64) NOT NULL, body varchar(3000) NOT NULL CHECK(length(trim(body))>0), internal boolean NOT NULL DEFAULT false,
 "createdAt" timestamptz(3) NOT NULL DEFAULT now(), UNIQUE("authorId","requestId"), CHECK(NOT internal OR "authorKind"='STAFF')
);
CREATE INDEX "SupportMessage_threadId_internal_createdAt_id_idx" ON "SupportMessage"("threadId",internal,"createdAt",id);
CREATE FUNCTION kiya_guard_support_message() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Support messages are append only'; END IF;
 IF NEW."authorKind"='CUSTOMER' AND (NEW.internal OR NOT EXISTS(SELECT 1 FROM "SupportThread" WHERE id=NEW."threadId" AND "userId"=NEW."authorId")) THEN RAISE EXCEPTION 'Customer thread ownership required'; END IF;
 IF NEW."authorKind"='STAFF' AND NOT EXISTS(SELECT 1 FROM "User" WHERE id=NEW."authorId" AND kind='STAFF') THEN RAISE EXCEPTION 'Staff author required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER support_message_guard BEFORE INSERT OR UPDATE OR DELETE ON "SupportMessage" FOR EACH ROW EXECUTE FUNCTION kiya_guard_support_message();
CREATE FUNCTION kiya_guard_support_thread() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Support history cannot be deleted'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 OR NEW.status<>'OPEN' THEN RAISE EXCEPTION 'Thread must start open'; END IF;
  IF NEW."orderId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "PurchaseOrder" WHERE id=NEW."orderId" AND "userId"=NEW."userId") THEN RAISE EXCEPTION 'Linked order ownership required'; END IF;
 ELSE
  IF NEW.id<>OLD.id OR NEW."userId"<>OLD."userId" OR NEW."orderId" IS DISTINCT FROM OLD."orderId" OR NEW.subject<>OLD.subject OR NEW.digest<>OLD.digest OR NEW."requestId"<>OLD."requestId" OR NEW."createdAt"<>OLD."createdAt" OR NEW.version<>OLD.version+1 OR NEW."publicUpdatedAt"<OLD."publicUpdatedAt" THEN RAISE EXCEPTION 'Immutable support identity or stale version'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER support_thread_guard BEFORE INSERT OR UPDATE OR DELETE ON "SupportThread" FOR EACH ROW EXECUTE FUNCTION kiya_guard_support_thread();
UPDATE "Role" SET permissions=permissions||ARRAY['support:read','support:reply','support:note','support:manage'],version=version+1 WHERE key='OWNER';
UPDATE "User" SET "permissionVersion"="permissionVersion"+1 WHERE id IN(SELECT ur."userId" FROM "UserRole" ur JOIN "Role" r ON r.id=ur."roleId" WHERE r.key='OWNER');
