-- spec: properties, Task 16 (cut 2). ⌘K finds properties by code, address, area and settlement.
-- Same approach as the other search vectors (AD-026): a weighted tsvector with the 'simple'
-- config, kept by triggers, with a GIN index.

ALTER TABLE properties ADD COLUMN search_vector tsvector;

-- Code first, then the address and area, then the settlement in both languages.
CREATE OR REPLACE FUNCTION public.property_search_vector(
  p_code INT,
  p_address TEXT,
  p_settlement_id UUID,
  p_area_id UUID
)
RETURNS tsvector
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    setweight(to_tsvector('simple', coalesce(p_code::TEXT, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(p_address, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce((SELECT name FROM areas WHERE id = p_area_id), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(
      (SELECT name_bg || ' ' || name_en FROM settlements WHERE id = p_settlement_id), '')), 'C')
$$;

REVOKE EXECUTE ON FUNCTION public.property_search_vector(INT, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.properties_search_vector_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := property_search_vector(NEW.code, NEW.address, NEW.settlement_id, NEW.area_id);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.properties_search_vector_update() FROM PUBLIC, anon, authenticated;

-- Named to run after trg_assign_property_code, which sets the code on insert.
CREATE TRIGGER trg_property_search_vector
  BEFORE INSERT OR UPDATE OF code, address, settlement_id, area_id ON properties
  FOR EACH ROW EXECUTE FUNCTION properties_search_vector_update();

-- Renaming an area rewrites the vectors of its properties. SECURITY DEFINER so a rename
-- reaches every property in the area, whoever is responsible for it; scoped to the area's
-- own agency. The properties' updated_at moves with it.
CREATE OR REPLACE FUNCTION public.areas_search_vector_cascade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE properties
  SET search_vector = property_search_vector(code, address, settlement_id, area_id)
  WHERE agency_id = NEW.agency_id AND area_id = NEW.id;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.areas_search_vector_cascade() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_areas_search_vector_cascade
  AFTER UPDATE OF name ON areas
  FOR EACH ROW WHEN (NEW.name IS DISTINCT FROM OLD.name)
  EXECUTE FUNCTION areas_search_vector_cascade();

CREATE INDEX idx_properties_search_vector ON properties USING GIN (search_vector);

-- Backfill.
UPDATE properties SET search_vector = property_search_vector(code, address, settlement_id, area_id);
