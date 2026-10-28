# BrokerCRM competitive gap analysis: Bulgaria and Eastern Europe

> **Date:** 2026-10-28. **Question:** how does BrokerCRM compare with proven real-estate and sales
> CRMs, and what must it add to sell to residential agencies in Bulgaria and Eastern Europe?
> **Status:** research input for `sprint-planning` and for founder decisions. It is not a plan.
>
> **Evidence base** (each file cites its sources claim by claim):
> - `docs/research/brokercrm-feature-inventory.md`: BrokerCRM as built, from the code at commit
>   `5444897`.
> - `docs/research/notes/competitors-international.md`: Follow Up Boss, BoldTrail, Lofty,
>   Sierra, onOffice, Reapit, Alto, Propertybase.
> - `docs/research/notes/competitors-generic.md`: Pipedrive, HubSpot, Bitrix24, Kommo.
> - `docs/research/notes/competitors-eastern-europe.md`: OptiEstate, Estate Assistant,
>   EstatePlus, CRM REBS, ASARI and others, the Bulgarian portals, and local market conventions.
>
> **Labels.** *Observed* = seen on the cited page on 2026-10-28. *Inferred* = a conclusion drawn
> from observed facts. *Recommendation* = this report's advice, for the founder to accept or reject.

---

## 1. Executive summary

1. **BrokerCRM today scores about 2.5/10.** That is the average of the 15 dimensions with
   evidence, against 4.9–7.3 for the products agencies can buy now. The core loop works:
   inquiry → contact → opportunity → next action → Today → manager exceptions. Almost
   everything around it is missing: property listings, matching, lead intake other than typing
   and CSV, reminders, calling and messaging links, reporting, GDPR tools and integrations.
   *(Observed in code: inventory §2.)*
2. **The Bulgarian market already has cheap local products, and they all lead with the same
   offer:** property listings, one-click publishing to 10–30 portals, matching buyers to
   properties, and an exchange network between agencies. Prices run from €0 to €32 per broker
   per month. *(Observed: EE notes §0, §1.)* In Bulgaria, none of them leads with follow-up
   discipline except OptiEstate.
3. **OptiEstate is the direct threat.** It is Bulgarian, priced at €15–32 per broker, and
   already markets on-duty lead routing with a 10-minute escalation, response-time KPIs, required
   lost reasons and deadline tracking (mandate expiry, unconfirmed viewings). Its evidence is thin:
   it names 5 customers and no independent reviews exist. *(Observed: https://opti.estate/llms.txt.)*
4. **None of the US or UK "gold standard" CRMs sells in Bulgaria.** Follow Up Boss, BoldTrail,
   Lofty, Sierra, Reapit and Alto have no Bulgarian interface and no Bulgarian portals. The
   generic CRMs (Pipedrive, HubSpot, Bitrix24, Kommo) have no Bulgarian interface either. They are
   **pattern sources, not competitors**. *(Observed: international notes §0; generic notes §0.)*
5. **The pilot non-goals clash with what Bulgarian agencies buy.** Publishing to portals is a
   pilot non-goal, and listings with matching are post-pilot, yet these are the main reason every
   Bulgarian competitor gets bought. Without them, BrokerCRM is either an add-on next to a listing
   tool or must win clearly on getting leads answered and followed up. *(Inferred.)* This is a
   **founder decision** (§6).
6. **The planned price is 2–5× the local market.** The brief's €99–249 per agency per month plus
   €15–25 per extra user compares with Estate Assistant at about €11 per user, EstatePlus at about
   €52/month for 10 brokers, OptiEstate at €22 per broker *including* website and portals, and
   free tiers. *(Observed: EE notes §1; brief "Pricing And Packaging Hypotheses".)*
7. **Where BrokerCRM can still win.** No Bulgarian product shows the follow-up depth of Follow Up
   Boss: saved lists you work through one by one, automatic rules for who gets a lead, a shared pool
   of unclaimed leads, and follow-up plans that pause when the client replies. Nor does any show
   onOffice-level GDPR tools, an offer record, or a report to the seller. Every competitor's
   evidence is vendor marketing (no independent reviews exist for any Bulgarian product), so a
   product that verifiably works on a phone, and is proven in a pilot, is a credible wedge.
   *(Inferred.)*

**Top recommendation.** Before adding features, fix the defects in the core loop (§5.0). Then
build the "Must-have to sell" tier (§5.1) in roughly this order:
1. Reminders and a daily digest.
2. Click-to-call and Viber/WhatsApp links, with a prompt after each call.
3. Lead intake by email from portals and a website form.
4. Automatic lead routing with escalation.
5. A lightweight property record, buyer requirements and matching.
6. Basic GDPR tools.
7. A PWA.

Decide on portal publishing and pricing before Sprint 7.

---

## 2. Method and limits

- **BrokerCRM** was assessed by reading the code. The app was not run, and some defects are
  marked "by reading" in the inventory.
- **Competitors** were assessed from vendor product, help-centre and pricing pages fetched with
  curl, App Store data, Capterra review pages and search results.
  - Sites that refused automated access were **not** worked around: imot.bg, imoti.net, olx.bg,
    realistimo.com, G2, LinkedIn, Pipedrive pricing, and the FUB, Lofty and Alto help centres.
    Claims about those rest on search snippets and are marked as weaker in the notes.
- **UI/UX scores (dimension 10) are not hands-on.** They come from reviews, demos and screenshots.
  No independent reviews exist for any Bulgarian product or for CRM REBS, so their UI/UX is "n/e"
  (no evidence). BrokerCRM's UI/UX score comes from reading its components.
- **Scoring rubric:** 0 = absent, 2 = token or workaround, 4 = basic, 6 = solid, 8 = strong,
  10 = best in class. "n/e" = no evidence. Averages leave n/e out, so a product with many n/e
  scores is averaged over fewer dimensions and is not directly comparable.
- **Prices** are as of 2026-10-28, excluding VAT, at roughly 1 USD ≈ 0.86 EUR, 1 GBP ≈ 1.15 EUR,
  1 EUR ≈ 4.25 PLN ≈ 25 CZK. BGN is fixed at 1.95583 per EUR.
- **Evidence weight for planning:** the sprint-planning rubric caps benchmark-only ideas (brief:
  "not merely because established CRMs contain them"). This report is **market evidence**, a step
  above a pure benchmark but below pilot evidence (E3). `docs/pilot-feedback.md` is still empty,
  so no gap below has pilot evidence yet.

---

## 3. Scores

### 3.1 BrokerCRM, scored from the code

| # | Dimension | Score | Why (evidence in `brokercrm-feature-inventory.md`) |
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
| 15 | Pricing fit | **n/e** | Not built. The brief's hypothesis (€99–249/agency + €15–25/user) would score about **3** against local prices (§4.3). |
| 16 | Multi-office / admin | **4** | Three roles, invitations and proven tenant isolation. No teams, no "own records only" visibility, no agency-settings screen, one office only, and brokers can edit stages and sources (§2.12). |
| | **Average (15 scored)** | **2.5** | |

### 3.2 Bulgarian and Eastern European products: the real alternatives

| Dimension | **BrokerCRM** | OptiEstate (BG) | Estate Assistant (BG) | EstatePlus (BG) | CRM REBS (RO) | ASARI (PL) |
|---|---|---|---|---|---|---|
| 1 Lead capture | 2 | 8 | 4 | 2 | 5 | 6 |
| 2 Routing | 1 | 8 | n/e | n/e | n/e | n/e |
| 3 Follow-up | 4 | 7 | 5 | 3 | 8 | 7 |
| 4 Contact & deal | 4 | 7 | 5 | 4 | 7 | 8 |
| 5 Property & matching | 0 | 9 | 8 | 7 | 9 | 8 |
| 6 Communication | 1 | 6 | 7 | 3 | 7 | 6 |
| 7 Viewings & offers | 1 | 7 | 4 | 3 | 7 | 4 |
| 8 Reporting | 3 | 8 | 6 | n/e | 8 | 8 |
| 9 Mobile | 2 | 5 | 5 | 4 | 6 | 7 |
| 10 UI/UX | 4* | n/e | n/e | n/e | n/e | n/e |
| 11 Integrations / portals | 0 | 8 | 7 | 8 | 8 | 8 |
| 12 Import | 5 | 6 | 3 | n/e | 8 | 8 |
| 13 Localization (BG) | 6 | 9 | 7 | 8 | 2 | 1 |
| 14 GDPR | 1 | 6 | 3 | 3 | 5 | n/e |
| 15 Pricing fit | n/e | 7 | 9 | 9 | 9 | 5 |
| 16 Multi-office | 4 | 9 | 7 | 5 | 7 | 8 |
| **Average (n scored)** | **2.5 (15)** | **7.3 (15)** | **5.7 (14)** | **4.9 (12)** | **6.9 (14)** | **6.5 (13)** |
| Price, 2026-10-28 | not built | €15 / €22 / €32 per broker/mo | ≈ €11–13 per user/mo | €12.27–21.47 per agency + €5–6 per extra broker | €4.99–14.99 per user/mo (annual) | ≈ €18–59 per user/mo |

\* From reading the code. Every competitor score here rests on **vendor marketing only**;
see EE notes §5. Sources per cell: EE notes §1.1–1.5.

### 3.3 Pattern-setters: what "proven" looks like

| Dimension | FUB | onOffice | Reapit | Alto | Pipedrive | HubSpot | Bitrix24 | Kommo |
|---|---|---|---|---|---|---|---|---|
| 1 Lead capture | 8 | 8 | 8 | 8 | 6 | 7 | 7 | 7 |
| 2 Routing | **9** | 4 | n/e | n/e | 4 | 6 | 7 | 5 |
| 3 Follow-up | **9** | 8 | 6 | 6 | 8 | 8 | 6 | 7 |
| 4 Contact & deal | 6 | 7 | 8 | 8 | 8 | 8 | 7 | 7 |
| 5 Property & matching | 2 | **10** | 8 | 8 | 2 | 4 | 4 | 2 |
| 6 Communication | 8 | 7 | 6 | 6 | 5 | 6 | 7 | 8 |
| 7 Viewings & offers | 2 | 7 | **9** | **9** | 2 | 3 | 4 | 3 |
| 8 Reporting | 7 | 6 | 8 | 7 | 6 | 7 | 6 | 6 |
| 9 Mobile | 6 | 7 | 6 | n/e | 6 | 8 | 6 | 5 |
| 10 UI/UX | 8 | n/e | 4 | 4 | 8 | 7 | 4 | 7 |
| 11 Integrations | 9 | 9 | 8 | 7 | 7 | 8 | 7 | 6 |
| 12 Import | 7 | 6 | 6 | **9** | 6 | 7 | 5 | 6 |
| 13 Localization (BG) | 1 | 5 | 2 | 1 | 3 | 2 | 3 | 2 |
| 14 GDPR | n/e | **9** | 7 | 7 | 4 | 8 | 5 | 3 |
| 15 Pricing fit (EE) | 3 | 3 | 2 | 2 | 6 | 4 | **9** | 5 |
| 16 Multi-office | 7 | 7 | 9 | 7 | 6 | 7 | 7 | 5 |
| **Average (n scored)** | 6.1 (15) | 6.9 (15) | 6.5 (15) | 6.4 (14) | 5.4 (16) | 6.3 (16) | 5.9 (16) | 5.3 (16) |

BoldTrail (avg ≈ 5.5 over 13), Lofty and Sierra have lower or US-bound scores: see international notes
§1.9. Prices and sources per cell: international notes §1, generic notes §1–4.

### 3.4 What the scores say

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

## 4. The Bulgarian market: facts that should shape the product

### 4.1 Market shape

- **Small agencies.** Eurostat counts 3,267 Bulgarian real-estate agencies with 6,932 people in
  2024, about 2.1 people per agency, up from 2,806 agencies in 2021
  (https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sbs_ovw_act?geo=BG&nace_r2=L6831&indic_sbs=ENT_NR&indic_sbs=EMP_NR).
  The 2–30-broker target is the upper tail of a micro-agency market. *(Observed; the
  interpretation is inferred.)*
- **Portals are buying CRMs across the region:**
  - Njuškalo bought Dimedia (HR/RS).
  - Spitogatos invested in Fortunet (GR).
  - Realistimo built Sfera (BG).
  - Bulgaria's largest network, Realto (about 1,000 brokers), built its own CRM, Cosher.

  *(EE notes §1.6; the Cosher evidence is LinkedIn snippets only.)* *Inferred:* large networks
  build their own and small agencies take cheap bundled tools, so the open segment is
  independent agencies of 3–30 brokers that outgrow listing tools.
- **Co-broking between agencies is its own product category.** It is offered by the Estate
  Assistant network, the Estate+ network, OptiShare, REBS Colaborare, ASGAL MLS and Cosher. In
  practice it still happens largely in Facebook and Viber groups (EE notes §3).

### 4.2 Workflow conventions a Bulgarian CRM must model

| Convention | Evidence | What it means for the product |
|---|---|---|
| Mandates are **non-exclusive by default**; exclusivity needs a clause; contracts carry anti-circumvention penalties | https://www.innovires.com/blog/posrednicheska-deynost-imoti.html | A **mandate record**: type, start and end, exclusive flag, signed copy, and a reminder before expiry. OptiEstate and ASARI track expiry. homes.bg lets only the exclusive agency list an exclusive property (https://www.homes.bg/terms §4.3.19) |
| Commission is **2–3% from each side** on sales, one month's rent on lettings, plus VAT if registered | Innovires (above) | Expected commission per opportunity, per side. A pilot non-goal is commission *accounting*, but *expected value* is already a field |
| Deal flow: preliminary contract with ~**10% deposit** (капаро), then the **notary deed** | https://www.innovires.com/blog/pokupka-na-imot.html (snippet) | Default stages and dates: "Deposit / preliminary signed" and "Notary date". OptiEstate counts deposits as a KPI |
| Brokers are **AML obliged entities** (ЗМИП art. 4(18)): client identification, PEP checks, records kept for 5 years, fines up to BGN 200,000 | Innovires (above) | A simple identification-check record per client. **No CRM reviewed advertises it**: a niche differentiator |
| **Viber** is the default messenger (company claims of 90% share in 2021) | https://seenews.com/news/viber-grows-market-share-in-bulgaria-to-focus-on-dedicated-business-space-in-2022-770066 (snippet) | `viber://` and `tel:` links everywhere, plus a log-the-call prompt. Business Viber bots cost about €100 per bot per month and don't pass the client's phone number (generic notes §0), so **deep links beat an integration** for the pilot |
| **Euro since 2026-01-01** at 1.95583 BGN/EUR; the end date for dual price display is disputed (2026-08-08 vs 2027-01-01) | https://www.fibank.bg/en/introduction-of-the-euro-in-the-republic-of-bulgaria ; https://dpc.bg/insights/dual-price-display-and-currency-exchange-in-the-context-of-euro-adoption | Store EUR. Convert legacy BGN on import at the fixed rate. Optionally show BGN alongside EUR while the law requires it |
| **GDPR complaints** to the CPDP are rising (+60% in 2025), mostly about processing without a legal basis | https://cms.law/en/bgr/publication/gdpr-enforcement-tracker-report/bulgaria | Legal basis or consent per contact, export, erasure and retention. Be careful with "private seller" feeds harvested from portals, which REBS, Immoflux, ESTI and OptiShare offer |

### 4.3 Price anchors (2026-10-28)

| Product | Price | 10 brokers/month |
|---|---|---|
| PropertyManager (BG) | free tier; €9–17/mo | €0–17 |
| EstatePlus (BG) | €21.47 + €5.11 per extra broker | ≈ €52 |
| Estate Assistant (BG) | ≈ €11.25 per account (12-month term) | ≈ €113 |
| CRM REBS (RO) | €4.99–14.99 per user (annual) | €50–150 |
| Bitrix24 (generic) | flat €99 for up to 50 users | €99 |
| OptiEstate (BG) | €22 per broker (Основен plan), website and portals included | €220 |
| **BrokerCRM hypothesis** | €99–249 per agency + €15–25 per extra user + €150–500 setup | **≈ €249+** |
| onOffice (DE) | €79–99 per user, 24-month contract | €790–990 |

*Recommendation:* test a price at or below OptiEstate per broker, and consider REBS/Realman-style
free migration or a flat price per agency (Realman: unlimited users at €51–139 per agency,
https://www.realman.cz/). Charging more than local tools needs pilot proof of results, such as
leads answered faster and fewer forgotten deals.

---

## 5. Gap list

Priority: **Must** = needed to sell in Bulgaria; **Diff** = a differentiator that supports the
wedge; **Nice** = later. Effort: **S** ≤ 3 dev-days, **M** 1–2 weeks, **L** 3+ weeks; these are
rough guesses before design. *B-xx* refers to
`.claude/skills/sprint-planning/references/crm-benchmark.md`. *N-xx* are new patterns proposed
in §7. The rule stays: **borrow patterns, never copy UI, text or branding**.

### 5.0 Fix first: defects in what's built (inventory §3, §4)

These break the follow-up promise the product is built on, and they're cheap. *(Observed or
"by reading" in code.)*

| Defect | Effort |
|---|---|
| Today shows the literal text `t('dueTodayTime', …)` for tasks due today (`task-card.tsx:121`); dates in Bulgarian mode use English month names; a task can appear in both "Overdue" and "Due today" | S |
| Completing a task on the opportunity page drops the next task and the stage change (`opportunities/[id]/tasks/actions.ts:72-94`; by reading) | S |
| Tasks can't be edited, rescheduled or cancelled, and inquiries can't be edited or reassigned: the server actions exist but no screen calls them | S–M |
| Inquiry phone and email aren't normalized, and the duplicate check at conversion compares names only | S |
| Only Bulgarian mobile numbers are accepted; foreign buyers and landlines are rejected | S |
| Task due times are read in the server's timezone, not the agency's (by reading) | S |
| Lists have no pagination UI; opportunities are capped at 200 rows and contact pickers at 200 | M |
| Import revert can delete contacts that have notes; the import recheck writes a `match_reason` value the schema rejects | S |
| Brokers can change stages and lead sources and merge contacts; the role checks are missing | S |

### 5.1 Must-have to sell

| # | Capability | Who has it (evidence) | Why it matters in EE specifically | Effort | Maps to |
|---|---|---|---|---|---|
| 1 | **Reminders and daily digest** (email and in-app; due, overdue, new inquiry) | FUB, Pipedrive, HubSpot; OptiEstate "morning briefing"; REBS email reminders | Without them a broker must open the app to learn of work, which breaks the core promise. Every Bulgarian competitor reminds | M | B-02 (AD-025 decided, not built) |
| 2 | **Click-to-call, `viber://`, `wa.me` and `mailto:` links**, plus a **post-call prompt** ("answered?" → notes and next step, or remind in 1h / tonight / tomorrow) | REBS mobile (https://www.crmrebs.ro/blog/aplicatia-mobila-crm-rebs-webinar-de-lansare/); Pipedrive follow-up pop-up; FUB dialer | Phone- and Viber-first culture; cheapest way to make logging calls a habit | S–M | B-07, B-09, B-10 |
| 3 | **Portal lead intake by email** (parse inquiry emails from homes.bg, imot.bg, alo.bg and others into inquiries with source and external ref; status waiting / duplicate / done) | onOffice Enquiry Manager; ESTI "portal inquiry reader"; Realman (3M inquiries from 32 sources); Reapit internet registrations | homes.bg emails inquiries to the lister (terms); no Bulgarian portal has a lead API, so email is the practical path. The `external_ref` key is ready | M–L | B-16, N-07 |
| 4 | **Website form and API endpoint** for inquiries (with source and campaign) | OptiEstate (Meta Lead Ads, Google forms); FUB API; Bitrix24 forms | Agencies run their own sites and Facebook ads; inquiries lost between channels are the core problem | M | B-16 |
| 5 | **Automatic lead routing**: round robin, on-duty broker, and escalation if not accepted in N minutes | FUB (rules and first-to-claim); OptiEstate (10-minute escalation); Bitrix24 (skips absent staff) | The local leader already sells it; speed-to-lead is the brief's main metric | M | B-04 |
| 6 | **Lightweight property record** (address or area, type, rooms, m², price, owner, mandate) linked to opportunities | All BG/RO/PL products; Reapit, Alto, onOffice | Every Bulgarian product is property-first; brokers think in properties. The pilot brief already includes "lightweight property reference" | L | B-11 (property side), N-01 |
| 7 | **Buyer/tenant requirements and two-way matching** (required criteria + match score, "already offered" list) | onOffice (10), Reapit, Alto, REBS, OptiEstate, Estate Assistant, EstatePlus | Core purchase reason in BG; the pilot brief includes requirements; BRD targets Sprint 7 | L | B-11, B-12 |
| 8 | **GDPR basics**: legal basis or consent per contact, export of one contact's data, erasure or anonymisation, retention date and deletion worklist | onOffice (9), HubSpot (8), Reapit and Alto (7); no Bulgarian product above 6 | CPDP complaints up more than 60% in 2025; personal data from portals and Viber campaigns is a risk | M | N-04 |
| 9 | **PWA**: installable, push notifications, search and quick actions on phones | OptiEstate, REBS, PropertyManager (PWAs); native apps are not the norm in BG | Brokers work in the field; a good PWA matches the competition, and native apps stay a non-goal | M | B-09 |
| 10 | **Kanban board** with drag to change stage and next-action colour coding (overdue / today / none) | Pipedrive (reference), ASARI, HubSpot, Bitrix24 | Managers expect a board; colour by next-action state *is* the wedge, made visible | M | B-19, B-07 |
| 11 | **Lost-reason list and stage rules** (required fields on entering a stage; deposit and notary-date stages) | Pipedrive, HubSpot, OptiEstate | Data quality for reporting; the Bulgarian deal flow has fixed milestones | S–M | B-14, B-15 |
| 12 | **Basic reports**: inquiries by source, speed to first contact, conversion by stage, win/loss and reasons, per-broker activity | Sierra and FUB (speed-to-lead per agent); OptiEstate KPIs; REBS; ASARI | Owners pay for visibility; "uncontacted after 1 business day" is a brief success metric. Needs a first-contact timestamp | M | B-05, B-20 |
| 13 | **Saved lists ("Smart Lists")** with counts, worked through one by one | FUB (S-01), Close, HubSpot task queues; REBS "no future activities" filter | In the pilot brief's included scope; BRD deferred to Sprint 6 | M | B-01, B-08 |
| 14 | **Offboarding and cover**: bulk reassignment when a broker leaves, cover during absence | ESTI ("employee substitution"), Bitrix24 (skips absent staff), Salesforce/HubSpot | The brief: "history disappears when a broker leaves" | S–M | B-18 |
| 15 | **Agency settings screen** (name, timezone, currency, logo) and data export (CSV) | All products | Today these can be changed only in the database; export is also needed for GDPR and trust | S | — |

### 5.2 Differentiators (support the wedge)

| # | Capability | Who has it | Why it matters in EE | Effort | Maps to |
|---|---|---|---|---|---|
| 16 | **Action plans** (reusable task sequences, paused when the client replies or the stage changes) | FUB, Sierra, Lofty; Immoflux "activity groups"; Kommo stage triggers | No Bulgarian product shows sequences | M–L | B-03, N-10 |
| 17 | **Shared lead pool** (unclaimed or neglected leads go to a claimable pool; "uncontacted on day 2 → reassign") | FUB (S-04, S-05) | Turns follow-up discipline into an automatic safety net; not seen in BG | M | B-04, B-05 |
| 18 | **Mandate tracking** (type, exclusivity, expiry reminder, signed copy) | OptiEstate, ASARI | Mandates are non-exclusive by default; expiry is a lost-revenue trigger | S–M | N-01 |
| 19 | **Viewing record** with attendees, property, automatic feedback request after the viewing, viewing slip | Alto (feedback 30 minutes after), Reapit, onOffice | Viewings are the central broker activity; feedback feeds seller reports | M | B-13 |
| 20 | **Offer record with negotiation history** | Alto, Reapit | No Bulgarian product shows it; ties to the deposit and notary flow | M | N-02 |
| 21 | **Seller activity report** (what was done for the owner: viewings, feedback, inquiries), shareable by Viber or email | REBS, ESTI, Alto (live owner view) | Sellers in BG sign non-exclusive mandates; reporting earns exclusivity | M | N-03 |
| 22 | **Free assisted migration** from named Bulgarian tools (Estate Assistant, EstatePlus, PropertyManager exports, Excel) | REBS and ASARI (named competitors), Alto (16-day go-live) | Removes switching cost; builds on the strongest current capability (import) | M per source | N-05 |
| 23 | **Weekly owner email** (new, won/lost, overdue, by source) | Pipedrive, FUB, Alto | Justifies the subscription to the payer | S–M | B-20 |
| 24 | **AML identification record** (ЗМИП: ID check, PEP flag, date, responsible person, kept 5 years) | Reapit and Alto (UK AML checks); **no EE CRM** | Legal duty for Bulgarian brokers with large fines; unique locally | M | N-08 |
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

`AGENTS.md` lists these as pilot non-goals. The evidence below doesn't decide them; it shows
the cost of each choice. *(The evidence is Observed; the "Options" column is Recommendation.)*

| Non-goal | Market evidence | Options |
|---|---|---|
| **Listing syndication** | **Table stakes in BG.** Every Bulgarian product publishes to 10–30 portals (EE notes §1). alo.bg has a **public JSON import spec and status API** (https://www.alo.bg/import_specification.php). OLX is on the OLX Group Partner API (https://developer.olxgroup.com/). imot.bg reportedly requires a paid 500-listing package for automatic import (vendor claim) and blocks automated access. | (a) Keep it a non-goal and position as the follow-up layer next to the agency's listing tool. That needs import from those tools and a price far below theirs. (b) After properties ship (#6), add syndication to alo.bg first, then OLX; negotiate imot.bg separately. (c) Partner with or integrate a syndication provider. |
| **WhatsApp/Viber inbox** | Viber dominates, but a business Viber bot costs about €100 per bot per month, doesn't pass the client's phone number, and isn't the broker's personal Viber (generic notes §0). Bulgarian competitors use Viber for *sending* (offers, sign links), not as a two-way inbox. | Keep the inbox a non-goal. Ship deep links and a log-the-conversation prompt (#2). Revisit sending offers by Viber after properties exist. |
| **Native mobile apps** | Not the norm in BG: OptiEstate, REBS, Immoflux and PropertyManager are PWAs or responsive. Native apps exist at ASARI and (claimed) Estate Assistant. | Keep native apps a non-goal; build a good PWA (#9). |
| **Document generation / e-signature** | OptiEstate, REBS and Immoflux e-sign mandates and viewing slips via Viber or WhatsApp links (Bulgarian e-signature law). | Keep it a non-goal for the pilot; store the signed mandate as a file (#18, #32). Revisit if pilot agencies ask. |
| **Commission accounting** | OptiEstate and REBS tie deals to commission; ASARI forecasts commission against target. | Keep accounting out. Expected commission per side on the opportunity is cheap and feeds reports. |
| **Transaction management** | The Bulgarian flow (preliminary contract, deposit, notary deed) is short. | Model it as stages and dates (#11), not a separate module. |
| **AI lead scoring** | OptiEstate, Realistimo Sfera and Estate Assistant market AI (voice assistants, dictation), but nothing shows it decides purchases. | Keep it a non-goal. |

**Strategic question for the founder.** Is BrokerCRM (A) a follow-up layer that sits *next to*
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

New patterns found here with no B-ID. These are proposals for
`.claude/skills/sprint-planning/references/crm-benchmark.md`; that file has **not** been
edited. Use B-23 onward if they are accepted.

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

## 8. Open questions that could change the recommendation

1. **imot.bg:** agency package prices, the feed format, and whether any inquiry export exists.
   The site blocks automated access and nothing is public, so this needs a sales call.
2. **OLX Bulgaria:** does the Partner API deliver real-estate *leads* (messages or webhooks) in
   BG, or only publish ads?
3. **Real market share** of Bulgarian CRMs. No vendor except Estate Assistant states customer
   counts, and no survey exists. Pilot agencies can be asked what they use today.
4. **Whether pilot agencies want BrokerCRM to replace or sit next to their listing tool** (§6).
   This is the most important question for the pilot, and `docs/pilot-feedback.md` is empty.
5. **Willingness to pay** against the €0–22 per broker anchors.
6. **End date of dual price display** (2026-08-08 vs 2027-01-01) and whether it applies to
   listings.
7. **Standard inter-agency commission split** in Bulgaria (no authoritative source found).
8. **Whether any CPDP decisions concern real-estate agencies** (owner-contact harvesting,
   marketing calls).
9. **Greek, Slovenian and Serbian products** were covered only lightly.

---

## 9. Sources

Per-claim citations are in the four evidence files listed at the top. Key primary sources:

- Bulgarian competitors: https://opti.estate/llms.txt · https://www.estateassistant.eu/ ·
  https://estateplus.net/bg/plans · https://estateplus.net/bg/features ·
  https://propertymanager.maxprogress.bg/
- Regional: https://www.crmrebs.ro/functionalitati/ · https://www.crmrebs.ro/pret/ ·
  https://asaricrm.com/program-dla-biur-nieruchomosci/cennik/ · https://www.realman.cz/ ·
  https://immoflux.ro/preturi-crm · https://www.esticrm.pl/cennik
- Portals: https://www.homes.bg/terms · https://www.alo.bg/import_specification.php ·
  https://developer.olxgroup.com/
- Pattern-setters: https://www.followupboss.com/pricing ·
  https://onoffice.com/en/real-estate-software/ · https://www.reapit.com/platform/sales-crm ·
  https://www.altosoftware.co.uk/solutions/how-we-compare/ · https://www.bitrix24.eu/prices/ ·
  https://knowledge.hubspot.com/tasks/use-task-queues
- Market and law: Eurostat SBS (link in §4.1) ·
  https://www.innovires.com/blog/posrednicheska-deynost-imoti.html ·
  https://www.fibank.bg/en/introduction-of-the-euro-in-the-republic-of-bulgaria ·
  https://cms.law/en/bgr/publication/gdpr-enforcement-tracker-report/bulgaria
