# Competitors: Eastern Europe (Bulgaria first)

> Research date: 2026-10-28. Scope: real-estate CRMs used by agencies in Bulgaria and neighbouring
> EE markets, the Bulgarian portal ecosystem, and local needs that US CRMs ignore.
> Method: vendor pages, portal terms and docs fetched with curl and pandoc, plus web search.
> Sites that returned 403/999 were not worked around: imot.bg, imoti.net, olx.bg,
> realistimo.com, capital.bg (2026 article) and LinkedIn. For those I used search-result
> snippets, marked **(snippet)**, which are weaker evidence.
> **O** = Observed on the cited page. **I** = Inferred.
> Currency: prices are as shown on 2026-10-28, excluding VAT unless stated. Approximate rates:
> 1 EUR ≈ 4.25 PLN, ≈ 25 CZK. BGN is fixed at 1.95583 per EUR.
> UI/UX scores are **not hands-on**. No independent reviews were found for any EE product
> (G2/Capterra/Trustpilot have none or empty pages), so dimension 10 is "n/e" throughout.

---

## 0. Landscape at a glance

| Product | Country | Type | Scale claim | Price as of 2026-10-28 | Scored |
|---|---|---|---|---|---|
| OptiEstate (Techtonify) | BG | All-in-one: CRM, listings, website, portals, AI | 5 named agencies; "50 versions/yr" | €15 / €22 / €32 per broker/mo | Yes |
| Estate Assistant | BG | Listing + CRM, broker network, ~30 portals | "hundreds of brokers", 10+ yrs, agencies of 1 to 100+ brokers | from 22 BGN ≈ €11.25 per account/mo | Yes |
| EstatePlus (Estate+) | BG | Cloud listing DB + portal export + network | n/e | €0 / €12.27 / €21.47 per agency/mo + €5–6 per extra broker | Yes |
| CRM REBS | RO | CRM + portals + website + MLS | 1,000+ companies, 3,700+ users | €4.99–14.99 per user/mo (annual) | Yes |
| ASARI CRM | PL | CRM + portals + WWW + MLS | 1,500+ agencies and developers | 77–249 PLN ≈ €18–59 per user/30 days | Yes |
| PropertyManager / MaxEstates (MaxProgress) | BG | Listing CRM, website, portals; free tier | since 2018 | €0, or €9–17/mo | No |
| Realistimo Sfera | BG | Portal-owned CRM + AI caller "Rea" | n/e | n/e | No |
| Cosher (Realto Group) | BG | In-house, not sold | ~1,000 brokers | not sold | No |
| Immoflux | RO | CRM + MLS + automations | 500+ agencies, 2,500+ agents | €10–19 per user/mo | No |
| ESTI CRM | PL | CRM + portal export + portal-inquiry reader | n/e | 127 PLN + 85 PLN per extra user | No |
| Realman | CZ | CRM, flat price with unlimited users | 1,120+ agency licences | 1,278–3,478 CZK ≈ €51–139 per agency/mo | No |
| Dimedia | HR/RS/BA/ME | Portal-owned (Njuškalo) agency CRM | 200+ agencies | n/e | No |
| Fortunet Hellas | GR | Portal-backed (Spitogatos) CRM | "No.1 RE CRM" | n/e | No |
| Maija | FI → BG/RS/AL | CRM + MLS + 80+ portals | n/e | n/e | No |

The pattern across the region: portals are buying or building CRMs. Njuškalo bought Dimedia (2023),
Spitogatos invested in Fortunet (2021), and Realistimo built Sfera (sources in §1.6). In
Bulgaria, every product found leads with **listing inventory + one-click portal syndication +
buyer-requirement matching + an inter-agency exchange network**. None leads with lead follow-up
discipline. OptiEstate (routing and reminders) is a partial exception.

---

## 1. Products

### 1.1 OptiEstate (Techtonify), Bulgaria — the most direct competitor

Positioning: a Bulgarian "all-in-one" agency system. It bundles CRM, listings, an agency website,
publishing to 10+ Bulgarian portals, a marketing studio, AI and an optional finance module. It
targets agencies and developers selling new builds, and claims to fit "from 1 to 100 brokers"
(https://opti.estate/, https://opti.estate/llms.txt) **O**. Named customers: SProperties, Esteem,
Masis Estate, United Buildings and Аура Имоти (https://opti.estate/llms.txt) **O**. UI in 7
languages (BG, EN, DE, RU, EL, RO, TR) **O**. **Pricing as of 2026-10-28** (excl. VAT, per broker
per month): Старт €15 (max 3 brokers, 1 office), Основен €22, Про €32. Paying annually costs 10
months instead of 12. The worked example on the page is 8 brokers on Основен = €176/mo. Add-ons:
site chatbot €50/mo, MCP AI access €30/mo per agency on Основен, NFC cards €2 per card
(https://opti.estate/llms.txt) **O**.

| Dimension | Score | Justification | Source |
|---|---|---|---|
| 1 Lead capture | 8 | Meta Lead Ads, Google Ads forms, website, popups/landings and "portals" put inquiries straight into the CRM with campaign name (O). The mechanism for portal inquiries is not stated; email parsing is likely (I). | https://opti.estate/ ; https://opti.estate/llms.txt |
| 2 Lead routing | 8 | Unassigned inquiries go to an on-duty agent. If not accepted within 10 minutes they pass to a colleague, and night inquiries wait for the morning shift (O). | https://opti.estate/ |
| 3 Follow-up discipline | 7 | The system tracks deadlines for the broker: expiring brokerage mandate, a promised call, a viewing in 1h without seller confirmation, a listing with no inquiries, an expiring portal ad, an unanswered web inquiry. Recurring tasks and a morning briefing (O). No sequences/action plans found. | https://opti.estate/ ; https://opti.estate/llms.txt |
| 4 Contact & deal mgmt | 7 | Contacts with roles (buyers, sellers, tenants, lawyers, notaries, banks), deals tied to property and commission, lost deals ask for a reason on archive (O). No explicit pipeline board seen. | https://opti.estate/llms.txt |
| 5 Inventory & matching | 9 | Full listing management. Auto match property↔requirement with broker notification. OptiShare: 200k+ listings from agencies, portals and private sellers, deduplicated to "1 property = 1 row". CMA, new-build projects (O). | https://opti.estate/ |
| 6 Communication | 6 | UniTalk IP telephony (click-to-call, call log, recordings), Mailjet campaigns. Viber/WhatsApp used for sign links and auto-posting. SMS "coming" (O). No two-way messenger inbox. | https://opti.estate/llms.txt |
| 7 Viewings & offers | 7 | Viewings in calendar with seller-confirmation reminders. Contracts from templates with "Fill with AI". Simple e-signature by link via Viber/WhatsApp/SMS/email (ЗЕДЕУУ art. 13(4)) with an audit page (O). | https://opti.estate/ |
| 8 Reporting & oversight | 8 | Goals per person, team or office. KPIs include "% answered within N min", average response time, calls >N s, viewings, mandates, deposits. On-pace indicator, and periods lock 3 days after close (O). | https://opti.estate/llms.txt |
| 9 Mobile | 5 | PWA only, with responsive lists-as-cards and one-click call (O). No native app. | https://opti.estate/llms.txt |
| 10 UI/UX & onboarding | n/e | Vendor screenshots and 2 vendor-quoted Google reviews only. Accessibility settings (text size, contrast, reduced motion) are a plus (O). | https://opti.estate/llms.txt |
| 11 Integrations / API / syndication | 8 | imot.bg, alo.bg, imoti.net, OLX.bg (OAuth), Indomio, Domaza, Realistimo, IMI and others. Chrome extension for imot.bg uploads when the agency lacks imot.bg's 500-listing package. MCP server (121 tools, OAuth 2.1). GA4, Meta Conversions API, iCal (O). No general REST API documented. | https://opti.estate/llms.txt |
| 12 Data import / migration | 6 | Vendor-assisted migration of properties, clients and listings from files, Google Contacts and portals (O). | https://opti.estate/llms.txt |
| 13 Localization (BG) | 9 | Built for Bulgaria: BG document templates, BG portals, EUR, e-signature under Bulgarian law, Cyrillic/Latin search (O). | https://opti.estate/llms.txt |
| 14 GDPR / compliance | 6 | Newsletter consents and unsubscribe centre. Sending contact PII to AI providers is off by default. EU servers, audit log, 2FA/passkeys, admin IP lock (O). No DSAR or retention tooling seen. | https://opti.estate/llms.txt |
| 15 Pricing fit (2–30 brokers) | 7 | €22/broker → €44–660/mo for 2–30 brokers. Includes website and portals, but costs about 2× Estate Assistant/EstatePlus (I). | https://opti.estate/llms.txt |
| 16 Multi-office / admin | 9 | 270 separate permissions, unlimited manager hierarchy with data scope, offices, org chart, active sessions (O). | https://opti.estate/llms.txt |

### 1.2 Estate Assistant, Bulgaria — the incumbent with a broker network

Positioning: a Bulgarian SaaS for agencies, "serving the best agencies in Bulgaria for 10+
years". Customers range from agencies with 100+ brokers to one-broker shops. Hosted on AWS,
office in Sofia (https://www.estateassistant.eu/) **O**. **Pricing as of 2026-10-28:** per
account per month, 22 BGN on a 12-month term (≈ €11.25), 24 BGN on 6 months (≈ €12.27), 26 BGN
on 3 months (≈ €13.29). Unlimited listings, photos, contacts and buyers. 30-day free trial
(https://www.estateassistant.eu/) **O**. The page still quotes prices only in BGN ten months
after the euro changeover **O**, which suggests the vendor is slow to update (I).

| Dimension | Score | Justification | Source |
|---|---|---|---|
| 1 Lead capture | 4 | AI voice assistant answers calls and books meetings. Website chatbot. Dictation-based client entry (O). No portal-inquiry or email-to-lead capture seen. | https://www.estateassistant.eu/ |
| 2 Lead routing | n/e | — | — |
| 3 Follow-up discipline | 5 | Agency and broker calendars, tasks, call tasks, birthdays. The AI calls the client 1h before a meeting to remind them (O). No sequences. | https://www.estateassistant.eu/ |
| 4 Contact & deal mgmt | 5 | Clients, owners, call/meeting notes, change log (O). No pipeline evidence. | https://www.estateassistant.eu/ |
| 5 Inventory & matching | 8 | Photo archive and editor, price history, CMA. Matching against the agency **and a network of hundreds of brokers** (O). | https://www.estateassistant.eu/ |
| 6 Communication | 7 | Send offers by email or **Viber**. Email, Viber and phone campaigns. Internal chat. The Android app acts as a phone exchange with dictated after-call notes (O). | https://www.estateassistant.eu/ |
| 7 Viewings & offers | 4 | Meetings in calendar (O). No viewing feedback or offer handling seen. | https://www.estateassistant.eu/ |
| 8 Reporting & oversight | 6 | "Hundreds" of reports, a drag-and-drop report builder, per-broker reports and action log (O). | https://www.estateassistant.eu/ |
| 9 Mobile | 5 | Native iOS and Android apps claimed (O). The Android build is linked as a sideloaded APK, and the iTunes lookup for the App Store id returned no result for the BG store (O), so the iOS app may be unlisted. | https://www.estateassistant.eu/ ; https://itunes.apple.com/lookup?id=1508759222&country=bg |
| 10 UI/UX & onboarding | n/e | Claims "new modern design" and video training (O). No reviews found. | https://www.estateassistant.eu/ |
| 11 Integrations / syndication | 7 | Auto-publishes to "close to 30" BG portals and auto-updates in "90%" of them. Shows portal view stats. JSON export for agency sites. A third-party WordPress plugin (EstateSync) (O). No public API. | https://www.estateassistant.eu/ |
| 12 Data import / migration | 3 | Mentions "manual adding or importing a property" (O). No migration service described. | https://www.estateassistant.eu/ |
| 13 Localization (BG) | 7 | Bulgarian-native and BG portals (O). Pricing still in BGN only (O). | https://www.estateassistant.eu/ |
| 14 GDPR / compliance | 3 | Google Authenticator 2FA, per-broker action log, 100+ permission settings (O). The GDPR page is only a website privacy notice. | https://estateassistant.eu/gdpr.html |
| 15 Pricing fit | 9 | ≈ €11–13 per user → ≈ €23–400/mo for 2–30 users (I). | https://www.estateassistant.eu/ |
| 16 Multi-office / admin | 7 | "100+ additional settings" for per-broker access rights, detailed action log (O). Multi-office not explicit. | https://www.estateassistant.eu/ |

### 1.3 EstatePlus (Estate+ Cloud), Bulgaria — cheapest, broadest published portal list

Positioning: a browser-based database of listings, clients and buyer searches with portal export.
Originally built by Ардес ИТ, then rewritten by M&G Development. UI in BG, EN, RU and ES
(https://estateplus.net/bg/features, https://estateplus.net/bg/za-nas) **O**. **Pricing as of
2026-10-28** (excl. VAT, per agency per month): free 7-day demo (5 listings). Standard €12.27
(2 brokers, 600 listings; extra broker €6.13). Business €21.47 (4 brokers, 3,000 listings; extra
broker €5.11). −10% for 6 months, −20% for 12 months. Free "Estate+ network" accounts, including
for members of the НСНИ, АРБИ and НСБИ broker associations (https://estateplus.net/bg/plans) **O**.
Example: 10 brokers on Business = 21.47 + 6 × 5.11 = **€52.13/mo** (I).

| Dimension | Score | Justification | Source |
|---|---|---|---|
| 1 Lead capture | 2 | Only "received e-mail messages" in the action history (O). | https://estateplus.net/bg/features |
| 2 Lead routing | n/e | — | — |
| 3 Follow-up discipline | 3 | History of calls, viewings, emails and meetings. "New match" notifications (up to 5 subscriptions per broker) (O). No tasks or reminders described. | https://estateplus.net/bg/features ; https://estateplus.net/bg/plans |
| 4 Contact & deal mgmt | 4 | Clients and their searches, phone/name lookup (O). No pipeline. | https://estateplus.net/bg/features |
| 5 Inventory & matching | 7 | Detailed listing fields, descriptions in 6 languages, offer↔search matching, "offers from the market" (O). | https://estateplus.net/bg/features ; https://estateplus.net/bg/plans |
| 6 Communication | 3 | Email history only (O). | https://estateplus.net/bg/features |
| 7 Viewings & offers | 3 | Viewings logged as actions; "easy offer generation" means property brochures (O). | https://estateplus.net/bg/features |
| 8 Reporting & oversight | n/e | — | — |
| 9 Mobile | 4 | Works in a mobile browser (O). No app. | https://estateplus.net/bg/features |
| 10 UI/UX & onboarding | n/e | Claims a "maximally simplified interface" (O). No reviews. | https://estateplus.net/bg/features |
| 11 Integrations / syndication | 8 | Longest published BG portal list: imot.bg (+ bazar.bg, imoti.com, holmes.bg, imoti.info), imoti.net, homes.bg, olx.bg, alo.bg, domaza, realistimo, ypi, imi.bg, and bank portals (dskhome, ubbforhome). XML/Excel export, own-website sync (O). | https://estateplus.net/bg/features |
| 12 Data import / migration | n/e | — | — |
| 13 Localization (BG) | 8 | BG-native, EUR prices (O). | https://estateplus.net/bg/plans |
| 14 GDPR / compliance | 3 | Event logging, broker roles and user groups (O). | https://estateplus.net/bg/features |
| 15 Pricing fit | 9 | ≈ €12–52/mo for 2–10 brokers (I). Listing caps apply per plan (O). | https://estateplus.net/bg/plans |
| 16 Multi-office / admin | 5 | Roles, users and user groups (O). | https://estateplus.net/bg/features |

### 1.4 CRM REBS, Romania — the neighbouring market leader with follow-up discipline

Positioning: Real Estate Business Solutions SRL, Cluj-Napoca, since 2013. Claims "1,000+
companies" and "3,700+ professionals". Customers include RE/MAX Romania, whose regional owner
mentions 20+ offices (https://www.crmrebs.ro/) **O**. **Pricing as of 2026-10-28** (+VAT, per
user per month, monthly / annual): Basic €9.99 / €4.99, Standard €19.99 / €9.99, Premium
€29.99 / €14.99 (https://www.crmrebs.ro/pret/) **O**. A mobile app shipped as a PWA on
2026-04-28 and was not yet in the stores. A REST API was added in October 2026 (blog posts below) **O**.

| Dimension | Score | Justification | Source |
|---|---|---|---|
| 1 Lead capture | 5 | Reports show "number of leads per promotion channel". Private-owner listings feed. REST API (Oct 2026) (O). Portal-inquiry import not seen. | https://www.crmrebs.ro/ ; https://www.crmrebs.ro/blog/noutati-crm-rebs-octombrie-2026/ |
| 2 Lead routing | n/e | Duplicate check on add "to avoid 2 agents working the same client" (O) is an ownership guard, not routing. | https://www.crmrebs.ro/functionalitati/ |
| 3 Follow-up discipline | 8 | After a call the app asks "answered?". Yes: dictate notes and schedule the next step. No: log the attempt and remind in 1h / tonight / tomorrow morning. Tagline: "a client without a next step is a forgotten client." A "no future activities" filter on buyer requests. Email reminders (O). | https://www.crmrebs.ro/blog/aplicatia-mobila-crm-rebs-webinar-de-lansare/ ; https://www.crmrebs.ro/blog/noutati-crm-rebs-octombrie-2026/ |
| 4 Contact & deal mgmt | 7 | Contacts with tags and Google Contacts sync. Buyer requests. An owner "semaphore" (traffic light). Transactions with commission on both property and request sides (O). | https://www.crmrebs.ro/functionalitati/ ; October 2026 post |
| 5 Inventory & matching | 9 | Matching with zones drawn on a map, new-match notifications, CMA, residential complexes, Collaboration module across 500+ agencies (O). | https://www.crmrebs.ro/functionalitati/ ; https://www.crmrebs.ro/ |
| 6 Communication | 7 | Send properties and owner reports by **WhatsApp** or email, email-open tracking, call/WhatsApp buttons on records (O). | https://www.crmrebs.ro/functionalitati/ |
| 7 Viewings & offers | 7 | Viewing reminders. Digital contracts for viewings and reservations, signed via WhatsApp/email. Client feedback on emailed properties (O). | https://www.crmrebs.ro/ ; https://www.crmrebs.ro/functionalitati/ |
| 8 Reporting & oversight | 8 | Real-time agent activity, KPIs, stock, leads per channel, promotion reports, owner activity report (O). | https://www.crmrebs.ro/functionalitati/ |
| 9 Mobile | 6 | PWA with dictation, Waze/Maps navigation, call prompts and push notifications (O). Not yet in the stores. A Google Play link is in the site footer, but no store listing was checked. | https://www.crmrebs.ro/blog/aplicatia-mobila-crm-rebs-webinar-de-lansare/ |
| 10 UI/UX & onboarding | n/e | Monthly webinars (O). No reviews found. | — |
| 11 Integrations / syndication | 8 | 20+ RO portals (imobiliare.ro with slot sync, olx.ro, storia.ro, ...). Website API, Google Calendar/Contacts, JOZI, REST API (O). | https://www.crmrebs.ro/functionalitati/ ; October 2026 post |
| 12 Data import / migration | 8 | **Free import from competitors** (AdminOnline, SoftImobiliar, ImmoFlux, ImobManager, Whise), Excel import, export anytime (O). | https://www.crmrebs.ro/functionalitati/ |
| 13 Localization (BG) | 2 | Romanian only, no BG portals (O). | https://www.crmrebs.ro/ |
| 14 GDPR / compliance | 5 | Vendor has no access to contact data by design. Separate DB per agency. Undeletable history. Office-only access. Login history (O). | https://www.crmrebs.ro/functionalitati/ |
| 15 Pricing fit | 9 | €5–15 per user/mo on annual billing (O). | https://www.crmrebs.ro/pret/ |
| 16 Multi-office / admin | 7 | Permission system, user groups (O). Used by a 20+ office franchise region (O). | https://www.crmrebs.ro/functionalitati/ ; https://www.crmrebs.ro/ |

### 1.5 ASARI CRM, Poland — mature, priced for a richer market

Positioning: Polish CRM for agencies and developers, with a generic business edition. Claims
"1,500+ agencies and developers", "21,000+ portal exports per day" and ASGAL MLS
(https://asaricrm.com/program-dla-biur-nieruchomosci/) **O**. **Pricing as of 2026-10-28** (net,
per user per 30 days): Business 109 PLN (≈ €25.6), Corporate 187 PLN (≈ €44, min. 6 users),
Enterprise 249 PLN (≈ €58.6, min. 10 users). "From 77 PLN" (≈ €18) with a contract
(https://asaricrm.com/program-dla-biur-nieruchomosci/cennik/) **O**.

| Dimension | Score | Justification | Source |
|---|---|---|---|
| 1 Lead capture | 6 | "AIA Web Agent" talks to site visitors and captures leads 24/7. Email linked into records. Client portal (O). Portal inquiry ingestion n/e. | https://asaricrm.com/program-dla-biur-nieruchomosci/ |
| 2 Lead routing | n/e | — | — |
| 3 Follow-up discipline | 7 | The dashboard shows "today's actions" and "matters needing reaction": expiring contracts, ending holds, overdue records (O). | same |
| 4 Contact & deal mgmt | 8 | Kanban of opportunities with stage and value. Commission forecast "how much is missing to target" (O). | same |
| 5 Inventory & matching | 8 | Properties, owners and searches. One-click matching. ASGAL MLS exchange. Valuation (O). | same |
| 6 Communication | 6 | Built-in mail and mailings. ASARI Tracker logs phone calls with geolocation (O). | https://asaricrm.com/program-dla-biur-nieruchomosci/cennik/ |
| 7 Viewings & offers | 4 | Client space presents matched offers (O). Viewing workflow not described. | same |
| 8 Reporting & oversight | 8 | Role-based dashboards. Reports by period, employee and branch, shared team layout (O). | same |
| 9 Mobile | 7 | Native App Store and Google Play apps, customizable mobile dashboard (O). | same |
| 10 UI/UX & onboarding | n/e | Site shows a 4.9 rating (176 reviews), source unclear (O). Capterra FR shows no rating (snippet). | https://asaricrm.com/program-dla-biur-nieruchomosci/cennik/ |
| 11 Integrations / syndication | 8 | Export to unlimited portals "in 60 s", WWW, API documentation (O). | same |
| 12 Data import / migration | 8 | Free conversion from EstiCRM, IMO, Galactica Virgo and others (O). | https://asaricrm.com/program-dla-biur-nieruchomosci/cennik/ |
| 13 Localization (BG) | 1 | Polish market only (O). | — |
| 14 GDPR / compliance | n/e | — | — |
| 15 Pricing fit | 5 | €18–26 per user, more on higher tiers. Expensive next to BG peers (I). | cennik page |
| 16 Multi-office / admin | 8 | Branches, role views, tiers with minimum seat counts (O). | same |

### 1.6 Other products (not scored)

- **PropertyManager / MaxEstates (MaxProgress), BG, since 2018.** A "forever free" plan
  (properties, clients, tasks, viewings, website). Growth plan €9–17/mo. PWA. Portal sync to
  imot.bg, alo.bg, imoti.net, OLX.bg, Indomio.bg, Domaza and Realistimo. Partner network. AI
  dictation. Claims to suit "teams up to 50" (https://propertymanager.maxprogress.bg/) **O**. A
  free tier sets a price anchor of €0 for small BG agencies (I).
- **Realistimo Sfera, BG (portal-owned).** Web and mobile app. AI assistant "Рea" calls old
  contacts. Facebook lead collection. Auto-publishing (https://imotensviat.com/nai-dobrite-crm-sistemi-za-agencii-za-nedvizhimi-imoti/) **O**.
  The source is a news site carrying the "Реалистимо" brand header, so it is likely biased (I).
  realistimo.com returned 403.
- **Cosher (Realto Group, in-house), BG.** Built "for our own business needs". About 1,000
  brokers across Realto Group companies will exchange clients and offers in real time. Launched
  "on 1 June" in Unique Estates (Christie's) and New Estates. Sources are two LinkedIn posts
  (https://bg.linkedin.com/in/emiliyan-delov, https://bg.linkedin.com/in/anna-maria-kancheva) **(snippet)**.
  LinkedIn returned 999. Not for sale. It shows that the largest BG network chose to build
  rather than buy (I).
- **Maija (Finnish, Habita).** Has Bulgarian pages. 80+ international portals. Shared listings
  with a 50/50 commission split with the listing broker (search snippet of
  https://www.maija.io/bg/real-estate-marketing/mls-platform-to-grow-real-estate-business) **(snippet)**.
- **Immoflux, RO.** 500+ agencies, 2,500+ agents, since 2009. €19 → €15 per user/mo for 1–5
  agents, €17 → €12.5 for 6–10, €15 → €10 for 11+ (monthly → annual). Automations. "Activity
  groups", i.e. reusable activity sets. MLS. Private-owner ads. Digital contracts via WhatsApp
  (https://immoflux.ro/preturi-crm, https://immoflux.ro/functionalitati-crm) **O**. Mobile is
  responsive web only (O).
- **ESTI CRM, PL.** 127 PLN per month for the main account + 85 PLN per extra user. Features
  include "portal inquiry reader", "automatic reminder to contact the client", "management of
  contact regularity", "employee substitution" and inter-office offer exchange. Notice: Otodom
  publishing moved to API by 2024-12-02 (https://www.esticrm.pl/cennik) **O**.
- **Realman, CZ.** Flat price per agency with **unlimited users, branches and exports**:
  1,278 / 2,378 / 3,478 CZK per month (≈ €51 / €95 / €139), tiered by active listings
  (50 / 300 / 1,000). 1,120+ agency licences. Since 2017 it has "received and processed over 3
  million responses from 32 sources", i.e. portal inquiry ingestion. Lead-source ROI, cadastre
  lookup, GDPR features, SMS (https://www.realman.cz/) **O**.
- **Dimedia, HR/RS/BA/ME.** Acquired by Njuškalo in 2023. 200+ agencies. 35% of Njuškalo
  clients who use a CRM use Dimedia. Portal sync, exchange between agencies, mobile app
  (https://total-croatia-news.com/news/croatian-njuskalo/) **O**. Croatian portal nekretnine.hr
  (Immobiliare group) recommends 100kvadratov, Dimedia and Nekretnine1 for automatic publishing
  (https://www.nekretnine.hr/en/info/software-za-nekretnine/) **O**.
- **Fortunet Hellas, GR.** Spitogatos invested in 2021 in "the No.1 real estate CRM on the
  market". Spitogatos belongs to the Real Web group, the parent of Immobiliare.it
  (https://www.spitogatos.gr/blog/spitogatos-20-xronia-istoria) **O**. Not researched further.
- **Russian-language CRMs.** No evidence was found of a Russian-language real-estate CRM with a
  Bulgarian presence. Search returned only RU-market Bitrix24/amoCRM cases
  (https://www.bitrix24.ru/journal/crm-dlya-agentstva-nedvizhimosti/) **(snippet)**. Bulgarian
  products offer RU UIs: EstatePlus, OptiEstate, PropertyManager (O). Russian-speaking agencies
  on the coast probably use those or a generic Bitrix24/Kommo setup (I, unverified).

---

## 2. Bulgarian portal ecosystem (part B)

| Portal | Agency accounts | Feed / import from a CRM | Lead / inquiry export | Public API | CRMs claiming integration | Agency pricing |
|---|---|---|---|---|---|---|
| **imot.bg** | Yes. Operated by "Резон" ООД. Agencies register as legal entities and publish only via their own profile. Agency publishing is paid, delivered periodically. Free agency subdomain (e.g. `imotibg.imot.bg`). The operator may auto-republish to partner sites. **(snippet** of https://www.imot.bg/obshti-uslovia; site returns 403) | Yes, but per OptiEstate the automatic import requires **imot.bg's paid package for 500 active listings**. Smaller agencies upload via a browser extension (https://opti.estate/llms.txt) **O (vendor claim)** | n/e | None found. A GitHub importer says production use needs written permission from imot.bg (https://github.com/SergiSergiev/imot_search) **(snippet)** | EstatePlus, Estate Assistant, OptiEstate, PropertyManager, Saitami | n/e (403; not in search) |
| **homes.bg** | Yes. Operated by "Джобс.БГ" ЕООД. Services and registration are free. Company accounts are verified by an operator phone call and must be in the BG Commercial Register. Multiple accounts are allowed for different towns (https://www.homes.bg/terms, updated 2024-02-16) **O** | Yes. The terms cover "automatic publishing of listings by a company" (O). The spec is not public | Inquiries on a listing are **emailed to the lister** (O, privacy section of the terms) | None found | EstatePlus (O); others claim "all major portals" | Free (O) |
| **alo.bg** | Yes ("Агенции за имоти" directory) | **Public JSON import spec** with a machine-readable JSON Schema. Import by URL or file. Listings renew for 30 days on each import. Optional "archive listings not in this import". Status API `import_info_api.php` with username and api_key (https://www.alo.bg/import_specification.php, https://www.alo.bg/import_info.php) **O** | n/e | Import + status API only (O) | EstatePlus, OptiEstate, PropertyManager (O) | Banner ads from €25.56/mo min. budget (https://www.alo.bg/cenizareklama.php) **O**. Listing package prices n/e |
| **OLX.bg** | Professional accounts. Professionals pay for posting (O) | **OLX Group Partner API.** OLX Bulgaria is a listed marketplace, and one app credential covers the real-estate marketplaces. Leads need the webhook system, and some features are not live on every marketplace (https://developer.olxgroup.com/, https://developer.olxgroup.com/faq) **O** | Leads/messages via Partner API, availability for BG n/e (O/I) | Yes (O) | OptiEstate (OAuth), EstatePlus, PropertyManager (O) | n/e (olx.bg 403) |
| **imoti.net** | Yes. Companies can publish unlimited listings manually or by automatic import. Private users are capped at 10 (https://www.imoti.net/bg/publikuvane-na-objava) **(snippet)** | Yes (snippet) | n/e | n/e | EstatePlus, OptiEstate, PropertyManager (O) | Foreign-property listings: 50–500 listings €50/mo, >500 €150/mo incl. VAT (snippet). BG listing pricing n/e |
| **Realistimo** | Portal and agency listings, plus its own CRM, Sfera (see §1.6) | Yes (EstatePlus, OptiEstate, PropertyManager list it) **O** | n/e | n/e | as left | n/e (403) |
| **Indomio.bg** | Immobiliare.it group (https://www.onlinemarketplaces.com/?p=13644) **(snippet)** | The group runs "software partner" auto-publishing programmes in HR and ES (https://www.nekretnine.hr/en/info/software-za-nekretnine/, https://www.indomio.es/en/info/software-inmobiliarios/) **O**. BG programme n/e | n/e | n/e | OptiEstate, PropertyManager (O) | n/e |
| **address.bg-style networks** | Address, Yavlena, Realto (Unique Estates, New Estates) | — | — | — | Realto built its own CRM, Cosher (§1.6). No evidence found for Address | — |

Takeaways for BrokerCRM:

- **Inbound leads.** Only homes.bg's terms show inquiry emails to the lister. Email-to-inquiry
  parsing (B-16) is therefore the practical intake path for BG portal leads. OLX's Partner API is
  the only documented programmatic lead channel, and it is unconfirmed for BG. Realman (CZ: 32
  sources, 3M inquiries) and ESTI (PL: "portal inquiry reader") show this is a standard EE feature.
- **Outbound syndication.** This is table stakes for every BG competitor. alo.bg's open JSON spec
  is the easiest first target, OLX the second. imot.bg, the market leader, requires a large paid
  package for automatic import, which is a barrier for 2–10 broker agencies (vendor claim).
- **Exclusivity is enforced by a portal.** homes.bg forbids anyone but the exclusive agency from
  publishing a property under an exclusive mandate (https://www.homes.bg/terms §4.3.19) **O**.

---

## 3. Local needs US CRMs ignore (part C)

- **Exclusive vs non-exclusive mandates.** No special broker law exists. A brokerage contract is
  a mandate (ЗЗД arts. 280–292) or commercial agency (ТЗ arts. 49–51). It is **non-exclusive
  by default**, and exclusivity needs an explicit clause. Contracts usually carry an
  anti-circumvention penalty (https://www.innovires.com/blog/posrednicheska-deynost-imoti.html, updated 2026-07-28) **O**.
  Competitors track mandate expiry (OptiEstate) and expiring contracts (ASARI), and filter
  auto-posts to "exclusive only" (OptiEstate) **O**. → a CRM needs a mandate record: type,
  start/end, exclusive flag, signed copy.
- **Commission conventions.** Sales: typically **2–3% from each side** (buyer and seller). Rent:
  usually **one month's rent**, paid by the tenant. No legal cap. +20% VAT if the broker is
  VAT-registered (same Innovires source) **O**. Co-broking splits are by agreement. One vendor
  promotes a 50/50 split with the listing broker (Maija, snippet). No authoritative BG source on
  standard inter-agency splits was found.
- **Co-broking between agencies** is a product category in itself. Estate Assistant runs a broker
  network it claims is "10× more effective than Facebook or Viber groups", where nobody scrolls
  back through dozens of posts. Other examples: the Estate+ network (free for broker-association
  members), OptiShare (exchanges listings **and buyer searches**; client data stays private),
  Realto's Cosher, REBS Colaborare (isolated from the agency DB), ASGAL MLS (sources in §1) **O**.
  In practice co-broking still happens largely in Facebook/Viber groups (I, from EA's own pitch).
- **Viber is the default messenger.** Rakuten Viber reported a 90% market share in Bulgaria for
  2021 (https://seenews.com/news/viber-grows-market-share-in-bulgaria-to-focus-on-dedicated-business-space-in-2022-770066)
  and claims 94% smartphone penetration (https://forbusiness.viber.com/ru/blog/post/empowering-brands-vibers-2023-global-events-spotlight-superapp-strategies-and-solutions).
  Both are company claims via search snippets; the pages could not be fetched. BG vendors build
  for it: Viber offer sending and campaigns (EA), Viber e-sign links and auto-posts (OptiEstate),
  a `viber://` support link (EstatePlus) **O**. RO/PL vendors use WhatsApp instead (REBS, Immoflux) **O**.
- **Preliminary contract → notary flow.** A preliminary contract (ЗЗД art. 19) must be in writing.
  It needs no notarisation and transfers no ownership. A deposit (капаро) of about **10%** is
  typical. Ownership passes by **notary deed** before a notary in the property's district, with
  the balance usually paid by bank transfer on the day. The deed is then entered in the Property
  Register (https://www.innovires.com/blog/pokupka-na-imot.html) **(snippet)**. → stages such as
  "deposit/preliminary signed" and "notary date" belong in the opportunity lifecycle. OptiEstate
  KPIs already count "mandates" and "deposits" **O**.
- **AML (ЗМИП).** Real-estate brokers are obliged entities under ЗМИП art. 4(18). Duties: client
  and beneficial-owner identification, PEP checks, internal rules, a responsible person, records
  kept for 5 years. Fines up to BGN 200,000 for legal entities (Innovires) **O**. No CRM
  reviewed advertises AML/KYC support (I). This is a gap and an opportunity.
- **No licensing.** As of April–July 2026 there is no broker-licensing law. Two bills (ITN,
  Dec 2024; GERB, Apr 2025) propose a national register at the Registry Agency and mandatory
  insurance, and neither has passed (Innovires) **O**.
- **EUR adoption.** Bulgaria adopted the euro on **2026-01-01** under Council Decision (EU)
  2025/1407, at the irrevocable rate **1.95583 BGN/EUR** (Council Regulation (EU) 2025/1409).
  Dual circulation ran 1–31 Jan 2026 (https://www.fibank.bg/en/introduction-of-the-euro-in-the-republic-of-bulgaria) **O**.
  BGN amounts convert by dividing by the full rate, with no rounding of the rate. This comes
  from a search summary over Bulgarian euro-changeover guides (e.g.
  https://kik-info.com/novini/novini-i-akcenti/Vavezhdane-na-evroto-v-Balgariya-Praktichesko-rakovodstvo-za.201970.php);
  the page itself was not fetched **(snippet)**.
  The end of **mandatory dual price display** is disputed. A law firm says it runs until
  2027-01-01 (https://dpc.bg/insights/dual-price-display-and-currency-exchange-in-the-context-of-euro-adoption) **O**;
  Fibank and ECC Malta say 2026-08-08 **(snippet)**. → historical deal values and imported
  spreadsheets will be in BGN for years. Store EUR and convert legacy BGN on import with the
  fixed rate. Estate Assistant still prices in BGN **O**.
- **GDPR / CPDP (КЗЛД).** Complaints in 2025 rose more than 60% over 2024. Most punitive cases
  were for processing without a legal basis (Art. 6(1)) or breaching Art. 5(1) principles.
  Complaints must be written in Cyrillic. Proceedings are mostly complaint-driven, not campaigns
  (https://cms.law/en/bgr/publication/gdpr-enforcement-tracker-report/bulgaria) **O**. No
  real-estate-specific CPDP decision was found. Risk areas specific to EE broker CRMs (I):
  harvesting private-seller contacts from portals (the "private listings" feeds in REBS,
  Immoflux, ESTI EstiBOT and OptiShare), Viber/email campaigns without consent, and copies of
  ID cards and notary deeds (homes.bg bans photos of documents containing personal data, §4.3.14) **O**.
- **Typical agency size.** Eurostat SBS for NACE 68.31 "Real estate agencies" in Bulgaria, 2024:
  **3,267 enterprises, 6,932 persons employed → about 2.1 people per enterprise**. Trend:
  2,806 → 3,267 enterprises from 2021 to 2024. For comparison, 2024: RO 8,266 / 9,943,
  PL 18,089 / 26,473, CZ 15,355 / 14,535, GR 5,115 / 8,332, HR 1,570 / 3,099
  (https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sbs_ovw_act?geo=BG&nace_r2=L6831&indic_sbs=ENT_NR&indic_sbs=EMP_NR) **O**.
  Freelance brokers working under an agency may be counted as their own enterprises (I).
  Either way, the 2–30-broker segment is the upper tail of a market of micro-agencies (I).
- **Market activity context.** 2025 transactions were up 6.5% year on year, per the Registry
  Agency via Capital (https://www.capital.bg/biznes/imoti/2026/01/14/4872408_godinata_predi_evroto_postavi_3-godishen_rekord_po/) **(snippet)**.

---

## 4. Signature patterns (mapped to crm-benchmark B-01…B-22)

| Pattern | Product(s) | ID | Source |
|---|---|---|---|
| On-duty routing: an unassigned inquiry goes to the agent on shift and escalates to a colleague after 10 min unaccepted; night inquiries wait for the morning | OptiEstate | **B-04** | https://opti.estate/ |
| Response-time KPIs: "% answered within N min", average reaction time, goals with on-pace status | OptiEstate | **B-05**, B-20 | https://opti.estate/llms.txt |
| Post-call prompt: "answered?" → dictate notes + schedule next step, or remind in 1h / tonight / tomorrow; "a client without a next step is a forgotten client" | CRM REBS mobile | **B-07**, **B-09**, **B-10** | https://www.crmrebs.ro/blog/aplicatia-mobila-crm-rebs-webinar-de-lansare/ |
| "No future activities" filter on buyer requests | CRM REBS | **B-01** / B-07 | https://www.crmrebs.ro/blog/noutati-crm-rebs-octombrie-2026/ |
| "Needs reaction" dashboard: expiring contracts, ending holds, overdue records | ASARI | **B-01**, B-06 | https://asaricrm.com/program-dla-biur-nieruchomosci/ |
| Owner-contact "semaphore" (traffic light for freshness of contact) | CRM REBS | **B-06** | https://www.crmrebs.ro/functionalitati/ |
| Lost reason required when archiving a deal; loss analysis per agent | OptiEstate | **B-14**, B-15 | https://opti.estate/ |
| Kanban with commission forecast vs target | ASARI | **B-19** | https://asaricrm.com/program-dla-biur-nieruchomosci/ |
| Activity groups (reusable sets of calls/emails/meetings applied by criteria) | Immoflux | **B-03** | https://immoflux.ro/functionalitati-crm |
| Portal inquiry reader / ingestion from 32 sources | ESTI CRM, Realman | **B-16** | https://www.esticrm.pl/cennik ; https://www.realman.cz/ |
| Meta Lead Ads → CRM inquiry with campaign; lead stage sent back to Meta (Conversions API) | OptiEstate | **B-16** + NEW | https://opti.estate/llms.txt |
| Employee substitution (cover for an absent broker) | ESTI CRM | ~**B-18** | https://www.esticrm.pl/cennik |
| Background deadline watch: **mandate expiry**, promised call, unconfirmed viewing, listing with no inquiries, portal ad expiring | OptiEstate | B-02 + **NEW (mandate tracking)** | https://opti.estate/ |
| Buyer requirement ↔ property matching with new-match notifications; map-drawn zones | REBS, EA, EstatePlus, OptiEstate, ASARI | **B-11**, **B-12** | §1 |
| Inter-agency exchange of listings **and buyer searches**, with client data kept private | OptiShare, EA network, Estate+ network, REBS Colaborare, ASGAL MLS, Cosher | **NEW (co-broking network)** | §1 |
| One-click portal syndication with auto-update and take-down on sale | all BG products | **NEW (portal syndication)**; conflicts with the BrokerCRM pilot non-goal | §1, §2 |
| Private-seller listing feed for acquisitions | REBS, Immoflux, ESTI (EstiBOT), OptiShare | **NEW (FSBO feed)**; GDPR-sensitive | §1 |
| Mandate / viewing / reservation agreements e-signed by link over Viber/WhatsApp | OptiEstate, REBS, Immoflux | **NEW (e-sign mandates)** | §1 |
| Viber offer sending and campaigns | Estate Assistant, OptiEstate | **NEW (Viber channel)** | §1 |
| Owner activity report (what was done for the seller), sendable by WhatsApp | CRM REBS, ESTI | **NEW (seller reporting)** | https://www.crmrebs.ro/blog/noutati-crm-rebs-octombrie-2026/ |
| Duplicate check at entry "so two agents don't work the same client" | CRM REBS | **NEW (ownership-conflict guard)**; relates to BrokerCRM dedup | https://www.crmrebs.ro/functionalitati/ |
| Voice dictation for new client/property entry | EA, PropertyManager, OptiEstate, REBS | ~B-09 / NEW | §1 |
| Free migration from named competitor CRMs | CRM REBS, ASARI | **NEW (switching-cost removal)** | §1 |
| Flat per-agency price, unlimited users | Realman | **NEW (pricing model)** | https://www.realman.cz/ |
| Free tier / free network accounts for broker-association members | PropertyManager, EstatePlus | **NEW (pricing / go-to-market)** | §1 |

---

## 5. Contrary evidence / complaints

- **No independent reviews exist** for any BG product (EA, EstatePlus, OptiEstate, Sfera,
  PropertyManager), nor for REBS. Search found nothing on G2, Capterra or Trustpilot. Every
  feature claim above is vendor marketing. OptiEstate's breadth (1,250+ features since March 2026,
  270 permissions) is backed by only 5 named customers and 2 vendor-quoted Google reviews.
- **Old-style BG incumbents.** EA shows a © 2018 footer, prices only in BGN, an Android sideload
  APK, and an iOS id the BG store lookup does not return. EstatePlus lists no tasks or reminders.
  Both are listing databases with CRM bolted on, not follow-up tools (O/I).
- **The market comparison article is biased.** The one Bulgarian round-up found
  (imotensviat.com) carries the Realistimo brand and lists Realistimo's own Sfera first (O).
- **imot.bg is a gate.** Automatic import reportedly needs a 500-active-listing paid package
  (vendor claim, unverified). imot.bg blocks automated access (403), and a third-party importer
  warns that written permission is needed (snippet).
- **"Discipline" depends on the brokers.** The BG round-up notes that MaxEstates-type systems
  "require discipline; if brokers don't record actions, the picture is incomplete"
  (https://imotensviat.com/nai-dobrite-crm-sistemi-za-agencii-za-nedvizhimi-imoti/) **O**.
  That is the adoption problem BrokerCRM is built around.
- **Strategic tension.** BrokerCRM's pilot non-goals include listing syndication. In Bulgaria,
  syndication + property inventory + matching is the **core purchase reason** for every product
  found, and prices are low: €0 (PropertyManager free, EstatePlus network), €11–13/user (EA,
  EstatePlus), €22/broker (OptiEstate). Without syndication, BrokerCRM will be an add-on next to
  one of these, or must win on lead response and follow-up, which OptiEstate is now also
  marketing (I).
- **Native mobile is not the norm.** Native apps exist at EA (claimed) and ASARI. OptiEstate,
  REBS, Immoflux and PropertyManager are PWA/responsive (O). A good PWA is competitive parity.

---

## 6. Open questions

1. imot.bg agency package prices, the exact feed format, and whether inquiry/lead export exists.
   The site is 403 and nothing turned up in search. This needs a sales contact.
2. Whether OLX Bulgaria supports real-estate **leads** (webhooks/messages) through the Partner
   API, or only ad publishing.
3. homes.bg and imoti.net feed specs and imoti.net's BG agency pricing (imoti.net is 403).
4. Market share of BG CRMs. No vendor except EA ("hundreds of brokers") states agency counts,
   and no survey was found. Realistimo Sfera's price, features and app-store presence are unverified.
5. Cosher: launch year, features, and whether Realto will license it. Sources are LinkedIn
   snippets only.
6. Dual price display end date in Bulgaria (2026-08-08 vs 2027-01-01), and whether it applies to
   property listings.
7. Standard inter-agency commission split in Bulgaria. No authoritative source was found.
8. Any CPDP decisions involving real-estate agencies (owner-contact harvesting, marketing calls).
   The CPDP decision register was not searched directly.
9. Greek (RealStatus / RealAgentPro / Fortunet), Slovenian (100kvadratov) and Serbian (4zida /
   Halo oglasi) products were not researched in depth. realagentpro.gr and realitnisoftware.cz
   did not connect.
10. Bulgarian Viber usage figures newer than the 2021–2023 company claims.
