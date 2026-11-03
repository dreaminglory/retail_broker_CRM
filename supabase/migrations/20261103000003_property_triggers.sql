-- 20261103000003_property_triggers.sql
-- spec: properties, Task 3 (AD-056, AD-057). Property code, audit, and business rules
-- 4, 5, 7 and 8 in the database. Refusals raise i18n keys (RPCs and triggers can't see the
-- request locale); services map them to DomainError before or after the write.

-- ── Property code (#1042) ────────────────────────────────────────────────────
-- The counter row is locked by the UPDATE, so two inserts in one agency never share a code.
-- SECURITY DEFINER: members can't update `agencies` (owner only), but every member adds
-- properties. The RLS check on the inserted property still applies.

CREATE OR REPLACE FUNCTION public.assign_property_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.code := OLD.code;
    RETURN NEW;
  END IF;

  UPDATE agencies
  SET property_code_seq = property_code_seq + 1
  WHERE id = NEW.agency_id
  RETURNING property_code_seq INTO NEW.code;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_property_code() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_assign_property_code
  BEFORE INSERT OR UPDATE OF code ON properties
  FOR EACH ROW EXECUTE FUNCTION assign_property_code();

-- ── Audit (AD-020) ───────────────────────────────────────────────────────────

ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check
  CHECK (entity_type IN ('opportunity', 'contact', 'inquiry', 'property', 'listing'));

CREATE OR REPLACE FUNCTION public.audit_property_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := (SELECT auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, metadata, performed_by)
    VALUES (NEW.agency_id, 'property', NEW.id, 'created', jsonb_build_object('code', NEW.code), v_user);
    RETURN NEW;
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, old_value, new_value, metadata, performed_by)
    VALUES (
      NEW.agency_id, 'property', NEW.id, 'assignment_change', 'assigned_to',
      OLD.assigned_to::TEXT, NEW.assigned_to::TEXT,
      jsonb_build_object('old_email', get_user_email(OLD.assigned_to), 'new_email', get_user_email(NEW.assigned_to)),
      v_user
    );
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, old_value, new_value, performed_by)
    VALUES (
      NEW.agency_id, 'property', NEW.id,
      CASE WHEN NEW.status = 'archived' THEN 'archived' ELSE 'status_change' END,
      'status', OLD.status, NEW.status, v_user
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_property_changes() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_audit_property_changes
  AFTER INSERT OR UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION audit_property_changes();

CREATE OR REPLACE FUNCTION public.audit_listing_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := (SELECT auth.uid());
  v_meta JSONB := jsonb_build_object('property_id', NEW.property_id, 'offer_type', NEW.offer_type);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, new_value, metadata, performed_by)
    VALUES (NEW.agency_id, 'listing', NEW.id, 'created', NEW.price::TEXT, v_meta, v_user);
    RETURN NEW;
  END IF;

  IF NEW.price IS DISTINCT FROM OLD.price THEN
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, old_value, new_value, metadata, performed_by)
    VALUES (NEW.agency_id, 'listing', NEW.id, 'field_change', 'price', OLD.price::TEXT, NEW.price::TEXT, v_meta, v_user);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, old_value, new_value, metadata, performed_by)
    VALUES (NEW.agency_id, 'listing', NEW.id, 'status_change', 'status', OLD.status, NEW.status, v_meta, v_user);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_listing_changes() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_audit_listing_changes
  AFTER INSERT OR UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION audit_listing_changes();

-- One `opportunity` row per link change; the property timeline finds it through
-- metadata.property_id (AD-057). Adding a link is NULL → status, removing it status → NULL;
-- a subject link shows as 'subject'.
CREATE OR REPLACE FUNCTION public.audit_property_link_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row opportunity_properties := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_old TEXT;
  v_new TEXT;
BEGIN
  v_old := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE COALESCE(OLD.status, OLD.relation) END;
  v_new := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE COALESCE(NEW.status, NEW.relation) END;

  IF v_old IS NOT DISTINCT FROM v_new THEN
    RETURN v_row;
  END IF;

  INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, old_value, new_value, metadata, performed_by)
  VALUES (
    v_row.agency_id, 'opportunity', v_row.opportunity_id, 'status_change', 'property_link', v_old, v_new,
    jsonb_build_object(
      'property_id', v_row.property_id,
      'property_code', (SELECT code FROM properties WHERE id = v_row.property_id),
      'relation', v_row.relation,
      'rejected_reason', v_row.rejected_reason
    ),
    (SELECT auth.uid())
  );

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_property_link_changes() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_audit_property_link_changes
  AFTER INSERT OR UPDATE OR DELETE ON opportunity_properties
  FOR EACH ROW EXECUTE FUNCTION audit_property_link_changes();

-- ── Rule 4: closed and withdrawn listings are read-only ──────────────────────

CREATE OR REPLACE FUNCTION public.guard_listing_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('closed', 'withdrawn') THEN
    RAISE EXCEPTION 'listings.errors.readOnly';
  END IF;
  IF NEW.status IN ('closed', 'withdrawn') THEN
    NEW.closed_at := COALESCE(NEW.closed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_listing_update() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_guard_listing_update
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION guard_listing_update();

-- ── Rule 5: relation vs opportunity type ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_property_link_relation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT type INTO v_type
  FROM opportunities
  WHERE id = NEW.opportunity_id AND agency_id = NEW.agency_id;

  -- A missing opportunity is left to the foreign key.
  IF v_type IS NOT NULL AND (
    (NEW.relation = 'subject' AND v_type NOT IN ('seller', 'landlord'))
    OR (NEW.relation = 'candidate' AND v_type NOT IN ('buyer', 'tenant'))
  ) THEN
    RAISE EXCEPTION 'properties.errors.relationNotAllowed';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_property_link_relation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_check_property_link_relation
  BEFORE INSERT OR UPDATE OF relation, opportunity_id ON opportunity_properties
  FOR EACH ROW EXECUTE FUNCTION check_property_link_relation();

-- The opportunity type is editable: refuse a change its links don't allow.
CREATE OR REPLACE FUNCTION public.check_opportunity_type_vs_properties()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM opportunity_properties
    WHERE opportunity_id = NEW.id
      AND agency_id = NEW.agency_id
      AND (
        (relation = 'subject' AND NEW.type NOT IN ('seller', 'landlord'))
        OR (relation = 'candidate' AND NEW.type NOT IN ('buyer', 'tenant'))
      )
  ) THEN
    RAISE EXCEPTION 'opportunities.errors.typeHasProperties';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_opportunity_type_vs_properties() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_check_opportunity_type_vs_properties
  BEFORE UPDATE OF type ON opportunities
  FOR EACH ROW
  WHEN (NEW.type IS DISTINCT FROM OLD.type)
  EXECUTE FUNCTION check_opportunity_type_vs_properties();

-- ── Rule 8: archiving ────────────────────────────────────────────────────────

-- Archiving withdraws the open listings (each withdrawal is audited).
CREATE OR REPLACE FUNCTION public.withdraw_listings_on_archive()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE listings
  SET status = 'withdrawn'
  WHERE property_id = NEW.id
    AND agency_id = NEW.agency_id
    AND status IN ('active', 'reserved');
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.withdraw_listings_on_archive() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_withdraw_listings_on_archive
  AFTER UPDATE OF status ON properties
  FOR EACH ROW
  WHEN (NEW.status = 'archived' AND OLD.status <> 'archived')
  EXECUTE FUNCTION withdraw_listings_on_archive();

-- An archived property gets no new listings, links or viewing tasks.
CREATE OR REPLACE FUNCTION public.refuse_archived_property()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.property_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Nested: NEW.task_type exists only on tasks.
  IF TG_TABLE_NAME = 'tasks' THEN
    IF NEW.task_type IS DISTINCT FROM 'viewing'
       OR (TG_OP = 'UPDATE' AND NEW.property_id IS NOT DISTINCT FROM OLD.property_id) THEN
      RETURN NEW;
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM properties
    WHERE id = NEW.property_id AND agency_id = NEW.agency_id AND status = 'archived'
  ) THEN
    RAISE EXCEPTION 'properties.errors.archived';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refuse_archived_property() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_listings_refuse_archived_property
  BEFORE INSERT ON listings
  FOR EACH ROW EXECUTE FUNCTION refuse_archived_property();

CREATE TRIGGER trg_opportunity_properties_refuse_archived_property
  BEFORE INSERT ON opportunity_properties
  FOR EACH ROW EXECUTE FUNCTION refuse_archived_property();

CREATE TRIGGER trg_tasks_refuse_archived_property
  BEFORE INSERT OR UPDATE OF property_id, task_type ON tasks
  FOR EACH ROW EXECUTE FUNCTION refuse_archived_property();

-- ── Rule 7: a completed viewing marks the property viewed ────────────────────
-- candidate → viewed; a missing link on a buyer or tenant deal is created as viewed;
-- offered, rejected, selected and subject links are never touched. Runs as the caller, so
-- the link write goes through RLS and the audit trigger.

CREATE OR REPLACE FUNCTION public.mark_property_viewed()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_type TEXT;
BEGIN
  UPDATE opportunity_properties
  SET status = 'viewed'
  WHERE opportunity_id = NEW.opportunity_id
    AND property_id = NEW.property_id
    AND agency_id = NEW.agency_id
    AND status = 'candidate';

  IF FOUND OR EXISTS (
    SELECT 1 FROM opportunity_properties
    WHERE opportunity_id = NEW.opportunity_id AND property_id = NEW.property_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT type INTO v_type FROM opportunities WHERE id = NEW.opportunity_id AND agency_id = NEW.agency_id;

  IF v_type IN ('buyer', 'tenant') AND EXISTS (
    SELECT 1 FROM properties
    WHERE id = NEW.property_id AND agency_id = NEW.agency_id AND status = 'active'
  ) THEN
    INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status, created_by)
    VALUES (NEW.agency_id, NEW.opportunity_id, NEW.property_id, 'candidate', 'viewed', (SELECT auth.uid()))
    ON CONFLICT (opportunity_id, property_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_property_viewed() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_mark_property_viewed
  AFTER UPDATE OF status ON tasks
  FOR EACH ROW
  WHEN (
    NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
    AND NEW.task_type = 'viewing'
    AND NEW.opportunity_id IS NOT NULL
    AND NEW.property_id IS NOT NULL
  )
  EXECUTE FUNCTION mark_property_viewed();
