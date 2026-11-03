# Spec: properties

> **Status:** Draft (2026-11-03), awaiting founder approval. Decision: AD-056 (Proposed).
> **Evidence:** gap analysis §5.1 #6 (every Bulgarian product is property-first), business
> brief "Future data model direction", AD-039 pilot gate. Assumptions A1–A3 are unvalidated.

## Objective

An agency keeps its properties in BrokerCRM rather than in its listing tool or a spreadsheet, and
every buyer or tenant opportunity shows which properties were proposed, viewed, offered,
rejected or chosen. This is the property side of the core loop and a pilot-gate item (AD-039).
It is the base that `requirements`, `matching`, `property-import`, `mandates`, `viewings`,
`offers` and `syndication` build on, so the data model is the main deliverable (`SPEC.md` §7).

**Users:** brokers (record properties, link them to opportunities, book viewings), owners and
managers (the whole inventory, area list, deletes).

## Data model (AD-056)

```
settlements (global, read-only) ──< areas (agency)
        │                             │
        └──────────< properties >─────┘
                       │  ├──< property_parties >── contacts
                       │  └──< listings
                       └──< opportunity_properties >── opportunities
tasks.property_id ──> properties
```

- **`settlements`**: global reference table, the Bulgarian settlements from the NSI EKATTE
  register (code, `name_bg`, `name_en` transliterated, type city/village, municipality,
  province). No `agency_id`; read by every authenticated user, written only by migrations.
- **`areas`**: the agency's districts (квартали) per settlement: `settlement_id`, `name`,
  `is_active`, `sort_order`, unique `(agency_id, settlement_id, lower(name))`. Owner/manager
  configure them like lead sources (T6). No default seed; [ASSUMPTION A1: agencies are fine
  building their own list. Validate: time to set up areas in the onboarding dry run].
- **`properties`**: the physical asset.
  - `type`: `apartment | studio | maisonette | house | house_floor | plot | garage`
  - `rooms` (required for `apartment`, 1–9; "двустаен" etc. derive from it),
    `area_m2` (built-up), `plot_m2`, `floor`, `floors_total`,
    `construction`: `brick | panel | epk | timber | other`, `year_built`
  - location: `settlement_id` (required), `area_id` (optional, must belong to the same
    settlement), `address` (free text: street, number, entrance, flat), `location_note`
  - `assigned_to` (responsible broker, an active member), `description`, `status`
    `active | archived`, `code` (per-agency sequence shown as `#1042`), `external_ref`
    (unique per agency, for `property-import`)
- **`listings`**: an offering of a property: `property_id`, `offer_type` `sale | rent`,
  `price` (numeric > 0), `currency` (EUR, AD-037), `status`
  `active | reserved | closed | withdrawn`, `listed_at`, `closed_at`. At most one open
  (`active` or `reserved`) listing per `(property_id, offer_type)`. `mandates` and
  `syndication` will attach to listings.
- **`property_parties`**: `property_id`, `contact_id`, `role`
  `owner | co_owner | representative | occupant`, `ended_at`. One open row per
  `(property_id, contact_id)`. Ending a party keeps the row (ownership history); never an
  `owner_contact_id` column.
- **`opportunity_properties`**: `opportunity_id`, `property_id`, `relation`
  `subject | candidate`, `status` `candidate | viewed | offered | rejected | selected` (only
  for `candidate`, NULL for `subject`), `rejected_reason`. Unique `(opportunity_id,
  property_id)`.
- **`tasks.property_id`**: optional FK, `ON DELETE SET NULL`.
- **Audit:** `audit_log.entity_type` gains `property` and `listing`. Triggers record created,
  archived, assignment change, listing price and status change, and link status change.
- **Notes:** `notes.property_id` as a third possible parent (N1 extended).

## Business rules

1. Every member sees and edits every property of the agency; hard delete of a property,
   listing or area is owner/manager only (T2). A property with links, open listings or
   tasks is archived, not deleted.
2. `assigned_to` must be an active member (same check as I4). The creator is the default.
3. `apartment` needs `rooms`; `plot` needs `plot_m2` and has no `rooms` or `floor`;
   `floor ≤ floors_total` when both are set. Enforced by `CHECK`, mirrored in Zod.
4. A listing price is in EUR. A `closed` or `withdrawn` listing is read-only; reopening
   means a new listing, so the price history stays in the audit log.
5. `subject` links only on `seller` and `landlord` opportunities; `candidate` links only on
   `buyer` and `tenant` ones. At most one `selected` link per opportunity.
6. Candidate status can move to any other value (brokers correct mistakes); each change is
   audited and shows on both timelines. `rejected` asks for an optional reason.
7. Completing a `viewing` task that has an opportunity and a property sets that link to
   `viewed` if it was `candidate`, and creates the link as `viewed` if it was missing. It
   never moves a link backwards (`offered`, `rejected`, `selected` stay).
   [ASSUMPTION A2: one property per viewing task is enough for the pilot. Validate: brokers
   creating several viewing tasks for one visit]
8. Archiving a property withdraws its open listings. An archived property can't get new
   links, listings or viewing tasks, and drops out of pickers.
9. Settlement and area names show in the user's locale (`name_bg` / `name_en`); area names
   are as the agency typed them.
10. Contacts that are parties to a property don't go through a new duplicate check: they are
    picked from existing contacts or created with the existing contact form (C3 applies).

## Screens

- **`/properties`**: list with pager; filters for type, settlement, area, offer type, listing
  status, price range, rooms, responsible broker, archived. Mobile shows cards.
- **`/properties/new`, `/properties/[id]`**: attributes, listings (add, change price, close,
  withdraw), parties (add, end), linked opportunities with status, timeline (audit, notes,
  tasks), add note, create viewing task.
- **Opportunity detail**: a Properties section. Buyer/tenant: add candidates with a property
  picker, change status inline. Seller/landlord: set the subject property, or create one
  prefilled with the opportunity's contact as owner.
- **Contact detail**: the contact's properties and role.
- **Task form**: optional property picker when `task_type = viewing`, limited to the
  opportunity's linked properties plus "any active property".
- **Settings → Areas** (owner/manager): per settlement, add, rename, deactivate, reorder.
- **⌘K search**: properties by code, address and area.
- Navigation entry "Имоти" between Opportunities and Contacts.

## Success criteria

- **AC-1** A broker creates an apartment (Sofia, Lozenets, 2 rooms, 68 m²) with a sale
  listing at €185,000 and an owner contact; it appears in `/properties` filtered by area and
  price (FR-PRP-01, -02).
- **AC-2** On a buyer opportunity the broker adds two candidates; the status changes show on
  the opportunity and property timelines (FR-PRP-04).
- **AC-3** Completing a viewing task for one candidate moves it to `viewed` without touching
  the other; completing it for an `offered` link leaves `offered` (FR-PRP-05).
- **AC-4** A seller opportunity can link one subject property; a buyer opportunity can't
  link a subject, and a second `selected` candidate is refused with a translated message.
- **AC-5** Changing a listing's price from €185,000 to €179,000 shows both values on the
  property timeline; a closed listing can't be edited (FR-PRP-03).
- **AC-6** A broker of agency Beta sees none of Alpha's properties, areas or links; a broker
  can't delete a property; a manager can (pgTAP).
- **AC-7** An owner adds the area "Лозенец" to Sofia; a broker can pick it, and can't add
  areas (FR-PRP-06).
- **AC-8** All screens work in BG and EN at 1280 and 390 px; no hardcoded strings.

## Testing strategy

- **pgTAP:** `072-properties.sql` for RLS on all new tables, the catalog entry in
  `010-rls-catalog.sql`, `CHECK`s from rule 3, the open-listing and single-`selected`
  indexes, rule 5, the viewing trigger (rule 7) and the audit triggers. `settlements` is
  readable by every role and not writable.
- **Vitest:** Zod schemas (rule 3 mirrors, price, statuses); `PropertyService`,
  `ListingService`, `OpportunityPropertyService` with the service suites (archive rules,
  assignee check, relation vs opportunity type); timeline mapping for the new entry kinds.
- **E2E (Playwright):** extend the core loop: create a property with a listing, link it to
  the seeded buyer opportunity, complete a viewing task, see `viewed`. BG and EN, 1280 and 390.
- **Seed:** both agencies get areas for Sofia and Plovdiv, about 8 properties each across
  types, sale and rent listings, parties on existing contacts, and candidate links on the
  seeded buyer opportunities.

## Boundaries

- Always: filter by `agency_id` in repositories; every new table goes through the
  `supabase-patterns` checklist; status lists are `CHECK` + Zod + TS + both message files;
  update `docs/domain-model.md` (new "Property" area, invariants, glossary) in the migration
  commit.
- Ask first: the EKATTE import approach if the data needs more than a migration file (size,
  license); any change to `opportunities` or `contacts` columns; adding a dependency.
- Never: an `owner_contact_id` or price column on `properties`; app code writing
  `audit_log`; photos or file uploads (separate storage work); mandate fields
  (exclusivity, expiry) — they belong to `mandates`.

## Out of scope

Photos and documents, mandates, portal publishing, requirements and matching, property CSV
import (only `external_ref` is added now), viewing records with attendees and feedback, offers,
sharing a property with another agency, map or coordinates.

## Cut order if time runs short

1. Notes on properties (`notes.property_id`).
2. ⌘K search for properties.
3. Creating a subject property prefilled from a seller opportunity.

## Open questions

- **EKATTE data:** ~5,250 settlements from NSI open data. Confirm the source and that one
  migration file is an acceptable size; otherwise start with towns only and add villages in
  `property-import`. [ASSUMPTION A3: agencies list properties mostly in towns]
- **Price per m²** is derived on screen only, not stored. Confirm that's enough for the pilot.
