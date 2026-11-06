-- 20261106000001_matching_source.sql
-- spec: matching, Task 1 (AD-060). Where a property link came from: typed by hand, added from
-- a match list, or created by a completed viewing. Set on insert only: the column UPDATE
-- grant stays (status, rejected_reason) from AD-058, so no new privilege is needed.
-- Existing rows stay 'manual'.

ALTER TABLE opportunity_properties
  ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
  CONSTRAINT opportunity_properties_source_check CHECK (source IN ('manual', 'match', 'viewing'));

-- A completed viewing that creates a missing link marks it 'viewing'. Body as in
-- 20261103000003 plus `source`; the trigger and the revoked grants carry over.
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
    INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status, source, created_by)
    VALUES (NEW.agency_id, NEW.opportunity_id, NEW.property_id, 'candidate', 'viewed', 'viewing', (SELECT auth.uid()))
    ON CONFLICT (opportunity_id, property_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_property_viewed() FROM PUBLIC, anon, authenticated;
