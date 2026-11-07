-- smart-lists, Task 5 (AD-062): a count never needs the list's sort, so smart_list_counts drops
-- it before asking the list function. The new-matches preset sorts by new_matches_desc, which
-- makes the list function count the matches of every deal (57 s at 2,000 deals); without the
-- sort the same count stops at each deal's first match (0.9 s). The number is the same either way.

CREATE OR REPLACE FUNCTION smart_list_counts(p_lists JSONB)
RETURNS TABLE (key TEXT, count INT)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item   JSONB;
  v_filter JSONB;
  v_total  BIGINT;
BEGIN
  IF jsonb_typeof(p_lists) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'smartLists.errors.invalidLists';
  END IF;
  -- 9 built-in lists plus at most 50 saved ones, with room to spare.
  IF jsonb_array_length(p_lists) > 100 THEN
    RAISE EXCEPTION 'smartLists.errors.tooManyLists';
  END IF;

  FOR v_item IN SELECT e FROM jsonb_array_elements(p_lists) AS e LOOP
    -- A filter that is not an object has no keys to drop; the list function treats it as empty.
    v_filter := CASE WHEN jsonb_typeof(v_item->'filter') = 'object' THEN (v_item->'filter') - 'sort'::TEXT ELSE v_item->'filter' END;

    IF v_item->>'entity' = 'opportunity' THEN
      SELECT max(o.total_count) INTO v_total
      FROM smart_list_opportunities(v_filter, 1, 0, NULL) AS o;
    ELSIF v_item->>'entity' = 'inquiry' THEN
      SELECT max(i.total_count) INTO v_total
      FROM smart_list_inquiries(v_filter, 1, 0, NULL) AS i;
    ELSE
      RAISE EXCEPTION 'smartLists.errors.invalidEntity';
    END IF;

    key := v_item->>'key';
    count := LEAST(COALESCE(v_total, 0), 1000)::INT;
    RETURN NEXT;
  END LOOP;
END;
$$;
