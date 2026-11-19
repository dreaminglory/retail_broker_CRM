-- 20261119000001_phone_loop.sql
-- spec: phone-loop, Task 2 (AD-065). A logged call is a completed `call`/`email` task with a
-- channel; an inquiry's calls hang on tasks.inquiry_id; inquiries.contacted_at records the
-- first outreach and is owned by the triggers below.

-- ── tasks.inquiry_id, tasks.channel ──────────────────────────────────────────

ALTER TABLE inquiries ADD CONSTRAINT uq_inquiries_agency_id_id UNIQUE (agency_id, id);

-- Composite FK: a task points only at an inquiry of its own agency (FKs don't see RLS; same
-- guard as tasks.property_id, AD-057). Deleting the inquiry keeps the task and its agency.
ALTER TABLE tasks ADD COLUMN inquiry_id UUID;
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_inquiry FOREIGN KEY (agency_id, inquiry_id)
  REFERENCES inquiries (agency_id, id) ON DELETE SET NULL (inquiry_id);
CREATE INDEX idx_tasks_agency_inquiry ON tasks (agency_id, inquiry_id) WHERE inquiry_id IS NOT NULL;

-- phone, viber and whatsapp are call attempts; email is an email task. NULL on every other task.
-- COALESCE: a NULL task_type would make the CHECK NULL, which passes.
ALTER TABLE tasks ADD COLUMN channel TEXT
  CONSTRAINT tasks_channel_check CHECK (
    channel IS NULL
    OR (channel IN ('phone', 'viber', 'whatsapp') AND COALESCE(task_type, '') = 'call')
    OR (channel = 'email' AND COALESCE(task_type, '') = 'email')
  );

-- ── inquiries.contacted_at ───────────────────────────────────────────────────

-- No backfill: existing contacted and converted inquiries keep NULL ("unknown").
ALTER TABLE inquiries ADD COLUMN contacted_at TIMESTAMPTZ;

-- Set once, to now(), when the inquiry leaves `new` for `contacted` or `converted` (a logged
-- call, "Mark contacted", a conversion). A written value is always ignored: tasks.completed_at
-- is the caller's to write, so it can't date the contact (a backdated call would give a
-- negative speed to lead).
CREATE OR REPLACE FUNCTION public.guard_inquiry_contacted_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.contacted_at := NULL;
    RETURN NEW;
  END IF;

  IF OLD.contacted_at IS NOT NULL OR OLD.status <> 'new' THEN
    NEW.contacted_at := OLD.contacted_at;
    RETURN NEW;
  END IF;

  NEW.contacted_at := CASE WHEN NEW.status IN ('contacted', 'converted') THEN now() END;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_inquiry_contacted_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_inquiry_contacted_at
  BEFORE INSERT OR UPDATE ON inquiries
  FOR EACH ROW EXECUTE FUNCTION guard_inquiry_contacted_at();

-- The first completed call or email on a `new` inquiry marks it contacted (the guard above stamps
-- the time).
-- Runs as the caller, so the inquiry update goes through RLS (as "Mark contacted" does).
-- Converted, dismissed and already contacted inquiries are never touched.
CREATE OR REPLACE FUNCTION public.mark_inquiry_contacted()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE inquiries
  SET status = 'contacted'
  WHERE id = NEW.inquiry_id
    AND agency_id = NEW.agency_id
    AND status = 'new';

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_inquiry_contacted() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_task_marks_inquiry_contacted
  AFTER INSERT OR UPDATE OF status ON tasks
  FOR EACH ROW
  WHEN (
    NEW.status = 'completed'
    AND NEW.inquiry_id IS NOT NULL
    AND NEW.task_type IN ('call', 'email')
  )
  EXECUTE FUNCTION mark_inquiry_contacted();
