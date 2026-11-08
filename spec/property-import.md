# Spec: property-import

> **Status:** Approved scope (founder, 2026-11-08). Decision to write: AD-064.
> Requirements: FR-PIM-01…10 (new BRD section).
> **Evidence:** business brief "CSV import with mapping, validation and error reporting" and
> "Failed or repeated imports don't silently create duplicates", the onboarding hypothesis "CSV
> import is enough for initial onboarding" (brief, medium risk), `SPEC.md` §3 (`go-live` depends
> on this module for the dry run with a real agency export).
> Scope answers from the founder (2026-11-08): one row creates the property, its listings and its
> owner; unknown areas are created; a generic mapped CSV (no sample export yet); duplicates by
> `external_ref`, then by address; Q1 and Q2 take the defaults. Assumptions A1–A5 are unvalidated.

## Objective

An owner or manager moves the agency's property spreadsheet into BrokerCRM in one sitting. They
upload a CSV, check the mapped columns, see per row what will happen (new property, sale and rent
listing, owner matched or created, new areas, duplicates, errors) and commit. Every imported
property is then a normal property: it shows in `/properties`, in ⌘K, and in matching for buyer
and tenant requirements on the same day. A wrong import can be reverted within 7 days without
losing anything someone has worked on since.

Without this, onboarding an agency with 300–2,000 listings is days of hand entry, which is the
onboarding cost the brief says to measure ("time to import and activate an agency").

**Users:** owners and managers (import is owner/manager only, FR-IMP-06). Brokers see the
result.

**Not in this module:** photos and documents, mandates, portal syndication fields, importing
links to opportunities (subject or candidate), parties other than one owner per row, updating
existing properties ("update existing" stays unbuilt, as for contacts), import presets for a
named source tool (added in `go-live` once a real export is seen), XLSX (save as CSV).

## Pipeline (AD-034, unchanged)

The same pipeline as contacts and inquiries: the client parses the file and detects UTF-8 or
Windows-1251 (M1), stages 500-row chunks into `import_rows`, the server validates and classifies,
the preview shows the result, and the client loops a batch-commit RPC until `remaining = 0`.
`import_jobs.entity_type` gains `property`. The import menu at `/settings/import/new` gets a
third choice, "Имоти".

## Columns

Mapped automatically from Bulgarian and English header synonyms (`header-detection.ts`), then
adjustable by the user. Only the starred fields are required.

| Field | Examples of accepted values | Into |
|---|---|---|
| `type`* | `апартамент`, `студио`, `мезонет`, `къща`, `етаж от къща`, `парцел`, `гараж`; English ids; `двустаен`/`тристаен`… = apartment with rooms 2/3… | `properties.type` (+ `rooms`) |
| `settlement`* | `София`, `гр. Пловдив`, `с. Лозен`, `Sofia`; or a 5-digit EKATTE code | `settlement_id` (rule 2) |
| `municipality`, `province` | `Столична`, `Пловдив` | only to resolve the settlement |
| `area` | `Лозенец` | `area_id`, created if missing (rule 3) |
| `address`, `location_note` | free text | as is |
| `rooms`, `area_m2`, `plot_m2`, `floor`, `floors_total`, `year_built` | `3`, `68,5`, `68.5 кв.м`, `партер` (= 0), `сутерен` (= −1) | numbers |
| `construction` | `тухла`, `панел`, `ЕПК`, `гредоред`, other text = `other` | `construction` |
| `sale_price`, `rent_price` | `185 000`, `€185,000`, `185000 EUR`, `1 200 лв.` | a `sale` / `rent` listing (rule 5) |
| `listing_status` | `активна`, `резервирана`, `продадена`, `оттеглена` | listing status, default `active` |
| `listed_at` | `15.03.2025`, `2025-03-15` (the job's date format) | listings' `listed_at`, default the import time |
| `assigned_to` | broker email or unique name | `assigned_to` (M3), default the importer |
| `description` | free text | `description` |
| `external_ref` | the agency's own id, `A-1042` | `properties.external_ref` |
| `owner_name`, `owner_phone`, `owner_email` | `Иван Петров`, `0888 123 456` | owner party (rule 6) |

A column that maps to nothing is ignored. Unmapped required fields block the preview.

## Business rules

1. **Valid row = valid property.** A row passes the same rules as the property form (FR-PRP-01,
   `spec/properties.md` rule 3: apartment needs 1–9 rooms, plot needs `plot_m2` and no rooms or
   floor, floor ≤ floors total). Validation uses the same Zod schema as the form, so the two can't
   drift. Errors are i18n codes per field, shown in the preview and in the downloadable error
   CSV, as for contacts.
2. **Settlement.** Matched on the Bulgarian or English name without the `гр.`/`с.` prefix, case
   and spacing ignored, or on the EKATTE code. When several settlements share the name (common
   for villages), `municipality` or `province` must pick exactly one; otherwise the row is
   invalid with `imports.errors.settlementAmbiguous` and the candidates' municipalities. No match:
   `imports.errors.settlementNotFound`. Never a guess (same principle as M3).
3. **Areas.** An area is matched by name within the row's settlement (case and spacing ignored),
   active or inactive. A name with no match becomes a new area for that settlement: the preview
   lists the new areas per settlement with their row counts, and the user can untick one, which
   imports those rows without an area. Rows in the same file share one new area. New areas are
   created at commit and recorded on the job; a revert deletes those no record uses any more.
   [ASSUMPTION A1: agencies' area spellings are consistent enough that this doesn't create
   near-duplicate areas. Validate: the dry run; the preview shows names close to an existing area
   ("Лозенец 2" vs "Лозенец") as a warning]
4. **Duplicates.** In order:
   - **`external_ref`** equal to an existing property's (AD-035 style idempotency): always
     skipped, so re-running the same file creates nothing.
   - **Same settlement and the same normalised address** (lowercase, `ул.`/`бул.`/`№`/punctuation
     and spacing removed) as an existing property, or as an earlier row in the file: a duplicate,
     handled by the job's strategy `skip` (default) or `create`. Rows without an address are never
     address duplicates.
   - Re-checked at commit (`db_recheck`) as for contacts.
5. **Listings.** A `sale_price` creates a `sale` listing and a `rent_price` a `rent` listing, both
   with the row's `listing_status`. A price must be a positive amount. Amounts are EUR (AD-037);
   an amount marked `лв`/`BGN` is converted at the fixed rate 1.95583 and rounded to the cent, and
   the preview shows how many rows were converted (Q1). [ASSUMPTION A2] A
   `closed` or `withdrawn` listing gets `closed_at` = the commit time. A row with no price imports
   the property with no listing.
6. **Owner.** When the row has an owner name, phone or email, the import links an `owner` party:
   - matched to an existing contact by phone (E.164 via `normalizePhone()`) or email
     (lowercase), the same matching the contact import uses; a name-only owner is never matched;
   - otherwise a new person contact is created (split into first and last name as the contact
     import does), marked with the job id, so revert treats it as an imported contact (AD-036);
   - two rows with the same owner phone or email share one new contact;
   - an owner phone that doesn't parse makes the row invalid (`imports.errors.ownerPhoneInvalid`),
     rather than importing an owner nobody can call.
   The preview shows "owner: matched Иван Петров" or "owner: new contact" per row.
7. **Audit.** Each imported property, listing and party writes the same audit rows the form does
   (triggers, never app code), with the job id in `metadata`, so the property timeline says
   "Imported from <file> by <user>". No row per listing price "change" on import.
8. **Revert (AD-036 extended).** Owner/manager, `completed` job, within 7 days. It deletes a
   property only if nobody has worked on it since the import: no edit, note, task, opportunity
   link, listing created or changed, party added or ended, or archive. Its imported listings and
   parties go with it. An imported owner contact is deleted under the existing contact rule (being
   a party only to properties this revert deletes doesn't count as work, AD-058 otherwise). Then
   unused areas the job created. Rows become `reverted` or `revert_skipped`; the result shows
   deleted and kept counts for properties, contacts and areas.
9. **Codes.** Imported properties get the next `code` from `agencies.property_code_seq` in file
   order, like properties made by hand. `external_ref` is kept as given.
10. **Tenancy and roles.** Jobs, rows, resolved settlements, areas, assignees and owner matches
    come only from the caller's agency; the commit and revert RPCs are `SECURITY INVOKER`, check
    the role, filter by `current_agency_id()` and are not granted to `anon` (as the existing
    import RPCs).
11. **Size and speed.** Same file limit as the other imports (5 MB, M1). A 2,000-row file
    validates and shows its preview in under 30 s, and commits in under 2 min on the local stack.
    [ASSUMPTION A3: 2,000 rows covers the largest pilot agency. Validate: ask pilot agencies
    their listing count]

## Data model changes (AD-064)

- `import_jobs.entity_type` CHECK gains `property`; `options` gains `create_areas` (list of
  `settlement_id:name` the user kept) and the existing `duplicate_strategy`.
- `properties.import_job_id`, `areas.import_job_id`, `listings.import_job_id`,
  `property_parties.import_job_id`: nullable FK `ON DELETE SET NULL`, indexed where not null, as
  on `contacts` and `inquiries`.
- `import_rows.match_reason` gains `address` (the `external_ref`, `in_file` and `db_recheck`
  values already exist).
- New RPC `import_commit_properties(p_job_id, p_limit)` returning `{ processed, remaining }`,
  writing property, listings, owner contact and party, and new areas for one row in one
  transaction per row batch (AD-050 atomicity: a row is all or nothing).
- `import_revert` handles `property` jobs.
- `docs/domain-model.md` §2.5, §3.5 and invariants M1–M3 updated in the same commit; a new
  invariant for rule 8.

## Screens

- **`/settings/import/new`:** the menu offers Contacts, Inquiries, Properties.
- **Mapping step:** the column table above with auto-mapped fields, a sample value per column,
  and required fields marked.
- **Preview:** counts (new, duplicate, invalid, skipped by `external_ref`), new areas per
  settlement with tick boxes, BGN conversions, owners matched / created, the duplicate strategy,
  and the row table with per-row outcome and errors; the error CSV download.
- **Job page `/settings/import/[id]`:** result counts and revert, as for the other types; revert
  confirmation names properties, contacts and areas.
- **Property page:** the timeline's first entry reads "Imported from <file>".
- Glossary: Import = **Внасяне**, as in `docs/domain-model.md`; no new terms.

## Success criteria

- **AC-1** A 20-row fixture (both encodings) with Bulgarian headers maps every column
  automatically and commits 20 properties with the right type, rooms, m², floor, construction,
  settlement and area; they show in `/properties` and ⌘K (FR-PIM-01, -02).
- **AC-2** A row with `sale_price` 185 000 and `rent_price` 900 creates one active sale and one
  active rent listing in EUR; `1 200 лв.` becomes €613.55 and is counted in the preview (FR-PIM-04).
- **AC-3** "Лозен" without municipality is invalid with the candidates listed; with municipality
  "Столична" it resolves; an EKATTE code resolves directly (FR-PIM-03).
- **AC-4** Unknown area "Витоша" in Sofia appears once in the preview for its 3 rows; committed,
  all 3 share one new area; unticked, the 3 rows import without an area (FR-PIM-05).
- **AC-5** An owner phone matching an existing contact links that contact as `owner`; a new phone
  creates one contact shared by its 2 rows; an unparseable phone makes the row invalid (FR-PIM-06).
- **AC-6** Importing the same file twice creates nothing the second time; a row with the same
  settlement and address as an existing property is a duplicate, skipped by default and created
  under `create` (FR-PIM-07).
- **AC-7** An imported apartment matching a buyer requirement shows in that deal's matches right
  after commit (FR-PIM-08).
- **AC-8** Revert within 7 days deletes untouched properties, their listings and parties, the
  imported owner contacts nobody worked on and the unused new areas; a property that got a note
  or a candidate link, and its owner, are kept and counted (FR-PIM-09).
- **AC-9** A broker can't open the import pages or call the RPCs; another agency's settlement
  areas, members and contacts are never matched (pgTAP + service tests) (FR-PIM-10).
- **AC-10** The flow works in Bulgarian and English at 1280 and 390 px; the 2,000-row scale
  fixture meets rule 11.

## Testing strategy

- **Vitest (unit):** value resolvers for type, rooms-from-word, numbers with units and commas,
  floor words, construction, prices and BGN conversion, settlement resolution (ambiguity), area
  name matching, address normalisation; header synonyms; the row schema reuses the property Zod
  schema (test that a form-invalid row is import-invalid).
- **Service integration (`npm run test:services`):** stage → validate → preview → commit →
  revert on the local stack with the fixtures, including owner matching, shared new owners and
  areas, idempotent re-run, and the kept-on-revert cases.
- **pgTAP:** RLS and role on the new columns and RPCs, `anon` revoked, cross-agency refusal,
  per-row atomicity, revert guards.
- **E2E (Playwright):** one property import and revert in the core-loop suite, bg + en, 1280 and
  390 px.
- **Fixtures:** `tests/fixtures/imports/properties-*.csv` (UTF-8, Windows-1251, edge cases,
  2,000-row scale file generated by a script), all fake data.

## Boundaries

- **Always:** reuse the AD-034 pipeline, the contact matching and `resolveAssignee`; return i18n
  keys from RPCs; leave `raw` untouched; update `docs/domain-model.md` and write AD-064 with the
  schema change.
- **Ask first:** changing the existing contact or inquiry import behaviour; adding a dependency
  (e.g. an XLSX parser); a preset for a named source tool; any change to matching.
- **Never:** guess a settlement, assignee or owner; write `audit_log` from app code; import into
  another agency; delete on revert anything someone has worked on.

## Assumptions

- **A1** Area spellings are consistent enough (rule 3).
- **A2** Some agency spreadsheets still hold BGN amounts from before the euro (rule 5).
- **A3** 2,000 rows covers the largest pilot agency (rule 11).
- **A4** One owner per row is enough for onboarding; co-owners are added by hand.
- **A5** A generic mapped CSV fits what pilot agencies export; `go-live` checks a real file and
  may add a preset.

## Resolved questions

- **Q1** BGN amounts are converted at 1.95583 and counted in the preview, not refused (founder,
  2026-11-08).
- **Q2** A property's `created_at` is always the import time; a `listed_at` column fills only the
  listings' `listed_at` (founder, 2026-11-08).
- **Q3** An owner with a phone or email but no name, who matches no contact, is not created (a
  contact needs a name and we never invent one). The row stays valid: the property imports
  without an owner party, and the preview shows the warning `import.warnings.ownerSkippedNoName`
  so the owner can be added by hand (founder, 2026-11-08). A phone that doesn't parse still
  makes the row invalid (rule 6).
