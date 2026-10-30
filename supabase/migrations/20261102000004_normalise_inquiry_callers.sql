-- trustworthy-loop Task 3: normalise inquiry callers stored before validation did it (C2, AD-041).
--
-- SQL can't call libphonenumber-js, so this only converts the BG mobile forms the old
-- normalizePhone() accepted: 0XXXXXXXXX and (+)359XXXXXXXXX. Anything else stays as typed and is
-- counted; callerContactMethods() still parses those at conversion. raw_payload is never touched.

CREATE OR REPLACE FUNCTION public.backfill_inquiry_callers()
RETURNS TABLE (phones_updated integer, emails_updated integer, phones_left_as_typed integer)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  WITH candidates AS (
    SELECT
      id,
      caller_phone,
      regexp_match(
        regexp_replace(caller_phone, '[\s .()-]', '', 'g'),
        '^(?:\+?359|0)([1-9]\d{8})$'
      ) AS national
    FROM inquiries
    WHERE caller_phone IS NOT NULL
  ), updated AS (
    UPDATE inquiries i
    SET caller_phone = '+359' || c.national[1]
    FROM candidates c
    WHERE i.id = c.id
      AND c.national IS NOT NULL
      AND i.caller_phone IS DISTINCT FROM '+359' || c.national[1]
    RETURNING 1
  )
  SELECT count(*)::integer INTO phones_updated FROM updated;

  WITH updated AS (
    UPDATE inquiries
    SET caller_email = lower(btrim(caller_email))
    WHERE caller_email IS NOT NULL
      AND caller_email IS DISTINCT FROM lower(btrim(caller_email))
    RETURNING 1
  )
  SELECT count(*)::integer INTO emails_updated FROM updated;

  SELECT count(*)::integer INTO phones_left_as_typed
  FROM inquiries
  WHERE caller_phone IS NOT NULL
    AND caller_phone !~ '^\+[1-9]\d{6,14}$';

  RETURN NEXT;
END;
$$;

-- Only the migration and pgTAP run this.
REVOKE EXECUTE ON FUNCTION public.backfill_inquiry_callers() FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE
  v_result record;
BEGIN
  SELECT * INTO v_result FROM public.backfill_inquiry_callers();
  RAISE NOTICE 'Inquiry callers backfilled: % phones, % emails; % phones left as typed',
    v_result.phones_updated, v_result.emails_updated, v_result.phones_left_as_typed;
END;
$$;
