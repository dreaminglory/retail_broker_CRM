-- ============================================================
-- Migration: Create audit_log table and triggers
-- ============================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('opportunity', 'contact', 'inquiry')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('field_change', 'status_change', 'stage_change', 'assignment_change', 'created', 'merged', 'archived')),
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log(agency_id, entity_type, entity_id, performed_at DESC);
CREATE INDEX idx_audit_performer ON audit_log(agency_id, performed_by, performed_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

-- Select policy: users can see audit logs for their agency
CREATE POLICY "users_see_own_agency_audit_logs" ON audit_log
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM agency_memberships
      WHERE user_id = (SELECT auth.uid())
        AND status = 'active'
    )
  );

-- INSERT policy for authenticated users
CREATE POLICY "authenticated_can_insert_audit_logs" ON audit_log
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Function to get user email
CREATE OR REPLACE FUNCTION get_user_email(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = user_uuid;
  RETURN user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get stage name
CREATE OR REPLACE FUNCTION get_stage_name(stage_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  s_name TEXT;
BEGIN
  SELECT name INTO s_name FROM stages WHERE id = stage_uuid;
  RETURN s_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Function for opportunities
CREATE OR REPLACE FUNCTION audit_opportunity_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID := (SELECT auth.uid());
  old_email TEXT;
  new_email TEXT;
  old_stage TEXT;
  new_stage TEXT;
BEGIN
  -- assigned_to change
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    old_email := get_user_email(OLD.assigned_to);
    new_email := get_user_email(NEW.assigned_to);
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, old_value, new_value, metadata, performed_by)
    VALUES (
      NEW.agency_id, 'opportunity', NEW.id, 'assignment_change', 'assigned_to', 
      OLD.assigned_to::TEXT, NEW.assigned_to::TEXT, 
      jsonb_build_object('old_email', old_email, 'new_email', new_email),
      current_user_id
    );
  END IF;

  -- stage_id change
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    old_stage := get_stage_name(OLD.stage_id);
    new_stage := get_stage_name(NEW.stage_id);
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, old_value, new_value, metadata, performed_by)
    VALUES (
      NEW.agency_id, 'opportunity', NEW.id, 'stage_change', 'stage_id', 
      OLD.stage_id::TEXT, NEW.stage_id::TEXT, 
      jsonb_build_object('old_stage_name', old_stage, 'new_stage_name', new_stage),
      current_user_id
    );
  END IF;

  -- status change
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, old_value, new_value, metadata, performed_by)
    VALUES (
      NEW.agency_id, 'opportunity', NEW.id, 'status_change', 'status', 
      OLD.status, NEW.status, 
      NULL,
      current_user_id
    );
  END IF;

  -- primary_contact_id change
  IF NEW.primary_contact_id IS DISTINCT FROM OLD.primary_contact_id THEN
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, old_value, new_value, metadata, performed_by)
    VALUES (
      NEW.agency_id, 'opportunity', NEW.id, 'field_change', 'primary_contact_id', 
      OLD.primary_contact_id::TEXT, NEW.primary_contact_id::TEXT, 
      NULL,
      current_user_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_opportunity_changes
  AFTER UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION audit_opportunity_changes();


-- Trigger Function for contacts
CREATE OR REPLACE FUNCTION audit_contact_status_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID := (SELECT auth.uid());
  action_type TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'archived' THEN
      action_type := 'archived';
    ELSIF OLD.status = 'archived' AND NEW.status = 'active' THEN
      action_type := 'status_change';
    ELSE
      action_type := 'status_change';
    END IF;

    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, old_value, new_value, metadata, performed_by)
    VALUES (
      NEW.agency_id, 'contact', NEW.id, action_type, 'status', 
      OLD.status, NEW.status, 
      NULL,
      current_user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_contact_status_changes
  AFTER UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION audit_contact_status_changes();
