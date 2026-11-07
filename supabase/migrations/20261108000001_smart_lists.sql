-- smart-lists, Task 1 (AD-062): saved lists of deals and inquiries (custom lists only; the
-- built-in lists are code). A list is a view preference, so it is not audited.
--
-- Access (rule 4 of spec/smart-lists.md):
--   * a personal list is seen and changed by its creator only, not by a manager;
--   * only owners and managers can share a list;
--   * a shared list is seen by the whole agency and changed or deleted by owners and managers.

CREATE TABLE smart_lists (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  created_by  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  entity      TEXT        NOT NULL,
  -- Filter shape per entity is validated in Zod and read by the list functions (Task 2+).
  filter      JSONB       NOT NULL,
  shared      BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT smart_lists_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  CONSTRAINT smart_lists_entity_check CHECK (entity IN ('opportunity', 'inquiry')),
  CONSTRAINT smart_lists_filter_is_object CHECK (jsonb_typeof(filter) = 'object')
);

CREATE INDEX idx_smart_lists_agency_id ON smart_lists (agency_id);
-- One name per member, ignoring case; also serves the per-member cap count and the overview.
CREATE UNIQUE INDEX uq_smart_lists_member_name
  ON smart_lists (agency_id, created_by, lower(name));

CREATE TRIGGER set_smart_lists_updated_at
  BEFORE UPDATE ON smart_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Rules that RLS cannot express ────────────────────────────────────────────

-- At most 50 lists per member per agency. The service checks first for the friendly message;
-- this is the guarantee. The advisory lock keeps two concurrent inserts from both passing.
CREATE FUNCTION enforce_smart_list_limit() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.agency_id::text || NEW.created_by::text, 0));
  IF (SELECT count(*) FROM smart_lists
      WHERE agency_id = NEW.agency_id AND created_by = NEW.created_by) >= 50 THEN
    RAISE EXCEPTION 'smartLists.errors.limit';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION enforce_smart_list_limit() FROM PUBLIC, anon;

CREATE TRIGGER smart_lists_limit
  BEFORE INSERT ON smart_lists
  FOR EACH ROW EXECUTE FUNCTION enforce_smart_list_limit();

-- The owner, the agency and the entity of a list never change: a manager who may edit a shared
-- list must not be able to hand it to someone else, and the filter shape depends on the entity.
CREATE FUNCTION enforce_smart_list_immutable() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.entity IS DISTINCT FROM OLD.entity THEN
    RAISE EXCEPTION 'smartLists.errors.immutable';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION enforce_smart_list_immutable() FROM PUBLIC, anon;

CREATE TRIGGER smart_lists_immutable
  BEFORE UPDATE ON smart_lists
  FOR EACH ROW EXECUTE FUNCTION enforce_smart_list_immutable();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE smart_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_lists FORCE ROW LEVEL SECURITY;

CREATE POLICY "member_or_shared_select" ON smart_lists
  FOR SELECT USING (
    agency_id = current_agency_id()
    AND (created_by = (SELECT auth.uid()) OR shared)
  );

-- Own agency, in the caller's own name; only owners and managers may insert a shared list.
CREATE POLICY "own_insert" ON smart_lists
  FOR INSERT WITH CHECK (
    agency_id = current_agency_id()
    AND created_by = (SELECT auth.uid())
    AND (NOT shared OR current_user_role() IN ('owner', 'manager'))
  );

-- Target rows: the caller's own personal list, or any shared list when owner/manager.
-- Result rows: not shared unless owner/manager (a broker cannot share by updating), and still
-- visible to the caller (the SELECT policy applies to the new row). So only the creator can
-- unshare a list: it goes back to being theirs alone. Others delete it instead.
CREATE POLICY "own_or_shared_update" ON smart_lists
  FOR UPDATE USING (
    agency_id = current_agency_id()
    AND (
      (created_by = (SELECT auth.uid()) AND NOT shared)
      OR (shared AND current_user_role() IN ('owner', 'manager'))
    )
  ) WITH CHECK (
    agency_id = current_agency_id()
    AND (NOT shared OR current_user_role() IN ('owner', 'manager'))
  );

CREATE POLICY "own_or_shared_delete" ON smart_lists
  FOR DELETE USING (
    agency_id = current_agency_id()
    AND (
      (created_by = (SELECT auth.uid()) AND NOT shared)
      OR (shared AND current_user_role() IN ('owner', 'manager'))
    )
  );

REVOKE ALL ON smart_lists FROM anon;
REVOKE TRUNCATE ON smart_lists FROM authenticated;
