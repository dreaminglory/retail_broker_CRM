-- 20261109000007_property_address_key_numbers.sql
-- spec: property-import, rule 4, Checkpoint 3 review fix (AD-064). The address key removed every
-- space, so `ул. Яворов 1, 23` and `ул. Яворов 12, 3` both became `яворов123`: the second
-- property was a duplicate and, under the default `skip`, never imported. Two numbers the
-- address keeps apart (by a comma, a space or other punctuation) are now joined by `/`
-- (`яворов1/23`); everything else is unchanged: `ул Яворов 12 ет 3` is still `яворов12ет3`.
--
-- A stored generated column isn't recomputed when its function changes, so `address_key` is
-- dropped and added again (it is derived only: nothing is lost), with its index.

CREATE OR REPLACE FUNCTION public.property_address_key(p_address TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT NULLIF(
    pg_catalog.regexp_replace(
      pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          ' ' || pg_catalog.regexp_replace(
            pg_catalog.lower(p_address),
            '[[:punct:]№„“”«»‘’–—]+', ' ', 'g'
          ) || ' ',
          '\s(ул|улица|бул|булевард|жк|ж\s+к)(?=\s)', ' ', 'g'
        ),
        '(\d)\s+(?=\d)', '\1/', 'g'
      ),
      '\s+', '', 'g'
    ),
    ''
  );
$$;

REVOKE EXECUTE ON FUNCTION public.property_address_key(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.property_address_key(TEXT) TO authenticated;

ALTER TABLE properties DROP COLUMN address_key;
ALTER TABLE properties
  ADD COLUMN address_key TEXT GENERATED ALWAYS AS (public.property_address_key(address)) STORED;

CREATE INDEX idx_properties_agency_address_key
  ON properties (agency_id, settlement_id, address_key) WHERE address_key IS NOT NULL;
