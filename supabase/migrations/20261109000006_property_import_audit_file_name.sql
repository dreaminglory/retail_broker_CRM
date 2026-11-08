-- spec: property-import, rule 7 and Task 11. An imported property's `created` audit row also
-- names the file, so the timeline can say "Imported from <file>" to every role: brokers can't
-- read import_jobs (owner/manager only). Same approach as imported contacts
-- (20261102000001_restrict_audit_inserts.sql). The job must be in the property's agency; a
-- forged job id names no file.
--
-- Body copied from 20261109000001_property_import_schema.sql; only the INSERT metadata changes.

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
    VALUES (
      NEW.agency_id, 'property', NEW.id, 'created',
      jsonb_strip_nulls(jsonb_build_object(
        'code', NEW.code,
        'import_job_id', NEW.import_job_id,
        'file_name', (
          SELECT j.file_name FROM import_jobs j
          WHERE NEW.import_job_id IS NOT NULL
            AND j.id = NEW.import_job_id
            AND j.agency_id = NEW.agency_id
        )
      )),
      v_user
    );
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
