-- 20261109000003_import_commit_properties.sql
-- spec: property-import, Task 5 (AD-064). The batch commit for property jobs. Each row is
-- written in its own BEGIN … EXCEPTION block, so a row is all or nothing (AD-050): its new
-- area, its new owner contact, the property, its listings and its owner party either all
-- exist afterwards or none do, and the row is `error`.
--
-- Rows come from validation with every id resolved (`normalized`):
--   { property: { type, rooms, …, settlement_id, area_id, address, assigned_to, external_ref },
--     new_area: { settlement_id, name, key } | null,
--     listings: [{ offer_type, price, status, listed_at }],
--     owner_contact_id | null, new_owner: { first_name, last_name, phone, email } | null }
-- Under the `create` strategy, `duplicate` rows are committed too; under `skip` they stay.
-- `options.create_areas` lists the kept new-area keys; absent means every new area is kept.

CREATE OR REPLACE FUNCTION public.import_commit_properties(p_job_id UUID, p_limit INT DEFAULT 200)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_job          import_jobs%ROWTYPE;
  v_row          import_rows%ROWTYPE;
  v_user         UUID := (SELECT auth.uid());
  v_strategy     TEXT;
  v_create_areas JSONB;
  v_n            JSONB;
  v_p            JSONB;
  v_new_area     JSONB;
  v_new_owner    JSONB;
  v_listing      JSONB;
  v_existing     UUID;
  v_area_id      UUID;
  v_contact_id   UUID;
  v_property_id  UUID;
  v_phone        TEXT;
  v_email        TEXT;
  v_processed    INT := 0;
  v_remaining    INT := 0;
BEGIN
  -- ── Guards (as import_commit_contacts) ──
  SELECT * INTO v_job FROM import_jobs WHERE id = p_job_id FOR UPDATE;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  IF v_job.agency_id IS DISTINCT FROM current_agency_id() THEN
    RAISE EXCEPTION 'Unauthorized agency';
  END IF;
  IF current_user_role() IS NULL OR current_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized role';
  END IF;
  IF v_job.entity_type <> 'property' THEN
    RAISE EXCEPTION 'Job is not a property import';
  END IF;
  IF v_job.status NOT IN ('validated', 'committing') THEN
    RAISE EXCEPTION 'Job is not in a committable state';
  END IF;

  IF v_job.status = 'validated' THEN
    UPDATE import_jobs SET status = 'committing' WHERE id = p_job_id;
  END IF;

  v_strategy := COALESCE(v_job.options ->> 'duplicate_strategy', 'skip');
  v_create_areas := v_job.options -> 'create_areas';

  FOR v_row IN
    SELECT * FROM import_rows
    WHERE import_job_id = p_job_id
      AND (status = 'valid' OR (status = 'duplicate' AND v_strategy = 'create'))
    ORDER BY row_number
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      v_n := v_row.normalized;
      v_p := v_n -> 'property';

      -- 1. Authoritative re-check (db_recheck). An external_ref match always skips; an
      --    address match skips unless the job creates duplicates.
      v_existing := NULL;
      IF v_p ->> 'external_ref' IS NOT NULL THEN
        SELECT id INTO v_existing FROM properties
        WHERE agency_id = v_job.agency_id AND external_ref = v_p ->> 'external_ref';
      END IF;
      IF v_existing IS NULL AND v_strategy <> 'create' THEN
        SELECT id INTO v_existing FROM properties
        WHERE agency_id = v_job.agency_id
          AND settlement_id = (v_p ->> 'settlement_id')::UUID
          AND address_key = property_address_key(v_p ->> 'address')
        ORDER BY code
        LIMIT 1;
      END IF;

      IF v_existing IS NOT NULL THEN
        UPDATE import_rows
        SET status = 'skipped', match_reason = 'db_recheck', matched_entity_id = v_existing
        WHERE id = v_row.id;
      ELSE
        -- 2. Area: the resolved one, or a kept new area shared by every row that names it.
        v_area_id := NULLIF(v_p ->> 'area_id', '')::UUID;
        v_new_area := v_n -> 'new_area';
        IF jsonb_typeof(v_new_area) = 'object'
           AND (v_create_areas IS NULL OR v_create_areas ? (v_new_area ->> 'key')) THEN
          INSERT INTO areas (agency_id, settlement_id, name, import_job_id)
          VALUES (v_job.agency_id, (v_new_area ->> 'settlement_id')::UUID, v_new_area ->> 'name', p_job_id)
          ON CONFLICT DO NOTHING;

          SELECT id INTO v_area_id FROM areas
          WHERE agency_id = v_job.agency_id
            AND settlement_id = (v_new_area ->> 'settlement_id')::UUID
            AND lower(name) = lower(v_new_area ->> 'name');
        END IF;

        -- 3. Owner: matched at validation, or re-matched by phone then email now, so two
        --    rows with the same new owner share the contact the first one created.
        v_contact_id := NULLIF(v_n ->> 'owner_contact_id', '')::UUID;
        v_new_owner := v_n -> 'new_owner';
        IF v_contact_id IS NULL AND jsonb_typeof(v_new_owner) = 'object' THEN
          v_phone := NULLIF(v_new_owner ->> 'phone', '');
          v_email := NULLIF(v_new_owner ->> 'email', '');

          IF v_phone IS NOT NULL THEN
            SELECT contact_id INTO v_contact_id FROM contact_methods
            WHERE agency_id = v_job.agency_id AND type = 'phone' AND value = v_phone
            ORDER BY created_at LIMIT 1;
          END IF;
          IF v_contact_id IS NULL AND v_email IS NOT NULL THEN
            SELECT contact_id INTO v_contact_id FROM contact_methods
            WHERE agency_id = v_job.agency_id AND type = 'email' AND value = v_email
            ORDER BY created_at LIMIT 1;
          END IF;

          IF v_contact_id IS NULL THEN
            INSERT INTO contacts (agency_id, type, first_name, last_name, display_name, created_by, import_job_id)
            VALUES (
              v_job.agency_id, 'person',
              v_new_owner ->> 'first_name', NULLIF(v_new_owner ->> 'last_name', ''),
              trim(COALESCE(v_new_owner ->> 'first_name', '') || ' ' || COALESCE(v_new_owner ->> 'last_name', '')),
              v_user, p_job_id
            )
            RETURNING id INTO v_contact_id;

            IF v_phone IS NOT NULL THEN
              INSERT INTO contact_methods (agency_id, contact_id, type, value, is_primary)
              VALUES (v_job.agency_id, v_contact_id, 'phone', v_phone, TRUE);
            END IF;
            IF v_email IS NOT NULL THEN
              INSERT INTO contact_methods (agency_id, contact_id, type, value, is_primary)
              VALUES (v_job.agency_id, v_contact_id, 'email', v_email, v_phone IS NULL);
            END IF;
          END IF;
        END IF;

        -- 4. The property (code from the agency counter, in file order), its listings and
        --    its owner party, all carrying the job id.
        INSERT INTO properties (
          agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction,
          year_built, settlement_id, area_id, address, location_note, assigned_to, description,
          external_ref, created_by, import_job_id
        ) VALUES (
          v_job.agency_id, 0,
          v_p ->> 'type',
          (v_p ->> 'rooms')::SMALLINT,
          (v_p ->> 'area_m2')::NUMERIC,
          (v_p ->> 'plot_m2')::NUMERIC,
          (v_p ->> 'floor')::SMALLINT,
          (v_p ->> 'floors_total')::SMALLINT,
          v_p ->> 'construction',
          (v_p ->> 'year_built')::SMALLINT,
          (v_p ->> 'settlement_id')::UUID,
          v_area_id,
          v_p ->> 'address',
          v_p ->> 'location_note',
          NULLIF(v_p ->> 'assigned_to', '')::UUID,
          v_p ->> 'description',
          v_p ->> 'external_ref',
          v_user,
          p_job_id
        )
        RETURNING id INTO v_property_id;

        FOR v_listing IN SELECT value FROM jsonb_array_elements(COALESCE(v_n -> 'listings', '[]'::JSONB))
        LOOP
          INSERT INTO listings (agency_id, property_id, offer_type, price, status, listed_at, closed_at, created_by, import_job_id)
          VALUES (
            v_job.agency_id, v_property_id,
            v_listing ->> 'offer_type',
            (v_listing ->> 'price')::NUMERIC,
            COALESCE(v_listing ->> 'status', 'active'),
            COALESCE((v_listing ->> 'listed_at')::TIMESTAMPTZ, now()),
            CASE WHEN v_listing ->> 'status' IN ('closed', 'withdrawn') THEN now() END,
            v_user, p_job_id
          );
        END LOOP;

        IF v_contact_id IS NOT NULL THEN
          INSERT INTO property_parties (agency_id, property_id, contact_id, role, created_by, import_job_id)
          VALUES (v_job.agency_id, v_property_id, v_contact_id, 'owner', v_user, p_job_id);
        END IF;

        -- 5. Done.
        UPDATE import_rows SET status = 'created', entity_id = v_property_id WHERE id = v_row.id;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      UPDATE import_rows
      SET status = 'error',
          errors = jsonb_build_array(jsonb_build_object('code', 'import.errors.dbWrite', 'detail', SQLERRM))
      WHERE id = v_row.id;
    END;
    v_processed := v_processed + 1;
  END LOOP;

  UPDATE import_jobs
  SET valid_count     = (SELECT count(*) FROM import_rows WHERE import_job_id = p_job_id AND status = 'valid'),
      invalid_count   = (SELECT count(*) FROM import_rows WHERE import_job_id = p_job_id AND status = 'invalid'),
      duplicate_count = (SELECT count(*) FROM import_rows WHERE import_job_id = p_job_id AND status = 'duplicate'),
      created_count   = (SELECT count(*) FROM import_rows WHERE import_job_id = p_job_id AND status = 'created'),
      skipped_count   = (SELECT count(*) FROM import_rows WHERE import_job_id = p_job_id AND status = 'skipped'),
      error_count     = (SELECT count(*) FROM import_rows WHERE import_job_id = p_job_id AND status = 'error')
  WHERE id = p_job_id;

  SELECT count(*) INTO v_remaining FROM import_rows
  WHERE import_job_id = p_job_id
    AND (status = 'valid' OR (status = 'duplicate' AND v_strategy = 'create'));

  IF v_remaining = 0 THEN
    UPDATE import_jobs SET status = 'completed', completed_at = now() WHERE id = p_job_id;
  END IF;

  RETURN jsonb_build_object('processed', v_processed, 'remaining', v_remaining);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.import_commit_properties(UUID, INT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.import_commit_properties(UUID, INT) TO authenticated;
