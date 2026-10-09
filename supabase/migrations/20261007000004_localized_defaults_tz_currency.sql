-- 1. Locale-aware seeding (AD-033)
DROP FUNCTION IF EXISTS seed_agency_defaults(uuid);
CREATE OR REPLACE FUNCTION seed_agency_defaults(p_agency_id uuid, p_locale text DEFAULT 'bg')
RETURNS VOID AS $$
BEGIN
  IF p_locale = 'en' THEN
    -- English defaults
    INSERT INTO lead_sources (agency_id, name, channel, sort_order) VALUES
      (p_agency_id, 'Imot.bg',         'portal',   1),
      (p_agency_id, 'OLX',             'portal',   2),
      (p_agency_id, 'Agency Website',  'website',  3),
      (p_agency_id, 'Phone Call',      'phone',    4),
      (p_agency_id, 'Walk-in',         'walk_in',  5),
      (p_agency_id, 'Referral',        'referral', 6),
      (p_agency_id, 'Social Media',    'social',   7),
      (p_agency_id, 'Email',           'email',    8),
      (p_agency_id, 'Other',           'other',    9);

    INSERT INTO stages (agency_id, name, sort_order, is_terminal, terminal_type) VALUES
      (p_agency_id, 'New',                 1,  false, NULL),
      (p_agency_id, 'Attempting Contact',  2,  false, NULL),
      (p_agency_id, 'Qualified',           3,  false, NULL),
      (p_agency_id, 'Active',              4,  false, NULL),
      (p_agency_id, 'Viewing',             5,  false, NULL),
      (p_agency_id, 'Offer',               6,  false, NULL),
      (p_agency_id, 'Negotiation',         7,  false, NULL),
      (p_agency_id, 'Won',                 8,  true,  'won'),
      (p_agency_id, 'Lost',                9,  true,  'lost'),
      (p_agency_id, 'Nurture',             10, true,  'nurture');
  ELSE
    -- Bulgarian defaults
    INSERT INTO lead_sources (agency_id, name, channel, sort_order) VALUES
      (p_agency_id, 'Imot.bg',            'portal',   1),
      (p_agency_id, 'OLX',                'portal',   2),
      (p_agency_id, 'Сайт на агенцията',  'website',  3),
      (p_agency_id, 'Телефонно обаждане', 'phone',    4),
      (p_agency_id, 'На място',           'walk_in',  5),
      (p_agency_id, 'Препоръка',          'referral', 6),
      (p_agency_id, 'Социални мрежи',     'social',   7),
      (p_agency_id, 'Имейл',              'email',    8),
      (p_agency_id, 'Друго',              'other',    9);

    INSERT INTO stages (agency_id, name, sort_order, is_terminal, terminal_type) VALUES
      (p_agency_id, 'Нов',                1,  false, NULL),
      (p_agency_id, 'Опит за контакт',    2,  false, NULL),
      (p_agency_id, 'Квалифициран',       3,  false, NULL),
      (p_agency_id, 'Активен',            4,  false, NULL),
      (p_agency_id, 'Оглед',              5,  false, NULL),
      (p_agency_id, 'Оферта',             6,  false, NULL),
      (p_agency_id, 'Преговори',          7,  false, NULL),
      (p_agency_id, 'Спечелена',          8,  true,  'won'),
      (p_agency_id, 'Загубена',           9,  true,  'lost'),
      (p_agency_id, 'За поддържане',      10, true,  'nurture');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke execute from public to harden security (matches 5.1 changes)
REVOKE EXECUTE ON FUNCTION seed_agency_defaults(uuid, text) FROM PUBLIC, authenticated, anon;

-- Update create_agency_with_owner to pass locale
CREATE OR REPLACE FUNCTION public.create_agency_with_owner(
  p_agency_name text, p_locale text DEFAULT 'bg'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    uuid := (SELECT auth.uid());
  v_agency uuid;
  v_base   text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF EXISTS (SELECT 1 FROM agency_memberships WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'already_member' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(trim(p_agency_name)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'invalid_agency_name' USING ERRCODE = '22023';
  END IF;
  -- Cyrillic names strip to '' → fall back to 'agency'
  v_base := coalesce(nullif(trim(both '-' from regexp_replace(lower(p_agency_name), '[^a-z0-9]+', '-', 'g')), ''), 'agency');
  INSERT INTO agencies (name, slug)
    VALUES (trim(p_agency_name), v_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
    RETURNING id INTO v_agency;
  INSERT INTO agency_memberships (user_id, agency_id, role, status, joined_at)
    VALUES (v_uid, v_agency, 'owner', 'active', now());
  PERFORM seed_agency_defaults(v_agency, p_locale);
  RETURN v_agency;
END $$;

-- Revoke execute from public to harden security (matches 5.1 changes)
REVOKE EXECUTE ON FUNCTION create_agency_with_owner(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_agency_with_owner(text, text) TO authenticated;


-- 2. Agency settings defaults (AD-037)
UPDATE agencies
   SET settings = jsonb_build_object('timezone', 'Europe/Sofia', 'default_currency', 'EUR')
                  || coalesce(settings, '{}'::jsonb)
 WHERE NOT (coalesce(settings, '{}'::jsonb) ? 'timezone');

-- 3. Currency default for new opportunities (existing values untouched)
ALTER TABLE opportunities ALTER COLUMN currency SET DEFAULT 'EUR';
