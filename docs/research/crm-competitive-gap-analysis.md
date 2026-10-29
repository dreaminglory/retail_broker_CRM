# BrokerCRM competitive gap analysis: Bulgaria and Eastern Europe

> Research of 2026-10-28, trimmed 2026-10-29. Input for `/feature-ideas` (market evidence).
> **Still open:** the gap lists in §5 and the patterns in §7. **Already settled:** the strategy
> question in §6 (AD-039: full agency system, €20 per broker) and most §5.0 defects (see the
> Status column). The build order lives in `SPEC.md` §3, not here.

## 1. Executive summary

1. **BrokerCRM today scores about 2.5/10.** That is the average of the 15 dimensions with
   evidence, against 4.9–7.3 for the products agencies can buy now. The core loop works:
   inquiry → contact → opportunity → next action → Today → manager exceptions. Almost
   everything around it is missing: property listings, matching, lead intake other than typing
   and CSV, reminders, calling and messaging links, reporting, GDPR tools and integrations.
   *(Observed in code: `notes/brokercrm-feature-inventory.md` §2.)*
2. **The Bulgarian market already has cheap local products, and they all lead with the same
   offer:** property listings, one-click publishing to 10–30 portals, matching buyers to
   properties, and an exchange network between agencies. Prices run from €0 to €32 per broker
   per month. *(Observed: vendor pricing pages.)* In Bulgaria, none of them leads with follow-up
   discipline except OptiEstate.
3. **OptiEstate is the direct threat.** It is Bulgarian, priced at €15–32 per broker, and
   already markets on-duty lead routing with a 10-minute escalation, response-time KPIs, required
   lost reasons and deadline tracking (mandate expiry, unconfirmed viewings). Its evidence is thin:
   it names 5 customers and no independent reviews exist. *(Observed: https://opti.estate/llms.txt.)*
4. **None of the US or UK "gold standard" CRMs sells in Bulgaria.** Follow Up Boss, BoldTrail,
   Lofty, Sierra, Reapit and Alto have no Bulgarian interface and no Bulgarian portals. The
   generic CRMs (Pipedrive, HubSpot, Bitrix24, Kommo) have no Bulgarian interface either. They are
   **pattern sources, not competitors**. *(Observed: vendor sites.)*
5. **The pilot non-goals clash with what Bulgarian agencies buy.** Publishing to portals is a
   pilot non-goal, and listings with matching are post-pilot, yet these are the main reason every
   Bulgarian competitor gets bought. Without them, BrokerCRM is either an add-on next to a listing
   tool or must win clearly on getting leads answered and followed up. *(Inferred.)* This is a
   **founder decision** (§6). *Decided: AD-039, full agency system.*
6. **The planned price is 2–5× the local market.** The brief's €99–249 per agency per month plus
   €15–25 per extra user compares with Estate Assistant at about €11 per user, EstatePlus at about
   €52/month for 10 brokers, OptiEstate at €22 per broker *including* website and portals, and
   free tiers. *(Observed: vendor pricing pages; brief "Pricing And Packaging Hypotheses".)*
   *Decided: AD-039 sets the hypothesis at €20 per broker per month.*
7. **Where BrokerCRM can still win.** No Bulgarian product shows the follow-up depth of Follow Up
   Boss: saved lists you work through one by one, automatic rules for who gets a lead, a shared pool
   of unclaimed leads, and follow-up plans that pause when the client replies. Nor does any show
   onOffice-level GDPR tools, an offer record, or a report to the seller. Every competitor's
   evidence is vendor marketing (no independent reviews exist for any Bulgarian product), so a
   product that verifiably works on a phone, and is proven in a pilot, is a credible wedge.
   *(Inferred.)*

**Top recommendation** (now reflected in `SPEC.md` §3). Before adding features, fix the defects
in the core loop (§5.0, module `trustworthy-loop`). Then build the "Must-have to sell" tier
(§5.1) in roughly this order:
1. Reminders and a daily digest.
2. Click-to-call and Viber/WhatsApp links, with a prompt after each call.
3. Lead intake by email from portals and a website form.
4. Automatic lead routing with escalation.
5. A lightweight property record, buyer requirements and matching.
6. Basic GDPR tools.
7. A PWA.

Portal publishing and pricing are open founder decisions before `properties` (`SPEC.md` §3).

---

## 2. Method and limits

- **BrokerCRM** was assessed by reading the code. The app was not run, and some defects are
  marked "by reading" in the inventory.
- **Competitors** were assessed from vendor product, help-centre and pricing pages fetched with
  curl, App Store data, Capterra review pages and search results.
  - Sites that refused automated access were **not** worked around: imot.bg, imoti.net, olx.bg,
    realistimo.com, G2, LinkedIn, Pipedrive pricing, and the FUB, Lofty and Alto help centres.
    Claims about those rest on search snippets.
- **Trimmed 2026-10-29:** the per-competitor notes, competitor score tables and pricing table
  were removed. The competitor averages in §1 and the "Who has it" columns stay as findings;
  their raw sources are no longer in the repo.
- **UI/UX scores (dimension 10) are not hands-on.** They come from reviews, demos and screenshots.
  No independent reviews exist for any Bulgarian product or for CRM REBS, so their UI/UX is "n/e"
  (no evidence). BrokerCRM's UI/UX score comes from reading its components.
- **Scoring rubric:** 0 = absent, 2 = token or workaround, 4 = basic, 6 = solid, 8 = strong,
  10 = best in class. "n/e" = no evidence. Averages leave n/e out, so a product with many n/e
  scores is averaged over fewer dimensions and is not directly comparable.
- **Prices** are as of 2026-10-28, excluding VAT, at roughly 1 USD ≈ 0.86 EUR, 1 GBP ≈ 1.15 EUR,
  1 EUR ≈ 4.25 PLN ≈ 25 CZK. BGN is fixed at 1.95583 per EUR.
- **Evidence weight for planning:** `feature-ideas` caps competitor-only ideas (E0) (brief: "not
  merely because established CRMs contain them"). This report is **market evidence**, above a
  pure benchmark but below pilot evidence (E3). `SPEC.md` §6 *Pilot evidence* is still empty, so
  no gap below has pilot evidence yet.

---

## 3. Scores

### 3.1 BrokerCRM, scored from the code

| # | Dimension | Score | Why (evidence in `notes/brokercrm-feature-inventory.md`) |
|---|---|---|---|
| 1 | Lead capture & sources | **2** | Manual entry and CSV only. Has a source list (imot.bg and OLX as names) and an `external_ref` key ready for feeds. No web forms, email intake, portal feeds or API (§2.1). |
| 2 | Lead routing / assignment | **1** | An owner can be chosen at creation only. Reassignment actions exist but no screen uses them. No rules, round robin or shared pool. Deactivating a broker leaves their records orphaned (§2.4). |
| 3 | Follow-up discipline | **4** | Strong base: each opportunity's next action is kept in sync automatically, and Today and At-risk are agency-local. "Complete and schedule next" works on Today only. No reminders, saved lists or action plans, and tasks can't be edited or rescheduled (§2.5, §2.6). |
| 4 | Contact & deal / pipeline | **4** | Custom stages, deal participants, duplicate merge with history, and a unified timeline. List view only (no kanban), capped at 200 rows. Lost reasons are free text, there are no stage rules, and stage and status can disagree (§2.2, §2.3). |
| 5 | Property inventory & matching | **0** | No property, requirement or matching code (§2.7). |
| 6 | Communication | **1** | Viber and WhatsApp numbers are stored, but there are no `tel:`, `viber:` or `wa.me` links, no email and no SMS (§2.9). |
| 7 | Viewings & offers | **1** | A viewing is a task type. No viewing record, feedback or offer (§2.8). |
| 8 | Reporting & oversight | **3** | The Exceptions screen shows unassigned, overdue, at-risk, stale and workload, but it's read-only. No reports. Speed-to-lead can't be computed because no first-contact time is recorded (§2.6). |
| 9 | Mobile | **2** | Partly responsive. Search is hidden on phones, there's no PWA and no click-to-call (§2.14). |
| 10 | UI/UX & onboarding *(from code)* | **4** | Consistent shadcn components and empty states. Visible defect on Today, English text in the Bulgarian UI, no pagination controls, and no agency-settings screen (§3). |
| 11 | Integrations / API | **0** | None (§2.15). |
| 12 | Import / migration | **5** | The best area: CSV import of contacts and inquiries, Windows-1251 support, Bulgarian column names, duplicate detection, error report and 7-day revert. CSV only; the revert guard doesn't work as intended (§2.11). |
| 13 | Localization (BG) | **6** | Bulgarian by default with full key parity, Sofia time and EUR. Gaps: English leaks, foreign and landline phones rejected, auth emails in Bulgarian only, no dual EUR/BGN display (§2.13). |
| 14 | GDPR / compliance | **1** | Strong tenant isolation (RLS) and a partial audit log, but no consent, export, erasure or retention (§2.2). |
| 15 | Pricing fit | **n/e** | Not built. The brief's hypothesis (€99–249/agency + €15–25/user) would score about **3** against local prices; AD-039 replaced it with €20 per broker. |
| 16 | Multi-office / admin | **4** | Three roles, invitations and proven tenant isolation. No teams, no "own records only" visibility, no agency-settings screen, one office only, and brokers can edit stages and sources (§2.12). |
| | **Average (15 scored)** | **2.5** | |

### 3.2 What the scores say

- **What BrokerCRM needs to close the gap is well defined.** The two biggest gaps, property and
  matching (0 vs 7–10) and portals and integrations (0 vs 7–8), are exactly what Bulgarian
  agencies buy. The next tier, lead capture, communication and mobile, is what turns follow-up
  discipline from an idea into a habit.
- **Where BrokerCRM is closest to the local products**, localization (6) and import (5), are
  also its stated wedge, "reliable import with deduplication and merge history". Import is a
  real advantage over Estate Assistant (3) but not over REBS or ASARI (8, with **free migration
  from named competitors**).
- **No Bulgarian product scores above 6 on GDPR.** onOffice (9) shows the pattern. With CPDP
  complaints up more than 60% in 2025 (https://cms.law/en/bgr/publication/gdpr-enforcement-tracker-report/bulgaria),
  this is a credible differentiator, not just compliance. *(Inferred.)*

---

## 4. Workflow conventions a Bulgarian CRM must model

| Convention | Evidence | What it means for the product |
|---|---|---|
| Mandates are **non-exclusive by default**; exclusivity needs a clause; contracts carry anti-circumvention penalties | https://www.innovires.com/blog/posrednicheska-deynost-imoti.html | A **mandate record**: type, start and end, exclusive flag, signed copy, and a reminder before expiry. OptiEstate and ASARI track expiry. homes.bg lets only the exclusive agency list an exclusive property (https://www.homes.bg/terms §4.3.19) |
| Commission is **2–3% from each side** on sales, one month's rent on lettings, plus VAT if registered | Innovires (above) | Expected commission per opportunity, per side. A pilot non-goal is commission *accounting*, but *expected value* is already a field |
| Deal flow: preliminary contract with ~**10% deposit** (капаро), then the **notary deed** | https://www.innovires.com/blog/pokupka-na-imot.html (snippet) | Default stages and dates: "Deposit / preliminary signed" and "Notary date". OptiEstate counts deposits as a KPI |
| Brokers are **AML obliged entities** (ЗМИП art. 4(18)): client identification, PEP checks, records kept for 5 years, fines up to BGN 200,000 | Innovires (above) | A simple identification-check record per client. **No CRM reviewed advertises it**. AML is a non-goal for now (`SPEC.md` §1) |
| **Viber** is the default messenger (company claims of 90% share in 2021) | https://seenews.com/news/viber-grows-market-share-in-bulgaria-to-focus-on-dedicated-business-space-in-2022-770066 (snippet) | `viber://` and `tel:` links everywhere, plus a log-the-call prompt. Business Viber bots cost about €100 per bot per month and don't pass the client's phone number, so **deep links beat an integration** for the pilot |
| **Euro since 2026-01-01** at 1.95583 BGN/EUR; the end date for dual price display is disputed (2026-08-08 vs 2027-01-01) | https://www.fibank.bg/en/introduction-of-the-euro-in-the-republic-of-bulgaria ; https://dpc.bg/insights/dual-price-display-and-currency-exchange-in-the-context-of-euro-adoption | Store EUR. Convert legacy BGN on import at the fixed rate. Optionally show BGN alongside EUR while the law requires it |
| **GDPR complaints** to the CPDP are rising (+60% in 2025), mostly about processing without a legal basis | https://cms.law/en/bgr/publication/gdpr-enforcement-tracker-report/bulgaria | Legal basis or consent per contact, export, erasure and retention. Be careful with "private seller" feeds harvested from portals, which REBS, Immoflux, ESTI and OptiShare offer |

## 5. Gap list

Priority: **Must** = needed to sell in Bulgaria; **Diff** = a differentiator that supports the
wedge; **Nice** = later. Effort: **S** ≤ 3 dev-days, **M** 1–2 weeks, **L** 3+ weeks; these are
rough guesses before design. *B-xx* refers to
`docs/research/crm-benchmark.md`. *N-xx* are new patterns proposed
in §7. **→ `module`** is the `SPEC.md` capability-map row that covers the gap; no arrow means
it is not on the map yet (a `/feature-ideas` candidate). The rule stays: **borrow patterns,
never copy UI, text or branding**.

### 5.0 Fix first: defects in what's built (inventory §3, §4)

These break the follow-up promise the product is built on, and they're cheap. *(Observed or
"by reading" in code on 2026-10-28.)*

| Defect | Effort | Status |
|---|---|---|
| Today shows the literal text `t('dueTodayTime', …)` for tasks due today; dates in Bulgarian mode use English month names; a task can appear in both "Overdue" and "Due today" | S | Fixed (Sprint 6.2) |
| Completing a task on the opportunity page drops the next task and the stage change | S | Fixed (Sprint 6.2) |
| Tasks can't be edited, rescheduled or cancelled, and inquiries can't be edited or reassigned: the server actions exist but no screen calls them | S–M | Tasks fixed (6.2); inquiries in `trustworthy-loop` |
| Inquiry phone and email aren't normalized, and the duplicate check at conversion compares names only | S | `trustworthy-loop` |
| Only Bulgarian mobile numbers are accepted; foreign buyers and landlines are rejected | S | `trustworthy-loop` (AD-041) |
| Task due times are read in the server's timezone, not the agency's | S | Fixed (Sprint 6.2) |
| Lists have no pagination UI; opportunities are capped at 200 rows and contact pickers at 200 | M | `trustworthy-loop` |
| Import revert can delete contacts that have notes; the import recheck writes a `match_reason` value the schema rejects | S | `trustworthy-loop` |
| Brokers can change stages and lead sources and merge contacts; the role checks are missing | S | Fixed (`requireRole(ctx, CONFIG_ROLES)`) |

### 5.1 Must-have to sell

| # | Capability | Who has it (evidence) | Why it matters in EE specifically | Effort | Maps to |
|---|---|---|---|---|---|
| 1 | **Reminders and daily digest** (email and in-app; due, overdue, new inquiry) | FUB, Pipedrive, HubSpot; OptiEstate "morning briefing"; REBS email reminders | Without them a broker must open the app to learn of work, which breaks the core promise. Every Bulgarian competitor reminds | M | B-02 → `reminders` |
| 2 | **Click-to-call, `viber://`, `wa.me` and `mailto:` links**, plus a **post-call prompt** ("answered?" → notes and next step, or remind in 1h / tonight / tomorrow) | REBS mobile (https://www.crmrebs.ro/blog/aplicatia-mobila-crm-rebs-webinar-de-lansare/); Pipedrive follow-up pop-up; FUB dialer | Phone- and Viber-first culture; cheapest way to make logging calls a habit | S–M | B-07, B-09, B-10 → `phone-loop` |
| 3 | **Portal lead intake by email** (parse inquiry emails from homes.bg, imot.bg, alo.bg and others into inquiries with source and external ref; status waiting / duplicate / done) | onOffice Enquiry Manager; ESTI "portal inquiry reader"; Realman (3M inquiries from 32 sources); Reapit internet registrations | homes.bg emails inquiries to the lister (terms); no Bulgarian portal has a lead API, so email is the practical path. The `external_ref` key is ready | M–L | B-16, N-07 → `lead-intake` |
| 4 | **Website form and API endpoint** for inquiries (with source and campaign) | OptiEstate (Meta Lead Ads, Google forms); FUB API; Bitrix24 forms | Agencies run their own sites and Facebook ads; inquiries lost between channels are the core problem | M | B-16 → `lead-intake` |
| 5 | **Automatic lead routing**: round robin, on-duty broker, and escalation if not accepted in N minutes | FUB (rules and first-to-claim); OptiEstate (10-minute escalation); Bitrix24 (skips absent staff) | The local leader already sells it; speed-to-lead is the brief's main metric | M | B-04 → `routing` |
| 6 | **Lightweight property record** (address or area, type, rooms, m², price, owner, mandate) linked to opportunities | All BG/RO/PL products; Reapit, Alto, onOffice | Every Bulgarian product is property-first; brokers think in properties. The pilot brief already includes "lightweight property reference" | L | B-11 (property side), N-01 → `properties` |
| 7 | **Buyer/tenant requirements and two-way matching** (required criteria + match score, "already offered" list) | onOffice (10), Reapit, Alto, REBS, OptiEstate, Estate Assistant, EstatePlus | Core purchase reason in BG; the pilot brief includes requirements; a pilot-gate item | L | B-11, B-12 → `requirements`, `matching` |
| 8 | **GDPR basics**: legal basis or consent per contact, export of one contact's data, erasure or anonymisation, retention date and deletion worklist | onOffice (9), HubSpot (8), Reapit and Alto (7); no Bulgarian product above 6 | CPDP complaints up more than 60% in 2025; personal data from portals and Viber campaigns is a risk | M | N-04 → `gdpr` |
| 9 | **PWA**: installable, push notifications, search and quick actions on phones | OptiEstate, REBS, PropertyManager (PWAs); native apps are not the norm in BG | Brokers work in the field; a good PWA matches the competition, and native apps stay a non-goal | M | B-09 → `pwa` |
| 10 | **Kanban board** with drag to change stage and next-action colour coding (overdue / today / none) | Pipedrive (reference), ASARI, HubSpot, Bitrix24 | Managers expect a board; colour by next-action state *is* the wedge, made visible | M | B-19, B-07 |
| 11 | **Lost-reason list and stage rules** (required fields on entering a stage; deposit and notary-date stages) | Pipedrive, HubSpot, OptiEstate | Data quality for reporting; the Bulgarian deal flow has fixed milestones | S–M | B-14, B-15 |
| 12 | **Basic reports**: inquiries by source, speed to first contact, conversion by stage, win/loss and reasons, per-broker activity | Sierra and FUB (speed-to-lead per agent); OptiEstate KPIs; REBS; ASARI | Owners pay for visibility; "uncontacted after 1 business day" is a brief success metric. Needs a first-contact timestamp | M | B-05, B-20 → `reports` |
| 13 | **Saved lists ("Smart Lists")** with counts, worked through one by one | FUB (S-01), Close, HubSpot task queues; REBS "no future activities" filter | In the pilot brief's included scope; a pilot-gate item | M | B-01, B-08 → `smart-lists` |
| 14 | **Offboarding and cover**: bulk reassignment when a broker leaves, cover during absence | ESTI ("employee substitution"), Bitrix24 (skips absent staff), Salesforce/HubSpot | The brief: "history disappears when a broker leaves" | S–M | B-18 |
| 15 | **Agency settings screen** (name, timezone, currency, logo) and data export (CSV) | All products | Today these can be changed only in the database; export is also needed for GDPR and trust | S | — |

### 5.2 Differentiators (support the wedge)

| # | Capability | Who has it | Why it matters in EE | Effort | Maps to |
|---|---|---|---|---|---|
| 16 | **Action plans** (reusable task sequences, paused when the client replies or the stage changes) | FUB, Sierra, Lofty; Immoflux "activity groups"; Kommo stage triggers | No Bulgarian product shows sequences | M–L | B-03, N-10 → `action-plans` |
| 17 | **Shared lead pool** (unclaimed or neglected leads go to a claimable pool; "uncontacted on day 2 → reassign") | FUB (S-04, S-05) | Turns follow-up discipline into an automatic safety net; not seen in BG | M | B-04, B-05 → `routing` |
| 18 | **Mandate tracking** (type, exclusivity, expiry reminder, signed copy) | OptiEstate, ASARI | Mandates are non-exclusive by default; expiry is a lost-revenue trigger | S–M | N-01 → `mandates` |
| 19 | **Viewing record** with attendees, property, automatic feedback request after the viewing, viewing slip | Alto (feedback 30 minutes after), Reapit, onOffice | Viewings are the central broker activity; feedback feeds seller reports | M | B-13 → `viewings` |
| 20 | **Offer record with negotiation history** | Alto, Reapit | No Bulgarian product shows it; ties to the deposit and notary flow | M | N-02 → `offers` |
| 21 | **Seller activity report** (what was done for the owner: viewings, feedback, inquiries), shareable by Viber or email | REBS, ESTI, Alto (live owner view) | Sellers in BG sign non-exclusive mandates; reporting earns exclusivity | M | N-03 → `reports` |
| 22 | **Free assisted migration** from named Bulgarian tools (Estate Assistant, EstatePlus, PropertyManager exports, Excel) | REBS and ASARI (named competitors), Alto (16-day go-live) | Removes switching cost; builds on the strongest current capability (import) | M per source | N-05 |
| 23 | **Weekly owner email** (new, won/lost, overdue, by source) | Pipedrive, FUB, Alto | Justifies the subscription to the payer | S–M | B-20 → `reports` |
| 24 | **AML identification record** (ЗМИП: ID check, PEP flag, date, responsible person, kept 5 years) | Reapit and Alto (UK AML checks); **no EE CRM** | Legal duty for Bulgarian brokers with large fines; unique locally | M | N-08 (non-goal, `SPEC.md` §1) |
| 25 | **Bulk actions** (assign, add task, change stage) | All mature CRMs | Needed after import and offboarding | M | B-21 |

### 5.3 Nice-to-have, later

| # | Capability | Who has it | Effort | Maps to |
|---|---|---|---|---|
| 26 | Google/Outlook calendar sync | FUB, Lofty, REBS | M | — |
| 27 | Two-way email sync | FUB, Pipedrive, HubSpot | L | — |
| 28 | VoIP telephony integration (Zadarma, UniTalk) with call recording | OptiEstate (UniTalk), Kommo + Zadarma | M | B-10 |
| 29 | Map-drawn search zones for requirements | REBS | M | B-12 |
| 30 | Dual EUR/BGN display and BGN legacy conversion on import | (legal requirement for display; disputed end date) | S | N-09 |
| 31 | Tags and custom fields | All | M | — |
| 32 | File attachments (mandates, ID copies: GDPR-sensitive) | All BG products | M | — |
| 33 | Usage telemetry for the pilot | Internal | S | B-22 |

---

## 6. Conflicts with the pilot non-goals: founder decisions

> **Decided 2026-10-28 (AD-039).** BrokerCRM becomes a **full agency system**: option (B),
> staged as recommended below. Only *listing syndication* leaves the non-goals; every other
> row below stays a non-goal. Bulgaria first. Target customer: residential sales agencies with
> 2–30 brokers. Pricing hypothesis: **€20 per broker per month, all modules included**. The
> paid pilot starts once light properties, requirements and matching ship. See
> `docs/decisions-log.md` AD-039 and `docs/research/business-description.md` *Committed Modules*. The
> table below is kept as the evidence behind that decision.

These were the pilot non-goals; the current list is `SPEC.md` §1. The evidence below doesn't decide them; it shows
the cost of each choice. *(The evidence is Observed; the "Options" column is Recommendation.)*

| Non-goal | Market evidence | Options |
|---|---|---|
| **Listing syndication** | **Table stakes in BG.** Every Bulgarian product publishes to 10–30 portals. alo.bg has a **public JSON import spec and status API** (https://www.alo.bg/import_specification.php). OLX is on the OLX Group Partner API (https://developer.olxgroup.com/). imot.bg reportedly requires a paid 500-listing package for automatic import (vendor claim) and blocks automated access. | (a) Keep it a non-goal and position as the follow-up layer next to the agency's listing tool. That needs import from those tools and a price far below theirs. (b) After properties ship (#6), add syndication to alo.bg first, then OLX; negotiate imot.bg separately. (c) Partner with or integrate a syndication provider. |
| **WhatsApp/Viber inbox** | Viber dominates, but a business Viber bot costs about €100 per bot per month, doesn't pass the client's phone number, and isn't the broker's personal Viber. Bulgarian competitors use Viber for *sending* (offers, sign links), not as a two-way inbox. | Keep the inbox a non-goal. Ship deep links and a log-the-conversation prompt (#2). Revisit sending offers by Viber after properties exist. |
| **Native mobile apps** | Not the norm in BG: OptiEstate, REBS, Immoflux and PropertyManager are PWAs or responsive. Native apps exist at ASARI and (claimed) Estate Assistant. | Keep native apps a non-goal; build a good PWA (#9). |
| **Document generation / e-signature** | OptiEstate, REBS and Immoflux e-sign mandates and viewing slips via Viber or WhatsApp links (Bulgarian e-signature law). | Keep it a non-goal for the pilot; store the signed mandate as a file (#18, #32). Revisit if pilot agencies ask. |
| **Commission accounting** | OptiEstate and REBS tie deals to commission; ASARI forecasts commission against target. | Keep accounting out. Expected commission per side on the opportunity is cheap and feeds reports. |
| **Transaction management** | The Bulgarian flow (preliminary contract, deposit, notary deed) is short. | Model it as stages and dates (#11), not a separate module. |
| **AI lead scoring** | OptiEstate, Realistimo Sfera and Estate Assistant market AI (voice assistants, dictation), but nothing shows it decides purchases. | Keep it a non-goal. |

**Strategic question for the founder** *(answered: B, staged, AD-039)*. Is BrokerCRM (A) a follow-up layer that sits *next to*
an agency's listing tool, or (B) a complete agency system that *replaces* it?
- (A) is cheaper to build but needs import or sync from Estate Assistant, EstatePlus and others,
  and a low price.
- (B) needs #6, #7 and syndication, and competes on price with tools at €0–22 per broker.

*Recommendation:* a staged (B). Build the follow-up wedge and the lightweight property and
matching set first (§5.1). Decide on syndication with pilot evidence, starting with alo.bg's
open spec. Without property and matching, the evidence suggests BrokerCRM is hard to sell on its
own in Bulgaria.

---

## 7. Proposed additions to the pattern benchmark

New patterns found here with no B-ID. `docs/research/crm-benchmark.md` points here but has not
numbered them yet; use B-23 onward when one is accepted.

| ID | Pattern | Seen in | Loop step |
|---|---|---|---|
| N-01 | Mandate record: type, exclusivity, start/end, expiry reminder, signed copy | OptiEstate, ASARI; homes.bg exclusivity rule | 3, 8 |
| N-02 | Offer record with negotiation history and follow-up tasks | Alto, Reapit | 8 |
| N-03 | Seller/owner activity report, shareable | REBS, ESTI, Alto | 8, 9 |
| N-04 | GDPR status per contact: legal basis or consent, keep-until date, logged consent request, deletion worklist, consent-gated matching | onOffice, Alto, HubSpot | 2, 9 |
| N-05 | Free assisted migration from named competitors | REBS, ASARI, Alto | onboarding |
| N-06 | Co-broking network: exchange listings and buyer searches between agencies, client data private | OptiShare, Estate Assistant network, Estate+ network, REBS Colaborare, Cosher | 3 |
| N-07 | Inquiry intake pipeline with visible status (waiting / duplicate / done) and cross-channel duplicate merge | onOffice, Kommo | 1–2 |
| N-08 | AML (ЗМИП) client identification record | Reapit, Alto (UK); none in EE | 2 |
| N-09 | EUR/BGN legacy conversion and dual display | Legal requirement | — |
| N-10 | Stage-entry automation (create task with deadline preset, change owner) | Kommo, FUB, Lofty | 8 |
| N-11 | Process controller: a named person is alerted when a step is missed | onOffice | 9 |
| N-12 | Pricing patterns: flat price per agency with unlimited users; free tier for association members | Realman, Bitrix24, PropertyManager, EstatePlus | go-to-market |

---