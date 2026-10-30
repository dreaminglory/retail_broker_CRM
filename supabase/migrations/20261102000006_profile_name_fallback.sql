-- 20261102000006_profile_name_fallback.sql
-- trustworthy-loop, Task 12 (AC-10, FR-PRF-03): sign-up sends `full_name`, but the trigger
-- only read `display_name`, so every new profile was named after the email prefix.
-- Existing profiles are left as they are.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(BTRIM(NEW.raw_user_meta_data->>'display_name'), ''),
      NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(BTRIM(CONCAT_WS(' ',
        BTRIM(NEW.raw_user_meta_data->>'first_name'),
        BTRIM(NEW.raw_user_meta_data->>'last_name')
      )), ''),
      split_part(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$;
