# Competitor notes: generic sales CRMs used instead of a vertical real-estate CRM

> Research date: 2026-10-28. Scope: Pipedrive, HubSpot (Smart CRM / Sales Hub), Bitrix24
> (including its real-estate industry page and marketplace apps), Kommo (formerly amoCRM).
> Method: vendor pricing, product and help-centre pages fetched with curl, the Apple App Store
> lookup API (app ratings and localisation lists), Capterra review pages, and web-search snippets.
> None of the products was used hands-on, so "UI/UX" scores come from reviews and vendor material.
>
> **Evidence labels.** **O** = Observed on the cited page in this session. **I** = Inferred, or
> taken from a search-result snippet. The following sources refused a plain curl and were not
> bypassed: `pipedrive.com/en/pricing` (403 "Attention Required" bot check), `g2.com` (403),
> `help.viber.com` (403). `bitrix24.com` reset the connection repeatedly; the EU storefront
> `bitrix24.eu` loaded after retries and is used instead. Claims from blocked pages come from
> search snippets and are labelled **I (snippet)**, which is weaker evidence.
>
> **Currency.** Prices as of 2026-10-28, excluding VAT. EUR conversions use an approximate
> **1 USD ≈ 0.86 EUR**. That is a rough planning rate, not a live quote, and it matches the rate
> used in `competitors-international.md`.
>
> **Scores** use the shared 0–10 rubric (0 absent, 2 token, 4 basic, 6 solid, 8 strong,
> 10 best-in-class). "n/e" = no evidence found.

---

## 0. At a glance: why Eastern European agencies pick these, and what they lack

| | Pipedrive | HubSpot | Bitrix24 | Kommo |
|---|---|---|---|---|
| Why agencies pick it | Simple visual pipeline; activity-based selling | Free/cheap Starter, polished, huge ecosystem | Very cheap flat price per organisation; telephony, messengers, tasks and intranet in one tool | Messenger-first inbox (WhatsApp, Telegram, Viber bot, Instagram) with bots |
| Price per user (EUR, 2026-10-28) | €14–€79/seat/mo on annual billing (third-party figures; vendor page bot-blocked) | Starter list €20/seat/mo (promo €7–€10 for new customers); Sales Hub Pro about €90/seat/mo + €1,470 one-time onboarding | Flat: Basic €49/mo (5 users), Standard €99/mo (50 users), so roughly €2/user | $25 / $35 / $45 per user/mo ≈ €21.5 / €30 / €39, 6-month minimum prepay, USD billing only |
| Bulgarian UI | No (iOS app: 23 languages, no BG) | No (17 UI languages, no BG) | No evidence (iOS app: 16 languages, no BG) | No (EN, ID, PT-BR, RU, ES, TR) |
| Viber | Only via third-party (MessageBird/Bird app, Albato and similar) | Only via marketplace (Infobip app; Niswey $100/mo) | Native Open Channel connector to a **Viber chatbot** | Native lead source (Viber bot token) |
| WhatsApp | Native, beta, Growth plan and up | Inbox: Marketing/Service Hub **Pro** and up | Native from Basic | Native (WhatsApp Business API and Business app) |
| Telephony | Native Caller discontinued (2022/23); marketplace apps (Aircall, JustCall, Zadarma guide) | Built-in calling; HubSpot-provided **Bulgarian local** numbers available | Built-in: rent numbers or SIP connector to your own PBX | Marketplace; Zadarma integration is free |
| Property inventory / matching | None; custom fields + filters workaround | Optional **Listings** object (any plan); no matching | Custom "Smart Process" entity; marketplace apps (e.g. auto-search properties) | None (product catalog only) |
| Portal feeds (imot.bg, homes.bg) | None | None | None found (one Gulf-portal bridge app) | None |

Common gap across all four: no buyer-requirement record, no requirement↔property matching, no
viewing record with feedback, no offers, no Bulgarian portal lead parsing, and (except Bitrix24's
flat price) per-seat pricing in USD or EUR with key features paywalled at the second or third tier.

**Viber cost note (relevant to every product's Viber connector).** All four connect Viber
through a Viber *chatbot*, not a personal Viber number. Since 2024-02-05 Viber charges new
chatbots a maintenance fee of **€100 per bot per month**, plus per-message fees for
bot-initiated messages (I (snippet): https://help.viber.com/hc/articles/15247629658525 , page
403 to curl). Bitrix24 also documents that Viber does **not** pass the customer's phone number
to the CRM unless the customer types it (O: https://helpdesk.bitrix24.com/open/17741784). For a
phone-first Bulgarian broker who chats from a personal Viber account, the "Viber integration"
on these CRMs is therefore a paid, bot-based channel, not their normal Viber.

---

## 1. Pipedrive

**Positioning.** Estonian/US sales CRM for small sales teams, built around "activity-based
selling": every deal should have a next activity, and the pipeline board is sorted by it. Sold
worldwide, with EUR pricing. Plans as of 2026-10-28 (third-party figures, because the vendor
pricing page returned a 403 bot check): **Lite €14, Growth €39, Premium €49 (one source says
€59), Ultimate €79 per seat/month on annual billing; €24 / €49 / €79 / €99 on monthly billing.**
Add-ons are extra, e.g. LeadBooster (web forms, chatbot) at about €32.50/company/month (I
(snippet): https://zeeg.me/post/pipedrive-pricing , https://trusted.de/pipedrive-kosten).
Note: several help articles still use the pre-2025 plan names (Essential/Advanced/Professional),
so plan gating below is quoted as the articles state it. Example: 10 brokers on Growth ≈ €390/mo.

| Dimension | Score | One-line justification | Source URL(s) |
|---|---|---|---|
| 1. Lead capture & sources | 6 | Web Forms exist but are part of the paid LeadBooster add-on (O); leads inbox, email sync and API exist. No local portal parsing. | https://support.pipedrive.com/en/article/web-forms |
| 2. Lead routing / assignment | 4 | Lead routing is listed as a Premium-tier feature by third parties (I); no official round-robin doc fetched. Automations can set owner. | I (snippet): https://www.casrai.org/guides/pipedrive-crm-pricing |
| 3. Follow-up discipline | 8 | Board sorted by next activity, with red/green/yellow/grey indicators; follow-up pop-up after marking an activity done, which cannot be disabled on lower plans (O). Sets the "no next activity" pattern. | https://support.pipedrive.com/en/article/how-are-deals-ordered-in-the-pipeline-view ; https://support.pipedrive.com/en/article/how-can-i-disable-the-follow-up-activity-pop-up |
| 4. Contact & deal / pipeline | 8 | Reference kanban; per-stage rotting; required fields per pipeline and stage; predefined lost reasons (O). | https://support.pipedrive.com/en/article/the-rotting-feature ; https://support.pipedrive.com/en/article/required-fields ; https://support.pipedrive.com/en/article/lost-reasons |
| 5. Property inventory & matching | 2 | No listing object; community answer is custom fields on deals/contacts plus filters; users complain they can't find how to match leads with properties (I). | I (snippet): https://community.pipedrive.com/discussion/9041/create-a-property-set-attributes-price-rooms-match-with-leads ; https://community.pipedrive.com/discussion/3863/pipedrive-for-buyer-management |
| 6. Communication | 5 | Strong email sync. WhatsApp is native but beta and Growth+ only (O). Viber only via third parties (I). Native Caller withdrawn 2022–2023; calling via marketplace apps (I). | https://support.pipedrive.com/en/article/whatsapp-integration ; I (snippet): https://www.pipedrive.com/en/marketplace/app/message-bird-channels-for-pipedrive/89e0cf9aefc3fdae ; https://support.pipedrive.com/en/article/caller |
| 7. Viewings & offers | 2 | Only generic activity types (meeting/call) can stand in for viewings; no feedback or offer object (I). | https://support.pipedrive.com/en/article/activities |
| 8. Reporting & manager oversight | 6 | Insights dashboards plus rotting as a stale-deal signal; G2 tallies 151 reviews saying reporting/automation is limited for advanced use (I). | I (snippet): https://www.g2.com/products/pipedrive/reviews |
| 9. Mobile | 6 | Native iOS/Android. iOS rating 3.75 from 677 US ratings (O). | https://apps.apple.com/us/app/pipedrive-sales-crm/id921456160 (via itunes lookup API) |
| 10. UI/UX & onboarding (not hands-on) | 8 | Capterra ease of use 4.5 across 3,064 reviews; praised as simple and visual (O). | https://www.capterra.com/p/132666/Pipedrive/reviews/ |
| 11. Integrations / API | 7 | Large marketplace plus REST API; Zadarma publishes a Pipedrive guide (O, title only); no BG portal connectors. | https://zadarma.com/en/support/instructions/pipedrive/ |
| 12. Data import / migration | 6 | XLS/XLSX/CSV import of people, orgs, leads, deals, activities, notes; up to 200k rows in the latest article (I). | I (snippet): https://support.pipedrive.com/en/article/importing-data-into-pipedrive-with-spreadsheets |
| 13. Localization (BG) | 3 | iOS app in 23 languages incl. Romanian, Czech, Russian, Ukrainian, but **not Bulgarian** (O); per-user language and date/number format (O); EUR prices. | itunes lookup id 921456160 ; https://support.pipedrive.com/en/article/how-can-i-change-my-language-or-date-number-format |
| 14. GDPR / compliance | 4 | Pipedrive says it handles data subject requests (I); a staff reply says complete deletion needed Support Engineers (older thread, I). No lawful-basis field evidence. | I (snippet): https://support.pipedrive.com/en/article/pipedrive-and-gdpr ; https://devcommunity.pipedrive.com/t/deleting-a-person-does-not-work/621 |
| 15. Pricing fit (2–30 brokers, EE) | 6 | €14 Lite lacks automations; realistic Growth €39/seat → €390/mo for 10 brokers, plus add-ons ("add-on costs" is a top G2 complaint, I). | I (snippet): https://zeeg.me/post/pipedrive-pricing ; https://www.g2.com/products/pipedrive/reviews |
| 16. Multi-office / agency admin | 6 | Permission sets plus visibility groups; Lite/Growth get only the default group, more groups on higher plans (O). | https://support.pipedrive.com/en/article/visibility-groups |

---

## 2. HubSpot (Smart CRM / Sales Hub)

**Positioning.** US all-in-one CRM + marketing/sales/service platform for SMB to mid-market,
sold globally with EUR prices. As of 2026-10-28: **Starter (Customer Platform) list €20/seat/month;
a limited-time new-customer promotion is €7 (annual prepay) or €10 (monthly)** (O:
https://www.hubspot.de/products/crm/starter). **Sales Hub Professional ≈ $100/seat/mo monthly or
$90 annual (≈ €77–€86; one EUR source shows €90/seat), plus a mandatory one-time onboarding
fee of $1,500 ≈ €1,470** (I (snippet): https://www.hublead.io/hubspot-pricing-calculator ,
https://chatarmin.com/en/blog/hubspot-pricing). HubSpot's own Starter FAQ confirms Professional and
Enterprise "include required onboarding" (O: https://www.hubspot.com/products/crm/starter). Most
features a broker team would want (sequences, round-robin, WhatsApp inbox) sit at Professional.
Example: 10 brokers on Sales Hub Pro ≈ €900/mo + €1,470 once.

| Dimension | Score | One-line justification | Source URL(s) |
|---|---|---|---|
| 1. Lead capture & sources | 7 | Forms, email, chat and API are core platform features (I, not fetched this session); no BG portal parsing. | https://www.hubspot.com/products/crm/starter |
| 2. Lead routing / assignment | 6 | "Rotate record to owner" offers round robin, load balanced and random, but only on **Sales Hub Professional+** and only to paid seats (O). Starter ≈ 3. | https://knowledge.hubspot.com/workflows/assign-and-rotate-record-owners-using-workflows |
| 3. Follow-up discipline | 8 | Task queues on Starter+, shared queues, "complete tasks back to back" (O); sequences and workflow-fed queues need Pro (O). | https://knowledge.hubspot.com/tasks/use-task-queues |
| 4. Contact & deal / pipeline | 8 | Pipelines with board view; **conditional stage properties** with a Required checkbox block the move until filled (O). | https://knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines |
| 5. Property inventory & matching | 4 | Built-in **Listings** object (property or unit for sale/rent) can be activated in the data model on all plans (O); no requirement matching. Custom objects need Enterprise (O). | https://developers.hubspot.com/docs/api-reference/latest/crm/objects/listings/guide ; https://knowledge.hubspot.com/data-management/use-the-data-model-builder |
| 6. Communication | 6 | Calling with **HubSpot-provided Bulgarian local numbers** (needs Sales/Service seat) (O). WhatsApp inbox needs Marketing/Service Hub Pro (I). Viber only via Infobip or Niswey apps (I). | https://knowledge.hubspot.com/calling/calling-supported-countries-and-phone-number-availability ; I: https://knowledge.hubspot.com/inbox/connect-whatsapp-to-the-conversations-inbox ; https://ecosystem.hubspot.com/marketplace/listing/infobip-messaging |
| 7. Viewings & offers | 3 | Meetings/scheduling and listing associations could log viewings; no feedback chasing or offer object (I). | https://developers.hubspot.com/docs/api-reference/latest/crm/objects/listings/guide |
| 8. Reporting & manager oversight | 7 | Strong dashboards; reviewers note some custom reports need higher tiers (O, review text). | https://www.capterra.com/p/152373/HubSpot-CRM/reviews/ |
| 9. Mobile | 8 | iOS 4.74 from 15,830 US ratings (O). | https://apps.apple.com/us/app/hubspot/id1107711722 |
| 10. UI/UX & onboarding (not hands-on) | 7 | Capterra ease 4.4 over 4,491 reviews; reviewers call the core intuitive but advanced settings and pricing complex (O). | https://www.capterra.com/p/152373/HubSpot-CRM/reviews/ |
| 11. Integrations / API | 8 | Large marketplace and mature APIs (e.g. listings API) (O); no BG portal apps found. | https://developers.hubspot.com/docs/api-reference/latest/crm/objects/listings/guide |
| 12. Data import / migration | 7 | Starter page: import from spreadsheets and other sources, no coding (O). | https://www.hubspot.com/products/crm/starter |
| 13. Localization (BG) | 2 | 17 UI languages, **no Bulgarian, no Cyrillic UI** (O); BG only for DeepL content translation (O). EUR billing exists. | https://knowledge.hubspot.com/help-and-resources/hubspot-language-offerings |
| 14. GDPR / compliance | 8 | Data privacy settings on by default for EU-hosted accounts, legal basis for processing on contacts, permanent delete for erasure requests (I (snippet) of KB). | I: https://knowledge.hubspot.com/privacy-and-consent/how-do-i-turn-on-gdpr-functionality-in-my-hubspot-account |
| 15. Pricing fit (2–30 brokers, EE) | 4 | Starter is cheap (€20 list) but lacks rotation, sequences, WhatsApp; Pro ≈ €90/seat + €1,470 onboarding is far above EE agency budgets. | O: https://www.hubspot.de/products/crm/starter ; I: https://www.hublead.io/hubspot-pricing-calculator |
| 16. Multi-office / agency admin | 7 | Teams, permissions; restricting a pipeline by team needs Pro (O). | https://knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines |

---

## 3. Bitrix24

**Positioning.** All-in-one "business OS" (CRM, contact centre, telephony, tasks, intranet,
sites, HR) with Russian roots, sold internationally through regional storefronts and a large
partner network. Distinctive **flat price per organisation**, not per seat. As of 2026-10-28 on
`bitrix24.eu` (O: https://www.bitrix24.eu/prices/): **Free; Basic €69/mo monthly or €49/mo
annual for 5 users; Standard €144 / €99 for 50 users (≈ €1.98/user annual); Professional €289 /
€199 for 100 users; Enterprise from €579 / €399 for 250 users.** Telephony and Market apps need
a paid plan (O, FAQ). The page contradicts itself on the free plan ("for 1–2 users" in the card,
"unlimited number of users" in the FAQ). A 10-broker agency fits in Standard at €99/mo (annual).
The real-estate industry page sells booking of viewings, unified messengers, consent collection
and e-signature, and pushes partners for "tailored customization"; it shows no property
inventory or matching (O: https://www.bitrix24.eu/solutions/industry/real-estate.php).

| Dimension | Score | One-line justification | Source URL(s) |
|---|---|---|---|
| 1. Lead capture & sources | 7 | CRM forms (web form designer from Standard), website widget, live chat, WhatsApp, telephony, email into the contact centre (O). No BG portal parsing. | https://www.bitrix24.eu/prices/ |
| 2. Lead routing / assignment | 7 | "Change responsible person" automation rule with a queue: random, first available, or in specified order, with an option to skip absent employees (I (snippet) of helpdesk); Open Channel queues "evenly" or "exactly as enqueued". Sales automation is a Professional-plan item (O). | I: https://helpdesk.bitrix24.com/open/22396442/ ; O: https://www.bitrix24.eu/prices/ |
| 3. Follow-up discipline | 6 | Activity counters (planned/overdue), kanban red counters, "No activities" filter; deals without activities sink in kanban (I (snippet)). | I: https://helpdesk.bitrix24.com/open/16772374 ; https://helpdesk.bitrix24.com/open/18783338/ |
| 4. Contact & deal / pipeline | 7 | Leads, deals, contacts, kanban; pipelines capped per plan (1 / 5 / 10 / 20 / unlimited in the comparison table) (O). | https://www.bitrix24.eu/prices/ |
| 5. Property inventory & matching | 4 | No native object, but **Smart Process Automation** lets you build a custom "property" entity with its own kanban, fields and links (I (snippet)); marketplace apps exist, e.g. Redham "Real Estate: Auto search properties" (match by type, location, price, rooms; 8 installs) and InformUnity Real Estate (I). | I: https://helpdesk.bitrix24.com/open/13697980/ ; https://www.bitrix24.in/apps/app/redham.realestate ; https://www.bitrix24.com/about/blogs/bitrix24-tips-and-updates/transform-your-real-estate-business-with-the-new-bitrix24-real-estate-app.php |
| 6. Communication | 7 | Built-in telephony from Basic (rent numbers or SIP connector to your PBX) (O/I); WhatsApp from Basic (O); Viber chatbot connector (paid Viber bot, no phone number passed) (O); marketplace "ChatApp for WhatsApp, Telegram, Viber" (O). | O: https://www.bitrix24.eu/prices/ ; https://helpdesk.bitrix24.com/open/17741784 ; I: https://helpdesk.bitrix24.com/open/1332397 |
| 7. Viewings & offers | 4 | Booking: clients book viewings online, automatic reminders, agent availability, waitlists, each booking linked to a CRM record (O); no offer object. | https://www.bitrix24.eu/solutions/industry/real-estate.php |
| 8. Reporting & manager oversight | 6 | "Analytics & reporting tools", KPI and time tracking are Professional-plan items (O); quality n/e. | https://www.bitrix24.eu/prices/ |
| 9. Mobile | 6 | Mobile CRM with telephony, deals and calendar (O); iOS 4.39 from 1,323 US ratings (O). | https://www.bitrix24.eu/prices/ ; https://apps.apple.com/us/app/bitrix24/id561683423 |
| 10. UI/UX & onboarding (not hands-on) | 4 | Capterra ease 4.0 over 1,008 reviews; recurring "cluttered", "overwhelming", "steep learning curve" (O); G2 lists steep learning curve as top con (I). | https://www.capterra.com/p/113540/Bitrix24/reviews/ ; I: https://www.g2.com/products/bitrix24/reviews |
| 11. Integrations / API | 7 | 750–840+ Market apps, REST API, an MCP server (O); app count capped per plan (2/4/7/10/unlimited, O). Zadarma publishes a guide (O, title only). | https://www.bitrix24.eu/prices/ ; https://zadarma.com/en/support/instructions/bitrix24/ |
| 12. Data import / migration | 5 | Partner cases describe importing contacts from Excel (I); duplicate control is often a paid marketplace app (I). | I: https://www.bitrix24.ru/partners/case/25197872/ ; https://www.bitrix24.eu/apps/app/remarkdigital.duplicates_no_more/ |
| 13. Localization (BG) | 3 | Region selector has no Bulgaria; iOS app in 16 languages incl. Russian and Ukrainian, **no Bulgarian** (O); helpdesk says UI language follows the domain and can be changed per user (O). EUR pricing. | https://www.bitrix24.eu/prices/ ; https://helpdesk.bitrix24.com/open/17365500/ ; itunes lookup id 561683423 |
| 14. GDPR / compliance | 5 | Consent collection via chat, document versioning, detailed access permissions (O, vendor claims); no retention/erasure evidence. | https://www.bitrix24.eu/solutions/industry/real-estate.php |
| 15. Pricing fit (2–30 brokers, EE) | 9 | €49–€99/mo flat for up to 5/50 users is far below any per-seat rival (O); the hidden cost is partner implementation time. | https://www.bitrix24.eu/prices/ |
| 16. Multi-office / agency admin | 7 | Access permissions & roles, departments, workgroups; per-SPA permissions (O/I). | https://www.bitrix24.eu/prices/ ; I: https://helpdesk.bitrix24.com/open/13697980/ |

---

## 4. Kommo (formerly amoCRM)

**Positioning.** Messenger-first sales CRM ("conversational selling"), strongest in LATAM,
Turkey, Indonesia and the CIS; iOS app publisher is QSOFT LLC (O). As of 2026-10-28 (O:
https://www.kommo.com/pricing/): **Base $25, Advanced $35, Pro $45 per user/month (≈ €21.5 / €30 /
€39), shown on a 6-month term ("Billed $150/user for 6 months"); 9-month, 1-year and 2-year terms
are offered, but their prices were not captured. Monthly payment is not available; minimum 6
months; billed in USD only** (O). Per-seat caps: 2,500 / 5,000 / 10,000 active leads per seat
(O). Pipeline automation and no-code bots start at Advanced; booking at Pro (O). Example: 10
users on Advanced ≈ €301/mo, prepaid ≈ €1,806 per 6 months.

| Dimension | Score | One-line justification | Source URL(s) |
|---|---|---|---|
| 1. Lead capture & sources | 7 | Every messenger message creates a lead; webforms, Facebook lead ads, leads from incoming email, webhook triggers (O). No BG portal parsing. | https://support.kommo.com/docs/llms.txt ; https://support.kommo.com/docs/connect-viber-to-kommo.md |
| 2. Lead routing / assignment | 5 | "Change lead's user" Digital Pipeline trigger with conditions (source, region, language, hours, value) and a fallback owner (O); no round-robin doc found. | https://support.kommo.com/docs/automate-repetitive-sales-work.md |
| 3. Follow-up discipline | 7 | Stage-entry "Add task" triggers with deadline presets (end of day, 1 day, 3 days, end of week) (O); lead card shows "No tasks planned, start by adding one" (O). | https://support.kommo.com/docs/set-up-digital-pipeline-triggers.md ; https://support.kommo.com/docs/create-assign-tasks.md |
| 4. Contact & deal / pipeline | 7 | Pipelines with drag-and-drop; per-pipeline fields and permissions; only admins edit stages (O). | https://support.kommo.com/docs/pipeline-usage.md |
| 5. Property inventory & matching | 2 | Only a product catalog linked to leads (O); no listing or matching evidence. | https://support.kommo.com/docs/link-products-to-leads.md |
| 6. Communication | 8 | Unified inbox: WhatsApp (multiple numbers by plan), Telegram (unlimited), Instagram, Facebook, TikTok, Viber bot (O); call logging and recording (O); Zadarma PBX integration free with click-to-call, incoming-call card, routing to the responsible user (O). | https://www.kommo.com/pricing/ ; https://zadarma.com/en/support/instructions/kommo/ |
| 7. Viewings & offers | 3 | Booking page and AI booking agent, Pro only (O); no viewing feedback or offers. | https://www.kommo.com/pricing/ ; https://support.kommo.com/docs/booking-page-usage.md |
| 8. Reporting & manager oversight | 6 | Win-loss, consolidated, activity, call, goal and ROI reports (O); reviewers complain about report customisation (O). | https://support.kommo.com/docs/llms.txt ; https://www.capterra.com/p/120048/Kommo/reviews/ |
| 9. Mobile | 5 | iOS/Android apps for pipelines, chats, tasks (O); iOS 4.0 from only 13 US ratings (O). | https://support.kommo.com/docs/kommo-mobile-app.md ; https://apps.apple.com/us/app/kommo/id6443626329 |
| 10. UI/UX & onboarding (not hands-on) | 7 | Capterra ease 4.4 across 263 reviews (O); support responsiveness is a recurring con (I). | https://www.capterra.com/p/120048/Kommo/reviews/ |
| 11. Integrations / API | 6 | 100+ marketplace integrations (O); reviewer praises API and docs (O). | https://www.kommo.com/pricing/ ; https://www.capterra.com/p/120048/Kommo/reviews/ |
| 12. Data import / migration | 6 | Import/export of leads, contacts, companies; find-and-merge duplicates; auto duplicate control covers channel leads, not imports (O). | https://support.kommo.com/docs/set-up-duplicate-control.md |
| 13. Localization (BG) | 2 | UI in English, Indonesian, Portuguese (BR), Russian, Spanish (LATAM), Turkish only (O); USD-only billing (O). | https://support.kommo.com/docs/change-your-language.md ; https://www.kommo.com/pricing/ |
| 14. GDPR / compliance | 3 | WhatsApp opt-in/opt-out statuses, two-step verification, data export (O); no lawful-basis or erasure workflow found. | https://support.kommo.com/docs/llms.txt |
| 15. Pricing fit (2–30 brokers, EE) | 5 | €21.5–€39/user is mid-range, but the 6-month prepay, USD billing and per-seat lead caps hurt small agencies (O). | https://www.kommo.com/pricing/ |
| 16. Multi-office / agency admin | 5 | Users, roles and permissions, pipeline visibility per user (O); no multi-office evidence. | https://support.kommo.com/docs/manage-user-roles.md |

---

## 5. Signature patterns worth learning from

| Pattern | Product | What it does | Map | Source |
|---|---|---|---|---|
| Board sorted by next-activity state | Pipedrive | Each deal card shows red (overdue), green (due today), yellow warning (no activities), grey (future); default order puts overdue and today first, then "no activity", then future. | B-07 (+B-19) | https://support.pipedrive.com/en/article/how-are-deals-ordered-in-the-pipeline-view |
| Forced follow-up prompt | Pipedrive | Marking an activity done immediately prompts to schedule the next one; lower plans cannot turn it off. | B-07 | https://support.pipedrive.com/en/article/how-can-i-disable-the-follow-up-activity-pop-up |
| Rotting per stage | Pipedrive | Per-stage "Rotting in (days)"; the deal tile turns red; done activities, notes and emails reset the timer; future-dated activities do **not** prevent rotting. | B-06 | https://support.pipedrive.com/en/article/the-rotting-feature |
| Required vs "important" fields per stage | Pipedrive | Required fields block adding or moving the deal; "important" fields only show a visual reminder when missing. | B-15 (soft variant: NEW) | https://support.pipedrive.com/en/article/required-fields ; https://support.pipedrive.com/en/article/important-fields |
| Predefined lost reasons | Pipedrive | Admin-defined list, with freeform as an alternative. | B-14 | https://support.pipedrive.com/en/article/lost-reasons |
| Task queues, worked back to back | HubSpot | Shared queues (e.g. "Inbound leads") filled by workflows; reps work through tasks in order. | B-08 (+B-01) | https://knowledge.hubspot.com/tasks/use-task-queues |
| Conditional stage properties | HubSpot | Moving to a stage pops up the dependent fields; "Required" blocks the save. | B-15 | https://knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines |
| Rotate owner (round robin / load balanced) | HubSpot | Workflow action that distributes leads/deals among paid seats. | B-04 | https://knowledge.hubspot.com/workflows/assign-and-rotate-record-owners-using-workflows |
| Listings object in a generic CRM | HubSpot | Property/unit object activatable on any plan, associable with contacts and deals. | B-11 / B-12 (partial) | https://developers.hubspot.com/docs/api-reference/latest/crm/objects/listings/guide |
| Legal basis + permanent delete | HubSpot | Lawful-basis property per contact; permanent delete for erasure requests. | NEW (GDPR) | I: https://knowledge.hubspot.com/privacy-and-consent/how-do-i-turn-on-gdpr-functionality-in-my-hubspot-account |
| Stage-entry automation ("Digital Pipeline") | Kommo | Triggers placed under each stage: create task with deadline preset, change owner, run bot; option to apply to leads already in the stage. | B-03 (stage-triggered variant) | https://support.kommo.com/docs/set-up-digital-pipeline-triggers.md |
| Empty-state "No tasks planned" on the record | Kommo | Lead card nudges to add a task when none exists. | B-07 | https://support.kommo.com/docs/create-assign-tasks.md |
| Deadline presets on task creation | Kommo | In an hour / Today / Tomorrow / end of week, plus exact date-time. | B-09 | https://support.kommo.com/docs/create-assign-tasks.md |
| Cross-channel duplicate control | Kommo | Merges the same client arriving via several channels into one lead (not applied to imports). | NEW (relates to inquiry→contact matching) | https://support.kommo.com/docs/set-up-duplicate-control.md |
| Incoming-call card + route to owner | Kommo + Zadarma | Pop-up client card on inbound calls; a known caller is routed to the responsible user; recordings in the feed. | B-10 (+NEW routing by owner) | https://zadarma.com/en/support/instructions/kommo/ |
| Assignment queue with absence skip | Bitrix24 | "Change responsible person": random, first available, or in order; skips absent employees using the absence chart. | B-04 | I: https://helpdesk.bitrix24.com/open/22396442/ |
| Counters + "No activities" filter | Bitrix24 | Red counters on kanban cards; filter for records with no scheduled activity. | B-01 / B-07 | I: https://helpdesk.bitrix24.com/open/16772374 |
| Custom entity for properties (Smart Process) | Bitrix24 | Agencies build a "property" entity with its own stages and links instead of waiting for the vendor. | NEW (shows demand for B-11/B-12) | I: https://helpdesk.bitrix24.com/open/13697980/ |
| Viewing booking with reminders | Bitrix24 | Public booking of viewings, reminders against no-shows, waitlist, linked to CRM record. | B-13 | https://www.bitrix24.eu/solutions/industry/real-estate.php |
| Flat price per organisation | Bitrix24 | €49–€99/mo regardless of seats up to 5/50 users; anchors EE price expectations. | NEW (pricing) | https://www.bitrix24.eu/prices/ |

Excluded by the benchmark's non-goals (seen, not proposed): Kommo Salesbot / AI agents and the
WhatsApp/Viber two-way inbox in all four; Bitrix24/HubSpot e-signature and document generation.

---

## 6. Contrary evidence / complaints

- **Bitrix24 complexity.** Capterra reviewers repeatedly call it "overwhelming", "cluttered",
  "complex to master", "learning curve is so long" (O: https://www.capterra.com/p/113540/Bitrix24/reviews/).
  G2's summary lists steep learning curve (19), not intuitive (11) and training required (11) as
  top cons (I (snippet): https://www.g2.com/products/bitrix24/reviews). The real-estate page
  itself steers buyers to partners for implementation, which is an extra cost (O).
- **Bitrix24 plan limits.** Apps from the Market are capped per plan (2 apps on Basic) and sales
  automation/analytics start at Professional (€199/mo annual), so a Basic or Standard
  "cheap" setup lacks robots and reports (O: https://www.bitrix24.eu/prices/).
- **Russian origin.** Bitrix24 and Kommo/amoCRM come from Russian vendors (Kommo iOS publisher:
  QSOFT LLC, O). One agency freelance brief rejected both "because they are Russian products"
  (I (snippet): https://freelancehunt.com/en/project/podbor-nastroyka-crm-dlya-agentstva/1484488.html).
  It is a single data point; how Bulgarian agencies weigh this is unknown.
- **Pipedrive add-ons and reporting.** G2 tallies 230 reviews on missing features and add-on
  costs, 151 on limited reporting and automation (I (snippet)). A Capterra reviewer reports a
  feature being "locked behind a more expensive plan upgrade" (O:
  https://www.capterra.com/p/132666/Pipedrive/reviews/). Native calling was withdrawn
  (I: https://support.pipedrive.com/en/article/caller). Pipedrive's iOS app scores 3.75 (O).
- **Pipedrive's activity pop-up is divisive.** Community users ask to switch it off, and lower
  plans cannot (O: https://support.pipedrive.com/en/article/how-can-i-disable-the-follow-up-activity-pop-up).
  A "no next action" guard needs an escape hatch (e.g. lost/closed deals).
- **HubSpot price escalation.** Reviewers: "costs can escalate significantly as you add
  features, hubs, or users" (O: https://www.capterra.com/p/152373/HubSpot-CRM/reviews/);
  mandatory Pro onboarding (O); contract lock-in reports (I (snippet):
  https://www.featurebase.app/blog/hubspot-review). The €7–€10 Starter price is a limited-time
  new-customer promotion (O).
- **Kommo commercial terms and support.** No monthly payment, minimum 6 months, USD only (O:
  https://www.kommo.com/pricing/). Capterra flags slow, ineffective support (I (snippet)); one
  reviewer: "They integrate a bunch of tools but all are buggy" (O). A Kommo help article says
  the Base plan can configure a Salesbot but **cannot launch** it (I (snippet):
  https://support.kommo.com/docs/configure-your-salesbot-triggers).
- **Viber is not "free Viber".** Every product connects Viber as a business chatbot: €100/bot/month
  for bots created since 2024-02 (I (snippet), Viber help 403), customers must find the bot by
  link, and the phone number is not passed (O: https://helpdesk.bitrix24.com/open/17741784).
- **No Bulgarian anywhere.** None of the four has a Bulgarian UI in its app-store localisation
  list or language docs (O: App Store lookups; HubSpot and Kommo language pages). No Bulgarian
  Bitrix24 or Kommo partner surfaced in searches (I).
- **No local real-estate fit.** No portal (imot.bg, homes.bg, OLX.bg) lead parsing or
  syndication for any of the four (I, absence across vendor pages and marketplaces searched).

---

## 7. Open questions

1. **Actual adoption in Bulgaria.** No evidence found of named Bulgarian brokerages on any of
   the four. The only Bulgarian Bitrix24 case found is a regtech firm (I (snippet):
   https://www.bitrix24.com/testimonials/radoslav-dankov.php). Pilot interviews should ask.
2. **Pipedrive official EUR prices**: the pricing page is behind a bot check; the €49 vs €59
   Premium conflict is unresolved.
3. **Kommo 9/12/24-month prices**: offered but not captured (JS-rendered).
4. **HubSpot Sales Hub Pro official EUR seat price**: only third-party EUR figures.
5. **Bitrix24 cloud UI language list**: "18 languages" is claimed, but no list was found. The
   absence of Bulgarian is inferred from the iOS app and region selector.
6. **Viber per-message rates for +359 numbers**, and whether pre-2024 bots on the old model are
   still common among agencies.
7. **Bulgarian telephony.** Do A1, Vivacom or Yettel cloud PBXs have ready connectors to any of
   these CRMs? Searches found none; Zadarma (Bulgarian numbers listed by aggregators) has guides
   for Kommo and HubSpot, and pages titled for Pipedrive and Bitrix24.
8. **Pipedrive native round-robin**: whether Premium "lead routing" is true round-robin was not
   verified in an official article.
9. **Bitrix24 free-plan user limit**: the price card says "for 1–2 users", the FAQ says unlimited.
