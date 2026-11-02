-- Email reminders (AD-042, AD-051): the delivery log that makes sends idempotent, and the
-- per-user switch for the daily digest.
--
-- A send first inserts a 'pending' row (ON CONFLICT DO NOTHING); only the run that inserted it
-- sends, then sets 'sent' or 'failed'. 'sent' and 'pending' block a repeat, 'failed' and
-- 'skipped' can be claimed again. Only the service role writes (the digest route and the
-- after() work of the inquiry actions); members can read.

CREATE TABLE notification_deliveries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        TEXT        NOT NULL CHECK (kind IN ('daily_digest', 'inquiry_assigned')),
  -- daily_digest: YYYY-MM-DD (agency-local date)
  -- inquiry_assigned: <inquiry_id>:YYYY-MM-DD, or import:<job_id> for an import summary
  period_key  TEXT        NOT NULL CHECK (length(btrim(period_key)) > 0),
  entity_id   UUID,
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  provider_id TEXT,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_notification_deliveries_key UNIQUE (user_id, kind, period_key)
);

CREATE INDEX idx_notification_deliveries_agency_id ON notification_deliveries(agency_id);

CREATE TRIGGER set_notification_deliveries_updated_at
  BEFORE UPDATE ON notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries FORCE ROW LEVEL SECURITY;

-- A member reads their own rows; owners and managers read the agency's ("why didn't X get one?").
CREATE POLICY "own_or_config_select" ON notification_deliveries
  FOR SELECT USING (
    agency_id = current_agency_id()
    AND (
      user_id = (SELECT auth.uid())
      OR current_user_role() IN ('owner', 'manager')
    )
  );

-- No INSERT, UPDATE or DELETE policy, and no grant either: clients never write here.
REVOKE ALL ON notification_deliveries FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON notification_deliveries FROM authenticated;

-- Each user can turn their own daily digest off. Covered by the existing
-- users_update_own_profile policy.
ALTER TABLE profiles
  ADD COLUMN digest_enabled BOOLEAN NOT NULL DEFAULT true;
