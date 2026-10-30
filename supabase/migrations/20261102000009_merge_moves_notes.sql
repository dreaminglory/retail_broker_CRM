-- 20261102000009_merge_moves_notes.sql
-- A merge now moves the loser's notes too, so they stay on the winner's timeline (C4).
-- Existing grants carry over: CREATE OR REPLACE keeps them.

CREATE OR REPLACE FUNCTION public.merge_contacts(
  p_agency_id UUID,
  p_winner_id UUID,
  p_loser_id  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  IF COALESCE(current_user_role(), '') NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'errors.forbidden';
  END IF;
  IF p_agency_id IS DISTINCT FROM current_agency_id() THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;
  IF p_winner_id = p_loser_id THEN
    RAISE EXCEPTION 'errors.merge_self';
  END IF;

  -- In id order, so two opposite merges can't deadlock.
  PERFORM 1 FROM contacts
  WHERE id IN (p_winner_id, p_loser_id) AND agency_id = p_agency_id
  ORDER BY id
  FOR UPDATE;

  IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = p_winner_id AND agency_id = p_agency_id) THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;

  SELECT (to_jsonb(c) - 'search_vector') || jsonb_build_object(
    'contact_methods',
    (SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb) FROM contact_methods m WHERE m.contact_id = c.id)
  )
  INTO v_snapshot
  FROM contacts c
  WHERE c.id = p_loser_id AND c.agency_id = p_agency_id;

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;

  -- Contact methods: drop exact duplicates, move the rest
  DELETE FROM contact_methods l
  USING contact_methods w
  WHERE l.contact_id = p_loser_id
    AND l.agency_id = p_agency_id
    AND w.contact_id = p_winner_id
    AND w.agency_id = p_agency_id
    AND w.type = l.type
    AND w.value = l.value;

  UPDATE contact_methods
  SET contact_id = p_winner_id, is_primary = false
  WHERE contact_id = p_loser_id AND agency_id = p_agency_id;

  UPDATE opportunities
  SET primary_contact_id = p_winner_id
  WHERE primary_contact_id = p_loser_id AND agency_id = p_agency_id;

  -- Participants: a deal the winner is already on keeps the winner's row (P1)
  DELETE FROM opportunity_participants l
  USING opportunity_participants w
  WHERE l.contact_id = p_loser_id
    AND l.agency_id = p_agency_id
    AND w.contact_id = p_winner_id
    AND w.agency_id = p_agency_id
    AND w.opportunity_id = l.opportunity_id;

  UPDATE opportunity_participants
  SET contact_id = p_winner_id
  WHERE contact_id = p_loser_id AND agency_id = p_agency_id;

  UPDATE inquiries
  SET contact_id = p_winner_id
  WHERE contact_id = p_loser_id AND agency_id = p_agency_id;

  UPDATE tasks
  SET contact_id = p_winner_id
  WHERE contact_id = p_loser_id AND agency_id = p_agency_id;

  UPDATE notes
  SET contact_id = p_winner_id
  WHERE contact_id = p_loser_id AND agency_id = p_agency_id;

  UPDATE contacts
  SET status = 'archived'
  WHERE id = p_loser_id AND agency_id = p_agency_id;

  INSERT INTO merge_history (agency_id, winner_contact_id, loser_contact_id, merged_by, loser_snapshot)
  VALUES (p_agency_id, p_winner_id, p_loser_id, auth.uid(), v_snapshot);
END;
$$;
