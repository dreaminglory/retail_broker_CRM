-- spec: properties, checkpoint 4 review. The property timeline finds its listing and link
-- rows through an index on metadata->>'property_id', not by reading every listing and deal
-- row of the agency (src/domain/timeline/service.ts getPropertyTimeline).
BEGIN;
SELECT plan(3);

SELECT has_index('public', 'audit_log', 'idx_audit_property', 'audit_log has idx_audit_property');

-- The plan of the timeline's audit query, as PostgREST sends it.
CREATE FUNCTION pg_temp.timeline_plan() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_line text;
  v_plan text := '';
BEGIN
  FOR v_line IN EXECUTE $q$
    EXPLAIN SELECT * FROM audit_log
    WHERE agency_id = '11111111-1111-1111-1111-111111111111'
      AND ((entity_type = 'property' AND entity_id = '11111111-9999-0000-0000-000000000001')
           OR (metadata ->> 'property_id') = '11111111-9999-0000-0000-000000000001')
    ORDER BY performed_at DESC LIMIT 20
  $q$ LOOP
    v_plan := v_plan || v_line || E'\n';
  END LOOP;
  RETURN v_plan;
END;
$$;

-- The seeded table is tiny, so steer the planner away from a sequential scan.
SET LOCAL enable_seqscan = off;

SELECT ok(pg_temp.timeline_plan() LIKE '%idx_audit_property%', 'Listing and link rows are found through idx_audit_property');
SELECT ok(
  pg_temp.timeline_plan() NOT LIKE '%entity_type = ''opportunity''%',
  'The query no longer reads every deal row of the agency'
);

SELECT * FROM finish();
ROLLBACK;
