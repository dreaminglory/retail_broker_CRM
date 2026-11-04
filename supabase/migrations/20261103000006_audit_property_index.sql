-- spec: properties, checkpoint 4 review. The property timeline (AD-057) reads listing and link
-- audit rows by metadata->>'property_id'. Without an index it read every listing and deal row
-- of the agency and filtered them. Only those two kinds of row store a property_id; the
-- predicate is IS NOT NULL so the planner can prove an equality on the key implies it.

CREATE INDEX idx_audit_property
  ON audit_log (agency_id, (metadata ->> 'property_id'), performed_at DESC)
  WHERE (metadata ->> 'property_id') IS NOT NULL;
