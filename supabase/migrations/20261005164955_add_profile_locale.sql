ALTER TABLE profiles
  ADD COLUMN locale TEXT NOT NULL DEFAULT 'bg'
  CHECK (locale IN ('bg', 'en'));