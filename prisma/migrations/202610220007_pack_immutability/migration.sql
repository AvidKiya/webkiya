CREATE FUNCTION kiya_pack_component_draft() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE state TEXT;
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN
 SELECT status INTO state FROM "PackDefinition" WHERE id=OLD."packId";
 IF state IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Published pack components are immutable' USING ERRCODE='23514'; END IF;
 END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN
 SELECT status INTO state FROM "PackDefinition" WHERE id=NEW."packId";
 IF state IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Only draft pack components may change' USING ERRCODE='23514'; END IF;
 RETURN NEW;
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER pack_component_draft_only BEFORE INSERT OR UPDATE OR DELETE ON "PackComponent" FOR EACH ROW EXECUTE FUNCTION kiya_pack_component_draft();
CREATE FUNCTION kiya_pack_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='ARCHIVED' OR (OLD.status='ACTIVE' AND (NEW.status<>'ARCHIVED' OR NEW.version<>OLD.version+1 OR ROW(NEW.id,NEW."productId",NEW.label,NEW.mode,NEW."unitsPerPack",NEW."createdAt") IS DISTINCT FROM ROW(OLD.id,OLD."productId",OLD.label,OLD.mode,OLD."unitsPerPack",OLD."createdAt"))) THEN
 RAISE EXCEPTION 'Published pack definitions are immutable; archive and create a replacement' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pack_definition_immutable BEFORE UPDATE ON "PackDefinition" FOR EACH ROW EXECUTE FUNCTION kiya_pack_immutable();
CREATE FUNCTION kiya_variant_pack_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.name,NEW.hex,NEW.sku,NEW."isActive",NEW."productId") IS DISTINCT FROM ROW(OLD.name,OLD.hex,OLD.sku,OLD."isActive",OLD."productId") AND EXISTS(SELECT 1 FROM "PackComponent" c JOIN "PackDefinition" p ON p.id=c."packId" WHERE c."variantId"=OLD.id AND p.status='ACTIVE') THEN
 RAISE EXCEPTION 'Archive referencing packs before editing this SKU' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER variant_active_pack_guard BEFORE UPDATE ON "ProductVariant" FOR EACH ROW EXECUTE FUNCTION kiya_variant_pack_guard();
