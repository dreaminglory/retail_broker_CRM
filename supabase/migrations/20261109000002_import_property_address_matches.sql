-- 20261109000002_import_property_address_matches.sql
-- spec: property-import, Task 4 (AD-064). Validation asks the database for each row's address
-- key and the caller's agency's existing property with that key in the same settlement, so
-- the one address rule (property_address_key) never gets a TypeScript copy.
--
-- p_items: [{ "row": 3, "settlement_id": "…", "address": "ул. Яворов 12" }, …]
-- Returns one row per item whose address has a key; property_id is NULL when nothing matches.
-- Items without an address, or with a blank one, are left out: they are never duplicates.

CREATE OR REPLACE FUNCTION public.import_property_address_matches(p_items JSONB)
RETURNS TABLE (row_index INT, address_key TEXT, property_id UUID)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    (item ->> 'row')::INT,
    k.key,
    (
      SELECT p.id
      FROM properties p
      WHERE p.agency_id = current_agency_id()
        AND p.settlement_id = (item ->> 'settlement_id')::UUID
        AND p.address_key = k.key
      ORDER BY p.code
      LIMIT 1
    )
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB)) AS item
  CROSS JOIN LATERAL (SELECT property_address_key(item ->> 'address') AS key) AS k
  WHERE k.key IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.import_property_address_matches(JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.import_property_address_matches(JSONB) TO authenticated;
