-- Enable the pg_trgm extension for fuzzy string matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add a trigram index on the contacts.display_name column to speed up ILIKE and similarity searches
CREATE INDEX IF NOT EXISTS idx_contacts_display_name_trgm 
ON public.contacts USING GIN (display_name gin_trgm_ops);

-- Add a GIN index on contact_methods.value to speed up exact lookups for phone and email
CREATE INDEX IF NOT EXISTS idx_contact_methods_value 
ON public.contact_methods USING GIN (value gin_trgm_ops);
