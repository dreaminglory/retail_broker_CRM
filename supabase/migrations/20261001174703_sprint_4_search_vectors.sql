-- Add search_vector to contacts
ALTER TABLE public.contacts ADD COLUMN search_vector tsvector;

-- Create trigger function for contacts
CREATE OR REPLACE FUNCTION public.contacts_search_vector_update()
RETURNS trigger AS $$
DECLARE
  methods_text text;
BEGIN
  SELECT string_agg(value, ' ') INTO methods_text
  FROM public.contact_methods
  WHERE contact_id = NEW.id;

  NEW.search_vector := 
    setweight(to_tsvector('simple', coalesce(NEW.display_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.first_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.last_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.company_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(methods_text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for contacts
CREATE TRIGGER contacts_search_vector_trigger
  BEFORE INSERT OR UPDATE OF first_name, last_name, company_name, display_name
  ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.contacts_search_vector_update();

-- Create trigger function for contact_methods to update parent contact
CREATE OR REPLACE FUNCTION public.contact_methods_search_vector_update()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.contacts SET display_name = display_name WHERE id = OLD.contact_id;
  ELSE
    UPDATE public.contacts SET display_name = display_name WHERE id = NEW.contact_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for contact_methods
CREATE TRIGGER contact_methods_search_vector_trigger
  AFTER INSERT OR UPDATE OF value OR DELETE
  ON public.contact_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.contact_methods_search_vector_update();

-- Create GIN index for contacts
CREATE INDEX contacts_search_vector_idx ON public.contacts USING GIN (search_vector);

-- Add search_vector to opportunities
ALTER TABLE public.opportunities ADD COLUMN search_vector tsvector;

-- Create trigger function for opportunities
CREATE OR REPLACE FUNCTION public.opportunities_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for opportunities
CREATE TRIGGER opportunities_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title
  ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.opportunities_search_vector_update();

-- Create GIN index for opportunities
CREATE INDEX opportunities_search_vector_idx ON public.opportunities USING GIN (search_vector);

-- Add search_vector to inquiries
ALTER TABLE public.inquiries ADD COLUMN search_vector tsvector;

-- Create trigger function for inquiries
CREATE OR REPLACE FUNCTION public.inquiries_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('simple', coalesce(NEW.caller_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.caller_phone, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.caller_email, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for inquiries
CREATE TRIGGER inquiries_search_vector_trigger
  BEFORE INSERT OR UPDATE OF caller_name, subject, caller_phone, caller_email
  ON public.inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.inquiries_search_vector_update();

-- Create GIN index for inquiries
CREATE INDEX inquiries_search_vector_idx ON public.inquiries USING GIN (search_vector);

-- Backfill data (this will trigger the triggers and set search_vector)
UPDATE public.contacts SET id = id;
UPDATE public.opportunities SET id = id;
UPDATE public.inquiries SET id = id;
