-- smart-lists, Task 4 (AD-062): the inquiry list function and the counts call.
--
-- smart_list_inquiries(filter, limit, offset, after) is the only place an inquiry list is
-- evaluated, with the same shape as smart_list_opportunities: SECURITY INVOKER plus an explicit
-- agency filter, a page plus `total_count` (before paging and before p_after) and each row's
-- `sort_key` for p_after.
--
-- Filter keys (unknown keys are ignored; Zod refuses them before saving):
--   status[] (absent = every status, as the inquiry list shows today), assigned_to (me |
--   unassigned | <user id>), source_id[], search (caller name, phone, email or subject, `%` and
--   `_` literal), sort (received_desc | received_asc).
-- received_desc breaks ties by id descending (as the inquiry list always has); received_asc by
-- id ascending.
--
-- smart_list_counts(lists) answers the overview in one call: [{ key, entity, filter }] in,
-- (key, count) out, each count capped at 1000 (shown as "999+"). It calls the list functions, so
-- a count can never differ from its list's total_count.

CREATE FUNCTION smart_list_inquiries(
  p_filter  JSONB,
  p_limit   INT   DEFAULT 20,
  p_offset  INT   DEFAULT 0,
  p_after   JSONB DEFAULT NULL
)
RETURNS TABLE (
  id                 UUID,
  agency_id          UUID,
  source_id          UUID,
  source_description TEXT,
  contact_id         UUID,
  opportunity_id     UUID,
  assigned_to        UUID,
  status             TEXT,
  caller_name        TEXT,
  caller_phone       TEXT,
  caller_email       TEXT,
  subject            TEXT,
  description        TEXT,
  raw_payload        JSONB,
  external_ref       TEXT,
  dismissed_reason   TEXT,
  received_at        TIMESTAMPTZ,
  created_by         UUID,
  created_at         TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ,
  import_job_id      UUID,
  joined_at          TIMESTAMPTZ,
  sort_key           JSONB,
  total_count        BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH f AS (
    SELECT
      smart_list_text_array(j->'status') AS statuses,
      smart_list_text_array(j->'source_id') AS source_txt,
      smart_list_uuid_array(j->'source_id') AS source_ids,
      j->>'assigned_to' AS assigned,
      -- LIKE wildcards in the search are literal characters.
      '%' || replace(replace(replace(NULLIF(btrim(j->>'search'), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS pattern,
      COALESCE(j->>'sort' = 'received_asc', false) AS ascending,
      CASE WHEN jsonb_typeof(p_after->0) = 'number' THEN (p_after->>0)::NUMERIC END AS after_k,
      smart_list_uuid(p_after->>1) AS after_id
    FROM (SELECT COALESCE(p_filter, '{}'::JSONB) AS j) AS src
  ),
  base AS (
    SELECT
      i AS inq,
      -- Ascending on k1; received_desc stores the negated position.
      CASE WHEN f.ascending THEN smart_list_us(i.received_at) ELSE -smart_list_us(i.received_at) END AS k1,
      NOT f.ascending AS id_desc,
      f.after_k,
      f.after_id
    FROM inquiries i
    CROSS JOIN f
    WHERE i.agency_id = current_agency_id()
      AND (cardinality(f.statuses) = 0 OR i.status = ANY (f.statuses))
      AND (cardinality(f.source_txt) = 0 OR i.source_id = ANY (f.source_ids))
      AND (f.assigned IS NULL
           OR (f.assigned = 'me' AND i.assigned_to = (SELECT auth.uid()))
           OR (f.assigned = 'unassigned' AND i.assigned_to IS NULL)
           OR (f.assigned NOT IN ('me', 'unassigned') AND i.assigned_to = smart_list_uuid(f.assigned)))
      AND (f.pattern IS NULL
           OR i.caller_name ILIKE f.pattern OR i.caller_phone ILIKE f.pattern
           OR i.caller_email ILIKE f.pattern OR i.subject ILIKE f.pattern)
  ),
  counted AS (
    SELECT b.*, count(*) OVER () AS total
    FROM base b
  )
  SELECT
    (c.inq).id, (c.inq).agency_id, (c.inq).source_id, (c.inq).source_description,
    (c.inq).contact_id, (c.inq).opportunity_id, (c.inq).assigned_to, (c.inq).status,
    (c.inq).caller_name, (c.inq).caller_phone, (c.inq).caller_email, (c.inq).subject,
    (c.inq).description, (c.inq).raw_payload, (c.inq).external_ref, (c.inq).dismissed_reason,
    (c.inq).received_at, (c.inq).created_by, (c.inq).created_at, (c.inq).updated_at,
    (c.inq).import_job_id, (c.inq).joined_at,
    jsonb_build_array(c.k1, (c.inq).id),
    c.total
  FROM counted c
  WHERE p_after IS NULL
     OR (c.k1 > c.after_k
         OR (c.k1 = c.after_k
             AND CASE WHEN c.id_desc THEN (c.inq).id < c.after_id ELSE (c.inq).id > c.after_id END))
  ORDER BY
    c.k1,
    CASE WHEN c.id_desc THEN NULL ELSE (c.inq).id END ASC,
    CASE WHEN c.id_desc THEN (c.inq).id END DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;

CREATE FUNCTION smart_list_counts(p_lists JSONB)
RETURNS TABLE (key TEXT, count INT)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item  JSONB;
  v_total BIGINT;
BEGIN
  IF jsonb_typeof(p_lists) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'smartLists.errors.invalidLists';
  END IF;
  -- 9 built-in lists plus at most 50 saved ones, with room to spare.
  IF jsonb_array_length(p_lists) > 100 THEN
    RAISE EXCEPTION 'smartLists.errors.tooManyLists';
  END IF;

  FOR v_item IN SELECT e FROM jsonb_array_elements(p_lists) AS e LOOP
    IF v_item->>'entity' = 'opportunity' THEN
      SELECT max(o.total_count) INTO v_total
      FROM smart_list_opportunities(v_item->'filter', 1, 0, NULL) AS o;
    ELSIF v_item->>'entity' = 'inquiry' THEN
      SELECT max(i.total_count) INTO v_total
      FROM smart_list_inquiries(v_item->'filter', 1, 0, NULL) AS i;
    ELSE
      RAISE EXCEPTION 'smartLists.errors.invalidEntity';
    END IF;

    key := v_item->>'key';
    count := LEAST(COALESCE(v_total, 0), 1000)::INT;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION smart_list_inquiries(JSONB, INT, INT, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION smart_list_counts(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION smart_list_inquiries(JSONB, INT, INT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION smart_list_counts(JSONB) TO authenticated;
