# Tasks: property-import

> **Plan:** `tasks/plan.md` · **Spec:** `spec/property-import.md`
> Every task also clears the Definition of Done in `AGENTS.md`. Tick a task only after that.
> Migrations: the next free timestamps after `20261108000008`, in order (`20261109000001`…).
> pgTAP: `100-property-import.sql` (schema, address key, audit), `101-property-import-commit.sql`,
> `102-property-import-revert.sql`.
> Fixtures: `src/domain/imports/__fixtures__/properties-*.csv`, fake data only.
> **Model:** each task names its model. If a Sonnet session finds it needs to change a migration,
> a policy or a SQL function, it stops and hands that part to Opus.

## Phase 1: Pipeline (no UI)

## Task 1: AD-064, schema, address key, audit metadata — **Opus**
**Description:** Mark `property-import` In progress in `SPEC.md`. Write AD-064 in
`docs/decisions-log.md` from the plan's architecture decisions. Add an FR-PIM section with
FR-PIM-01…10 to `docs/BRD.md`, marked not built (01 map and import, 02 attributes and location,
03 settlement resolution, 04 listings and BGN, 05 new areas, 06 owner, 07 duplicates and
idempotency, 08 matching right after import, 09 revert, 10 role and tenancy). Then write
migration `<ts>_property_import_schema.sql` per `supabase-patterns`:
- `import_jobs.entity_type` CHECK adds `property`; `import_rows.match_reason` CHECK adds `address`.
- `import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL` on `properties`, `listings`,
  `property_parties` and `areas`, each with a partial index `WHERE import_job_id IS NOT NULL`.
- `property_address_key(text) RETURNS text`, `LANGUAGE sql IMMUTABLE PARALLEL SAFE`.
- `properties.address_key` as a generated stored column, plus the index
  `(agency_id, settlement_id, address_key) WHERE address_key IS NOT NULL`.
- `audit_property_changes` and `audit_listing_changes` put `import_job_id` in the INSERT row's
  `metadata` when it is set. Their bodies are otherwise copied unchanged.

In `docs/domain-model.md`, update §2.5 (new entity type and columns) and the migration count.

**Acceptance criteria:**
- [x] pgTAP: `property_address_key` maps `ул. "Яворов" № 12, ет. 3` and `ул Яворов 12 ет 3` to the same key and returns null for blank text; the generated column fills in on insert and update.
- [x] pgTAP: a `property` job can be inserted; a property, listing, party and area take `import_job_id`; the property and listing `created` audit rows carry `import_job_id`, and a property made by hand has none.
- [x] Existing property, listing and timeline tests stay green. AD-064, the BRD rows and the domain-model edits are in the same commit.

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`
- [x] `npm run typecheck`, `npm run lint`, `npm run test`

**Dependencies:** None
**Files likely touched:** `SPEC.md`, `docs/decisions-log.md`, `docs/BRD.md`, `docs/domain-model.md`, `supabase/migrations/<ts>_property_import_schema.sql`, `supabase/tests/database/100-property-import.sql`
**Estimated scope:** M (the docs are edits only)

## Task 2: Parsers: header synonyms, value resolvers, row mapper — Sonnet
**Description:** Pure TypeScript, test-first.
- Pin today's contact and inquiry auto-mapping with a test, then change `detectHeaders` to take
  the entity and add `PROPERTY_HEADER_SYNONYMS` for every spec column (Bulgarian and English).
- Add `src/domain/imports/csv/property-resolvers.ts` with these resolvers:
  - `resolvePropertyType`: the type words, and `двустаен` … `многостаен` mapped to an apartment
    plus a room count.
  - `parseNumber`: `68,5`, `68.5 кв.м`, `1 200`.
  - `resolveFloor`: `партер` is 0, `сутерен` is −1.
  - `resolveConstruction`: unknown text becomes `other`.
  - `parsePrice`: `€185,000`, `185000 EUR`, `1 200 лв.`. It returns EUR plus a `converted` flag
    and uses `BGN_PER_EUR = 1.95583`, rounded to the cent.
  - `resolveListingStatus`.
  - `normalizeSettlementName`: strips `гр.`, `с.`, `град`, `село`.
  - `normalizeAreaName`.
- Add `mapRowToPropertyCandidate` in `row-mapper.ts`, and types in `types.ts`.
- Add `propertyMappingSchema` (requires `type` and `settlement`) and
  `propertyImportOptionsSchema` (`duplicate_strategy`, `default_assigned_to`, `date_format`,
  `create_areas: string[]`) in `validation.ts`. `createImportJobSchema` accepts `property`.

**Acceptance criteria:**
- [x] Contact and inquiry header mapping is unchanged (pinned test); a Bulgarian property header row maps every spec column.
- [x] Each resolver has table-driven tests for every example in the spec's Columns table, plus garbage input. `1 200 лв.` gives 613.55 with `converted: true`.
- [x] A row that is invalid for the property form is invalid here: the candidate goes through the property Zod schema from `src/domain/properties/validation.ts`, not a copy of it.

**Verification:**
- [x] `npx vitest run src/domain/imports`
- [x] `npm run typecheck`, `npm run lint`, `npm run test`

**Dependencies:** Task 1 (types for the new entity type)
**Files likely touched:** `src/domain/imports/csv/header-detection.ts`, `src/domain/imports/csv/property-resolvers.ts` (+ test), `src/domain/imports/csv/row-mapper.ts`, `src/domain/imports/types.ts`, `src/domain/imports/validation.ts`
**Estimated scope:** M

## Task 3: Validation: location, listings, assignee — Sonnet (Opus review)
**Description:** Add `ImportService.validateProperties`, a page loop like `validateInquiries`.
- Add `SettlementRepository.findByNamesOrCodes(names, codes)` and a pure
  `resolveSettlement(candidate, matches)` that returns `{ id } | { error, candidates }`.
- Areas are matched per settlement against `AreaRepository`, active and inactive. A name with no
  match becomes `new_area` in `normalized`.
- `assigned_to` goes through `resolveAssignee` (M3), defaulting to `options.default_assigned_to`,
  then the importer.
- Listings come from the prices plus `listing_status` and `listed_at` (`parseDate` with the job's
  date format).
- Row errors use the i18n codes `import.errors.settlementNotFound`, `settlementAmbiguous` (with
  the candidates' municipalities in `detail`), `invalidPrice`, `unknownAssignee`, and the
  property schema's own codes.

Duplicates and owners come in Task 4: in this task, every row that passes is `valid`.

**Acceptance criteria:**
- [ ] Unit: "Лозен" (several matches) is ambiguous with the municipalities listed; with municipality "Столична" it resolves; an EKATTE code resolves; an unknown name is not found; nothing is ever picked by order.
- [ ] Integration (local stack): a staged 20-row file validates with the right `settlement_id`, `area_id` or `new_area`, the listings, and `assigned_to`; three rows with an unknown "Витоша" all carry the same `new_area`; Beta's areas and members never match an Alpha job.
- [ ] Every new error code exists in `messages/bg.json` and `messages/en.json`.

**Verification:**
- [ ] `npx vitest run src/domain/imports`, `npm run test:services`
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`

**Dependencies:** Task 2
**Files likely touched:** `src/domain/imports/service.ts`, `src/domain/imports/property-validation.ts` (+ test), `src/domain/settlements/repository.ts`, `src/domain/imports/service.integration.test.ts`, `messages/bg.json`, `messages/en.json`
**Estimated scope:** M

## Task 4: Validation: duplicates and owners — **Opus**
**Description:** Migration `<ts>_import_property_address_matches.sql`:
- `import_property_address_matches(p_items jsonb)` is `LANGUAGE sql STABLE SECURITY INVOKER`,
  filters on `current_agency_id()`, is granted to `authenticated` and revoked from `anon`.
- It returns `row`, `address_key` and `property_id` for each item whose key matches an existing
  property in the same settlement.

In `validateProperties`:
- A matching `external_ref` makes the row `skipped` / `external_ref`, whether it matches an
  existing property or an earlier row in the file.
- Otherwise, an address match makes the row `duplicate` / `address`, or `duplicate` / `in_file`
  when it matches an earlier row with the same settlement and key.
- Owner: the phone is normalized with `normalizePhone()` and the email lowercased, then looked up
  with `lookupExistingMethods`. A match gives `owner_contact_id`; no match gives `new_owner`,
  whose name is split as in `mapRowToCandidate`. A name-only owner is always new. An owner phone
  that doesn't parse makes the row invalid with `import.errors.ownerPhoneInvalid`.
- The job counts gain `skipped_count` for `external_ref` skips.

**Acceptance criteria:**
- [ ] pgTAP: the address function finds Alpha's property for `ул Яворов 12` and never Beta's, refuses `anon`, and returns nothing for a blank address.
- [ ] Integration: re-validating an already imported file marks every row `skipped`; a row with an existing settlement and address is `duplicate`; two rows with the same address in one file make the second `in_file`; an owner phone that exists links that contact; an unparseable phone is invalid.
- [ ] An address duplicate never fires across different settlements, or for rows without an address.

**Verification:**
- [ ] `npx supabase db reset` then `npm run test:db`; `npm run test:services`
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`

**Dependencies:** Tasks 1, 3
**Files likely touched:** `supabase/migrations/<ts>_import_property_address_matches.sql`, `supabase/tests/database/100-property-import.sql`, `src/domain/imports/service.ts`, `src/domain/imports/repository.ts`, `src/domain/imports/service.integration.test.ts`
**Estimated scope:** M

## Task 5: `import_commit_properties` — **Opus**
**Description:** Migration `<ts>_import_commit_properties.sql`:
`import_commit_properties(p_job_id UUID, p_limit INT DEFAULT 200) RETURNS JSONB` is `plpgsql`
and `SECURITY INVOKER`. It has the same guards as `import_commit_contacts`: agency, owner or
manager, job status, `SKIP LOCKED`, and the move to `committing`. It is granted to
`authenticated` and revoked from `anon`. Each `valid` row runs inside its own `BEGIN … EXCEPTION`
block:
1. **Re-check duplicates.** An `external_ref` match always skips the row. An address match skips
   it under `skip`. Either way the row becomes `skipped` / `db_recheck`.
2. **Area.** When the row has a `new_area` whose key is in `options.create_areas`, insert it with
   `ON CONFLICT DO NOTHING` and the job id, then select its id. A `new_area` that isn't kept means
   no area.
3. **Owner.** Re-match the owner by phone, then email. If nothing matches, create the person
   contact and its `contact_methods`, with `import_job_id`.
4. **Write.** Insert the property with `import_job_id` and `created_by` set to the caller, its
   listings (`closed_at` = now for closed or withdrawn), and an `owner` party.
5. **Finish the row.** It becomes `created` with `entity_id` = the property.

At `remaining = 0` the job becomes `completed` with its counts. The service's `commitBatch` routes
`property` jobs here.

**Acceptance criteria:**
- [ ] pgTAP: one call commits the fixture rows; a row whose listing insert fails (forced) leaves no property, area, contact or party and becomes `error`; a broker and `anon` are refused; another agency's job is refused.
- [ ] pgTAP or integration: two rows with the same new owner phone create one contact with two parties; two rows with the same new area create one area; an unticked area imports its rows without one; a second commit of the same file creates nothing.
- [ ] Property codes follow file order; audit rows exist for each property and listing with the job id; no app code writes `audit_log`.

**Verification:**
- [ ] `npx supabase db reset` then `npm run test:db`; `npm run test:services`
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`

**Dependencies:** Tasks 1, 4
**Files likely touched:** `supabase/migrations/<ts>_import_commit_properties.sql`, `supabase/tests/database/101-property-import-commit.sql`, `src/domain/imports/repository.ts`, `src/domain/imports/service.ts`, `src/domain/imports/service.integration.test.ts`
**Estimated scope:** M

## Task 6: Revert for property jobs — **Opus**
**Description:** Migration `<ts>_import_revert_properties.sql`: `CREATE OR REPLACE` of
`import_revert`, keeping the guards, the contact rule and the inquiry branch as they are. For
`property` jobs it works in this order:
1. Delete the job's properties that nobody has touched (the plan's definition). Their listings
   and parties cascade.
2. Apply the existing contact rule to the job's contacts.
3. Delete the job's areas that no property and no `requirement_locations` row uses.

Rows are marked `reverted` or `revert_skipped`. The result gains `properties` and `areas` in both
`deleted` and `kept`. `RevertResult` in `types.ts` is updated. `docs/domain-model.md` §3.5 and M2
are updated, and M4 is added: a property revert never deletes a worked-on property, owner or used
area.

**Acceptance criteria:**
- [ ] pgTAP, one kept case per kind of work: an edit, a note, a task, a candidate link, a new listing, a price change, an added or ended party, and an archive each keep the property, and its owner is kept too; untouched properties, their listings and parties, their owners and their unused areas are deleted.
- [ ] An owner contact that existed before the import is never deleted. An area that a kept property or a requirement uses is kept.
- [ ] A contact and an inquiry job revert exactly as before (existing pgTAP and integration tests green).

**Verification:**
- [ ] `npx supabase db reset` then `npm run test:db`; `npm run test:services`
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`

**Dependencies:** Task 5
**Files likely touched:** `supabase/migrations/<ts>_import_revert_properties.sql`, `supabase/tests/database/102-property-import-revert.sql`, `src/domain/imports/types.ts`, `src/domain/imports/service.integration.test.ts`, `docs/domain-model.md`
**Estimated scope:** M

## Task 7: Fixtures and the 2,000-row scale run — Sonnet
**Description:** Add these fixtures:
- `properties-basic.csv`: 20 rows, UTF-8, Bulgarian headers.
- The same file in Windows-1251.
- `properties-edge.csv`: ambiguous villages, an EKATTE code, BGN prices, `двустаен`, `партер`,
  unknown areas, shared owners, duplicate addresses, bad phones, a plot with rooms.

Add `scripts/property-import/generate-scale.ts` (2,000 fake rows) and
`scripts/property-import/measure.ts`. The measure script stages, validates and commits through
the service on the local stack and prints the timings. The integration suite runs the whole
pipeline on the basic and edge fixtures, from stage through revert. Record the measured numbers
in `tasks/plan.md`.

**Acceptance criteria:**
- [ ] The integration suite stages, validates, commits and reverts both basic fixtures with the expected counts. The edge fixture gives the expected outcome on every row (a table in the test).
- [ ] Scale: validate plus preview under 30 s and commit under 2 min for 2,000 rows (rule 11), or the misses are written in the plan for Checkpoint 1.

**Verification:**
- [ ] `npm run test:services`; `npx tsx scripts/property-import/measure.ts`
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`

**Dependencies:** Task 6
**Files likely touched:** `src/domain/imports/__fixtures__/properties-*.csv`, `scripts/property-import/generate-scale.ts`, `scripts/property-import/measure.ts`, `src/domain/imports/property-import.integration.test.ts`, `tasks/plan.md`
**Estimated scope:** M

## Checkpoint 1 (founder)
- [ ] Every Phase 1 test is green: `npm run test:db`, `npm run test:services`, `npm run test`
- [ ] Scale numbers and the edge-fixture outcomes reviewed; tune the address key if needed
- [ ] `/review` of Phase 1; founder go for Phase 2 (fresh session)

## Phase 2: Screens

## Task 8: Start and map a property import — Sonnet
**Description:**
- `/settings/import/new` gains a "Имоти" choice. `new/page.tsx` accepts `type=property`, and
  `ImportWizard` takes `entityType` `property`.
- The mapping step shows the property fields with the spec's required marks and a sample value,
  using `detectHeaders(headers, 'property')`.
- A `PropertyImportOptionsForm` covers the duplicate strategy, the default broker and the date
  format.
- The actions in `settings/import/actions.ts` accept the property schemas.

Every string is in both message files.

**Acceptance criteria:**
- [ ] An owner or manager picks Properties, uploads `properties-basic.csv`, and sees every column mapped; continuing with `type` or `settlement` unmapped is blocked with a translated message.
- [ ] A broker can't open `/settings/import/new?type=property` (the existing layout guard), and the action refuses the broker (action test).

**Verification:**
- [ ] `npx vitest run src/app/(dashboard)/settings/import`
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`; browser in `bg` and `en`

**Dependencies:** Checkpoint 1
**Files likely touched:** `src/app/(dashboard)/settings/import/new-import-menu.tsx`, `src/app/(dashboard)/settings/import/new/page.tsx`, `src/app/(dashboard)/settings/import/actions.ts`, `src/components/domain/imports/import-wizard.tsx`, `src/components/domain/imports/property-import-options-form.tsx`, `messages/*.json`
**Estimated scope:** M

## Task 9: Property preview — Sonnet
**Description:** After validation the preview step shows:
- The counts: new, duplicate, invalid, and skipped by `external_ref`.
- **New areas per settlement**, with their row counts and tick boxes, saved to
  `options.create_areas`. All are ticked by default.
- A near-duplicate warning when a new area is within one edit of an existing area, or differs
  from it only by digits or spacing (pure function plus a test; cut item 1).
- How many rows had their prices converted from BGN (cut item 2).
- Owners matched and created (per-row text is cut item 3).
- The duplicate strategy.
- The row table, with each row's outcome and errors, and the error CSV download.

On 390 px the tables become cards.

**Acceptance criteria:**
- [ ] With `properties-edge.csv`, the preview counts equal the Task 7 expected table; unticking "Витоша" and committing imports its 3 rows without an area (integration test on the saved option).
- [ ] The error CSV lists each invalid row with its translated reason in the user's language.

**Verification:**
- [ ] `npx vitest run src/components/domain/imports src/domain/imports`
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`; browser in `bg` and `en`, 1280 and 390 px

**Dependencies:** Task 8
**Files likely touched:** `src/components/domain/imports/property-import-preview.tsx`, `src/components/domain/imports/import-wizard.tsx`, `src/domain/imports/area-similarity.ts` (+ test), `src/app/(dashboard)/settings/import/actions.ts`, `messages/*.json`
**Estimated scope:** M

## Task 10: Commit, results and revert on the job page — Sonnet
**Description:**
- The wizard's commit loop handles `property` jobs, and the done step links to `/properties`.
- `/settings/import` history labels property jobs.
- The job page shows the result counts.
- The revert confirmation names properties, contacts and areas, and the result toast shows
  deleted and kept for each, reading the new `RevertResult` fields.

**Acceptance criteria:**
- [ ] Committing the basic fixture shows 20 created and links to `/properties`, where the 20 show.
- [ ] Reverting shows deleted and kept counts for properties, contacts and areas; a contact or inquiry job revert still shows its own counts only.

**Verification:**
- [ ] `npx vitest run src/app/(dashboard)/settings/import`
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`; browser in `bg` and `en`

**Dependencies:** Task 9
**Files likely touched:** `src/components/domain/imports/import-wizard.tsx`, `src/app/(dashboard)/settings/import/page.tsx`, `src/app/(dashboard)/settings/import/[id]/page.tsx`, `src/app/(dashboard)/settings/import/revert-import-button.tsx`, `messages/*.json`
**Estimated scope:** M

## Task 11: "Imported from" on the property timeline, matches right after import — Sonnet
**Description:** `describeAudit` turns a property `created` row that has `import_job_id` into
"Imported from <file> by <user>". The file name comes from the job, and it falls back to
"Imported" when the job was deleted. Add an integration test for AC-7: after committing, an
imported apartment that fits Alpha's seeded buyer requirement appears in that deal's
`match_properties` results.

**Acceptance criteria:**
- [ ] An imported property's timeline shows its first entry as "Imported from properties-basic.csv"; a hand-made property's timeline is unchanged.
- [ ] AC-7 integration test green.

**Verification:**
- [ ] `npx vitest run src/domain/timeline`, `npm run test:services`
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`; browser in `bg` and `en`

**Dependencies:** Task 10
**Files likely touched:** `src/domain/timeline/audit-event.ts` (+ test), `src/domain/timeline/repository.ts`, `src/domain/imports/property-import.integration.test.ts`, `messages/*.json`
**Estimated scope:** S

## Checkpoint 2
- [ ] Import, preview, commit and revert done in the browser in `bg` and `en`, at 1280 and 390 px
- [ ] All tests green; `/review` of Phase 2

## Phase 3: Proof and close

## Task 12: E2E property import and revert — Sonnet
**Description:** Extend `e2e/settings-import.spec.ts`: a manager imports `properties-basic.csv`,
checks the preview counts and unticks a new area, commits, finds the property in `/properties`
and ⌘K, then reverts and sees the counts. Run it in `bg` and `en`, at 1280 and 390 px.

**Acceptance criteria:**
- [ ] The E2E passes in all four projects; the existing import E2E is unchanged.

**Verification:**
- [ ] `npm run test:e2e`

**Dependencies:** Task 11
**Files likely touched:** `e2e/settings-import.spec.ts`, `e2e/fixtures.ts`
**Estimated scope:** S

## Task 13: Docs complete — Sonnet
**Description:**
- Finish `docs/domain-model.md`: §2.5 diagram, the invariants for the address key, area creation
  and owner matching, and the glossary if any new terms appeared.
- Set FR-PIM-01…10 in `docs/BRD.md` to built, or ⚠️ with the reason.
- Note where `spec/property-import.md` ended up differing as built.
- Record the final scale numbers in AD-064.

**Acceptance criteria:**
- [ ] Every AC-1…AC-10 is traced in the BRD rows to a test or a browser check.
- [ ] The docs match the code: `rg import_job_id docs/domain-model.md` lists all four tables.

**Verification:**
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`

**Dependencies:** Task 12
**Files likely touched:** `docs/domain-model.md`, `docs/BRD.md`, `spec/property-import.md`, `docs/decisions-log.md`
**Estimated scope:** S

## Checkpoint 3
- [ ] `/review` of the module, with findings fixed
- [ ] Founder go to close: mark Done in `SPEC.md`, move `tasks/*` to `docs/archive/property-import-*.md`
