-- 20261119000002_phone_loop_follow.sql
-- spec: phone-loop, Task 3 (AD-065). An inquiry's tasks follow it: a conversion or a join gives
-- them the deal and the contact, a dismissal cancels the pending ones. convert_inquiry and
-- join_inquiry are not edited; the trigger on inquiries does it for both.

-- ── O3: next_action_at also follows a task that changes deal ─────────────────
-- Until now only status and due_at changes recomputed it. Re-pointing a task (here: an
-- inquiry's retry moving to its new deal) recomputes the new deal and the one it left.

CREATE OR REPLACE FUNCTION public.sync_opportunity_next_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids UUID[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_ids := ARRAY[OLD.opportunity_id];
  ELSIF TG_OP = 'UPDATE' AND OLD.opportunity_id IS DISTINCT FROM NEW.opportunity_id THEN
    v_ids := ARRAY[OLD.opportunity_id, NEW.opportunity_id];
  ELSE
    v_ids := ARRAY[NEW.opportunity_id];
  END IF;

  -- A task with no deal (an inquiry's call) has nothing to recompute.
  v_ids := array_remove(v_ids, NULL);
  IF cardinality(v_ids) = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE opportunities o
  SET next_action_at = (
    SELECT MIN(t.due_at)
    FROM tasks t
    WHERE t.opportunity_id = o.id
      AND t.status = 'pending'
      AND t.due_at IS NOT NULL
  )
  WHERE o.id = ANY (v_ids);

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_opportunity_next_action() FROM PUBLIC, anon, authenticated;

DROP TRIGGER sync_next_action_on_task_change ON tasks;
CREATE TRIGGER sync_next_action_on_task_change
  AFTER INSERT OR UPDATE OF status, due_at, opportunity_id OR DELETE
  ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION sync_opportunity_next_action();

-- ── The inquiry's tasks follow it ────────────────────────────────────────────
-- Runs as the caller (RLS applies, as for the conversion itself). Only empty links are
-- filled: a task already on a deal or contact keeps it. Completed calls move too, so the deal
-- timeline shows them. A dismissal cancels pending tasks with an i18n key as outcome.

CREATE OR REPLACE FUNCTION public.inquiry_tasks_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
     OR NEW.contact_id IS DISTINCT FROM OLD.contact_id THEN
    UPDATE tasks
    SET opportunity_id = COALESCE(opportunity_id, NEW.opportunity_id),
        contact_id     = COALESCE(contact_id, NEW.contact_id)
    WHERE inquiry_id = NEW.id
      AND agency_id = NEW.agency_id
      AND (
        (opportunity_id IS NULL AND NEW.opportunity_id IS NOT NULL)
        OR (contact_id IS NULL AND NEW.contact_id IS NOT NULL)
      );
  END IF;

  IF NEW.status = 'dismissed' AND OLD.status IS DISTINCT FROM 'dismissed' THEN
    UPDATE tasks
    SET status = 'cancelled', outcome = 'phoneLoop.cancelledByDismiss'
    WHERE inquiry_id = NEW.id
      AND agency_id = NEW.agency_id
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.inquiry_tasks_follow() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_inquiry_tasks_follow
  AFTER UPDATE OF opportunity_id, contact_id, status ON inquiries
  FOR EACH ROW EXECUTE FUNCTION inquiry_tasks_follow();
