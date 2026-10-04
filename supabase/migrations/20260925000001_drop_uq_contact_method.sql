-- Drop the unique constraint on contact methods so that users can 
-- bypass duplicate detection and share phone numbers/emails across contacts.
-- (e.g. Spouses sharing a home phone, or colleagues sharing an office line)

ALTER TABLE contact_methods
DROP CONSTRAINT IF EXISTS uq_contact_method_per_agency;
