# Competitor notes: proven international real-estate CRMs

> Research date: 2026-10-28. Scope: Follow Up Boss, BoldTrail (ex-kvCORE), Lofty (ex-Chime),
> Sierra Interactive (US); onOffice (DE), Reapit and Alto (UK), Propertybase (Salesforce-based).
> Method: vendor product, pricing and help-centre pages fetched with curl, plus Capterra / GetApp
> review pages and web-search snippets. None of these products was used hands-on, so
> "UI/UX" scores come from reviews and vendor material only.
>
> **Evidence labels.** **O** = Observed on the cited page in this session. **I** = Inferred, or
> taken from a search-result snippet of a page that refused the fetch. Several help centres
> answered **403** to a plain curl (`help.followupboss.com`, `help.lofty.com`,
> `support.altosoftware.co.uk`, Trustpilot, G2). Per the brief, these were not bypassed: claims
> from them come from search snippets and are labelled **I (snippet)**, which is weaker evidence.
>
> **Currency.** Prices are as of 2026-10-28, in the vendor's currency, excluding VAT unless
> stated. EUR conversions use approximate rates of **1 USD ≈ 0.86 EUR** and **1 GBP ≈ 1.15 EUR**.
> These are rough planning rates, not live quotes. Bulgaria has used the euro since 2026-01-01
> (fixed rate 1 EUR = 1.95583 BGN), so "EUR support" is what matters for BG.
>
> **Scores** use the shared 0–10 rubric (0 absent, 2 token, 4 basic, 6 solid, 8 strong,
> 10 best-in-class). "n/e" = no evidence found.

---

## 0. Eastern Europe / Bulgaria availability at a glance

| Product | Markets it actually sells in | Bulgarian UI | EUR | European portals | Evidence |
|---|---|---|---|---|---|
| Follow Up Boss | US (Zillow-owned since the 2023 deal) | n/e (English only seen) | n/e | No; US lead sources (Zillow etc.) | O: https://www.followupboss.com/pricing (nav shows "Zillow Pro"); I: https://www.housingwire.com/articles/zillow-acquires-crm-platform-follow-up-boss |
| BoldTrail | US and Canada; a Canadian reviewer says features are "tailored more for the U.S. market" | n/e | n/e | No (US MLS / IDX) | O: https://www.capterra.com/p/176447/kvCORE/reviews/ ; I: https://housingwire.com/articles/inside-real-estate-rebrands-product-portfolio-as-boldtrail |
| Lofty | US (Phoenix HQ), Canada | n/e | n/e | No (US IDX / MLS) | O: https://www.lofty.com/pricing |
| Sierra Interactive | "agents across the US and Canada" | n/e | n/e | No (MLS feeds) | O: https://www.sierrainteractive.com/pricing/ |
| onOffice | DE, AT, CH, IT, ES, **HR (Croatia, local subsidiary)**, UK | **No evidence.** Help centre is EN/DE/IT/ES only; the DeepL auto-translate list has no BG/HR | Yes (prices in EUR) | 150+ portals; whether any BG portal is included is unknown | O: https://www.onoffice.com/en/ ; O: https://hr.onoffice.com/en/ (imprint "onOffice, informacijske tehnologije, d.o.o."); O: https://de.enterprisehilfe.onoffice.com/help_entries/settings-2/?lang=en ; I (snippet): https://de.enterprisehilfe.onoffice.com/category/additional-modules/multi-language-module/?lang=en |
| Reapit | UK & Ireland, Australia & NZ, Denmark (bought Mindworking in 2021; it also has customers in Norway and Finland) | n/e | n/e | UK/AU portals; Bookings plug into "property portals" | O: https://www.reapit.com/ (region switcher); I: https://www.reapit.com/press-releases/reapit-acquires-european-proptech-marketing-technology |
| Alto (Zoopla / Vebra Solutions Ltd) | UK only ("6,000+ UK agencies", "1/3 of the UK market") | No | No (GBP) | UK portals (Zoopla) | O: https://www.altosoftware.co.uk/alto-intelligence-keep-everyone-updated/ |
| Propertybase (Lone Wolf) | Claims "60+ countries"; no named EU customers found | Partly. Salesforce lists Bulgarian as an *end-user* language (standard labels only; Setup and help stay English). Whether Propertybase's custom objects are translated: n/e | Yes. Language and currency are configurable (Salesforce multi-currency) | n/e | O: https://www.propertybase.com/ ; I (snippet): https://developer.salesforce.com/docs/atlas.en-us.216.0.api_meta.meta/api_meta/meta_translations.htm ; I (snippet): https://propertybase.com/real-estate-crm/salesforce-edition |

**Bottom line (I):** none of the eight products shows evidence of selling in Bulgaria, offering a
Bulgarian UI, or integrating with Bulgarian portals (imot.bg, homes.bg, OLX.bg). The nearest
presence is **onOffice's Croatian subsidiary**. Propertybase can technically show Bulgarian labels
through Salesforce, but needs a configuration partner. The four US products are tied to the US
MLS/IDX/SMS stack and would be a poor fit in BG even if sold there.

---

## 1. Per-product profiles and scores

### 1.1 Follow Up Boss (FUB)

**Positioning.** US real-estate CRM for teams and solo agents, built around speed-to-lead and
"work the list" discipline. Zillow agreed to buy it in Nov 2023 (USD 400 M plus earn-out) and runs
it as a standalone brand. **Pricing (O, as of 2026-10-28):** Grow USD 69/user/month (calling is a
USD 39/user add-on); Pro USD 499/month for 10 users plus USD 49 per extra user, with unlimited
calling and texting; Platform USD 1,000/month for 30 users plus USD 20 per extra user. Annual
billing is about 17% cheaper (Pro USD 416/month). No contracts; 7-day trial. A 10-broker agency
pays about **€430/month on Pro (≈ €43/user)** or €595/month on Grow. Source:
https://www.followupboss.com/pricing

| # | Dimension | Score | One-line justification | Source URL(s) |
|---|---|---|---|---|
| 1 | Lead capture & sources | 8 | O: "Pull in new leads from over 200 different sources"; the open API has `POST /events` for lead ingestion and `/people/checkDuplicate`; web pixel. | https://www.followupboss.com/features/lead-routing ; https://docs.followupboss.com/reference/getting-started |
| 2 | Lead routing / assignment | 9 | O: round robin and first-to-claim for the whole team or groups; rules by source, type, price, ZIP; listing leads go to the listing agent; **Ponds** for inactive leads. I (snippet): Lead Flow sets the agent and the action plan per source. | https://www.followupboss.com/features/lead-routing ; https://www.followupboss.com/how-it-works/agent ; https://help.followupboss.com/hc/en-us/articles/4402121268631 |
| 3 | Follow-up discipline | 9 | O: Smart Lists (dynamic filters; "advance arrow" to the next lead); Action Plans. I (snippet): plans auto-pause when the contact replies by email or text, or on a call. | https://www.followupboss.com/features/smart-list ; https://help.followupboss.com/hc/en-us/articles/1500008539982 |
| 4 | Contact & deal / pipeline | 6 | O: deal tracking, stages, collaborators, @mentions. I (snippet): "Deal Stage Changed" automation trigger. A reviewer's "least favourite" part is how lists are generated. | https://www.followupboss.com/how-it-works/agent ; https://help.followupboss.com/hc/en-us/articles/4402695405847 ; https://www.capterra.com/p/130020/Follow-Up-Boss/reviews/ |
| 5 | Property inventory & matching | 2 | I: no listing inventory. Matching relies on IDX-site behaviour (e.g. "searched $500k–$1M") fed into Smart Lists. | https://www.followupboss.com/features/smart-list |
| 6 | Communication | 8 | O: built-in dialer and call queue, texting incl. group/video, Google/Microsoft email sync, one timeline per contact. Calling and texting are US numbers; no Viber or WhatsApp seen. | https://www.followupboss.com/how-it-works/agent |
| 7 | Viewings & offers | 2 | O: calendar sync and appointments only; no viewing-feedback or offer record seen. | https://www.followupboss.com/pricing |
| 8 | Reporting & oversight | 7 | O: agent and lead-source reports, call reporting (Pro), leaderboard. I (snippet): agent activity report; dashboard "Speed to Action" = average time to first call, text or email. A reviewer built external reporting for lead progression. | https://www.followupboss.com/pricing ; https://help.followupboss.com/hc/en-us/articles/360014693073 ; https://www.capterra.com/p/130020/Follow-Up-Boss/reviews/ |
| 9 | Mobile | 6 | O: native iOS/Android with push for new leads. Reviews report call logging working "SOME of the time" and an appointment date bug. | https://www.followupboss.com/how-it-works/agent ; https://www.capterra.com/p/130020/Follow-Up-Boss/reviews/ |
| 10 | UI/UX & onboarding (not hands-on) | 8 | O: Capterra 4.5/5 (58 reviews), ease of use 4.5; reviewers praise simplicity. 7-day phone support, daily training. | https://www.capterra.com/p/130020/Follow-Up-Boss/reviews/ |
| 11 | Integrations / API | 9 | O: "250+ integrations", documented REST API, webhooks, embedded apps. | https://www.followupboss.com/integrations ; https://docs.followupboss.com/reference/getting-started |
| 12 | Import / migration | 7 | I (snippet): CSV import at Admin > Import with column mapping and a calling/texting consent confirmation step; staff-assisted import by email. O: "Support and migration". | https://help.followupboss.com/hc/en-us/articles/4402323033751 ; https://www.followupboss.com/pricing |
| 13 | Localization (BG relevance) | 1 | I: English UI, US phone and texting stack; no other language or currency evidence. | https://www.followupboss.com/pricing |
| 14 | GDPR / compliance | n/e | No GDPR or DPA evidence found. Consent prompts on import are US (TCPA-style) calling/texting consent. | — |
| 15 | Pricing fit (EE, 2–30 brokers) | 3 | O: Pro ≈ €43/user for 10 users is the cheapest per-seat option here, but its value (calling, texting, Zillow) does not transfer to BG. | https://www.followupboss.com/pricing |
| 16 | Multi-office / admin | 7 | O: admin and agent roles, groups, team inboxes; "Teams within teams" on Platform. | https://www.followupboss.com/pricing |

### 1.2 BoldTrail (formerly kvCORE; Inside Real Estate)

**Positioning.** All-in-one US/Canadian platform for brokerages and teams: IDX websites, Lead
Engine, Smart CRM, Marketing Autopilot, plus BackOffice (commissions, accounting) and Recruit
modules (O: https://boldtrail.com/). kvCORE was rebranded to BoldTrail in mid-2024. **Pricing:**
not published (quote only). Third-party estimates from Luxury Presence, a competitor: team
**USD 499–999/month for 5–10 users** (≈ €430–860), brokerage USD 1,200–1,800+/month, setup fees
"around $999" reported (I: https://luxurypresence.com/blogs/boldtrail-pricing).

| # | Dimension | Score | One-line justification | Source URL(s) |
|---|---|---|---|---|
| 1 | Lead capture | 8 | O: IDX websites, Lead Engine, Leads360 and PropertyBoost add-ons. | https://boldtrail.com/ |
| 2 | Routing | 7 | I (snippet, eXp support doc covering BoldTrail): routing rules by source and lead type, with new-lead notification by call or SMS. | https://support.expcloud.com/portal/kb/articles/how-to-adjust-how-when-you-get-alerted-about-a-new-lead |
| 3 | Follow-up discipline | 7 | I (snippet): Behavioral Automation triggers on return visits and property views, skipping contacts messaged in the last 3 days. O: Smart Campaigns. Reviewers find campaigns "confusing to implement". | https://help.insiderealestate.com/en/articles/3332635-kvcore-behavioral-automation-overview (now 404; snippet only) ; https://www.capterra.com/p/176447/kvCORE/reviews/ |
| 4 | Contact & deal | 6 | O: Smart CRM plus Transaction Integration. | https://boldtrail.com/ |
| 5 | Property & matching | 5 | I: listing search and alerts come from US MLS feeds via IDX; no agency inventory model seen. | https://boldtrail.com/ |
| 6 | Communication | 6 | O: email and SMS campaigns. Reviews mention missed notifications for lead messages. | https://www.capterra.com/p/176447/kvCORE/reviews/ |
| 7 | Viewings & offers | n/e | — | — |
| 8 | Reporting | 6 | O: Business Analytics; Recruit has office and agent reports. A reviewer wants "more reporting … to monitor if [agents] are using the system". | https://boldtrail.com/ ; https://www.capterra.com/p/176447/kvCORE/reviews/ |
| 9 | Mobile | 4 | O: a reviewer calls the mobile app "horrible". The vendor now markets an AI mobile app. | https://www.capterra.com/p/176447/kvCORE/reviews/ ; https://boldtrail.com/ |
| 10 | UI/UX (not hands-on) | 4 | O: Capterra 4.4/5 (565) but ease of use only 4.1; recurring "slow", "overwhelming", "dated training videos". | https://www.capterra.com/p/176447/kvCORE/reviews/ |
| 11 | Integrations | 7 | O: Marketplace add-ons; I: many partner integrations. | https://boldtrail.com/ |
| 12 | Import | n/e | — | — |
| 13 | Localization | 1 | O: a Canadian reviewer finds features US-tailored. | https://www.capterra.com/p/176447/kvCORE/reviews/ |
| 14 | GDPR | n/e | — | — |
| 15 | Pricing fit | 2 | I: quote-only, setup fees. O: a reviewer says "they will not let you out of the contract". | https://www.capterra.com/p/176447/kvCORE/reviews/ |
| 16 | Multi-office | 8 | O: brokerage-grade BackOffice, agent onboarding, office reports. | https://boldtrail.com/ |

### 1.3 Lofty (formerly Chime)

**Positioning.** US all-in-one "AI-powered" platform: IDX site, CRM, Smart Plans automation, AI
agents, paid lead generation. **Pricing:** "Request Pricing" on all four tiers (O:
https://www.lofty.com/pricing). Third-party figures (June 2026): Core **USD 449/month**, Premier
USD 700, Enterprise USD 1,500, plus one-time fees of USD 500–2,000. No free trial (I:
https://theclose.com/lofty-crm-review/). The AI Sales Agent starts at USD 60/month (I:
https://luxurypresence.com/blogs/lofty-review). Roughly ≈ €385–1,290/month before add-ons.

| # | Dimension | Score | One-line justification | Source URL(s) |
|---|---|---|---|---|
| 1 | Lead capture | 8 | O: IDX website, seller and buyer ad programmes, external listing widget. | https://www.lofty.com/pricing |
| 2 | Routing | 7 | O: "Advanced Lead Routing". I (snippet): Next Up / Blast Alert rules with a catch-all Round Robin; routing cannot be paused on a schedule. | https://www.lofty.com/pricing ; https://help.lofty.com/hc/en-us/articles/360042342411 |
| 3 | Follow-up | 7 | I (snippet): Smart Plans auto-pause when the lead replies (email, call, text, AI reply) **or when the lead's pipeline stage changes**. O: "AI Task Prioritization". Reviewers call Smart Plan setup "technical and cumbersome". | https://help.lofty.com/hc/en-us/articles/4407222860315 ; https://help.lofty.com/hc/en-us/articles/45537578767643 ; https://www.capterra.com/p/157457/Lofty/reviews/ |
| 4 | Contact & deal | 6 | I (snippet): pipelines with stage-driven automation. | https://help.lofty.com/hc/en-us/articles/4407222860315 |
| 5 | Property & matching | 5 | O: IDX, listing tools, unlimited basic CMAs. | https://www.lofty.com/pricing |
| 6 | Communication | 6 | O: one-off, mass and auto email and texting; basic dialer (power dialer is an add-on). A reviewer: "how buggy the dialer can be". | https://www.lofty.com/pricing ; https://www.capterra.com/p/157457/Lofty/reviews/ |
| 7 | Viewings & offers | n/e | — | — |
| 8 | Reporting | 4 | O: "Reporting" listed with no detail. | https://www.lofty.com/pricing |
| 9 | Mobile | 5 | O: mobile app; a reviewer says it is not optimised for iPad. | https://www.capterra.com/p/157457/Lofty/reviews/ |
| 10 | UI/UX (not hands-on) | 4 | O: Capterra 3.8/5 (128); ease of use 3.9, customer service 3.4; "filters … do not stay permanently". | https://www.capterra.com/p/157457/Lofty/reviews/ |
| 11 | Integrations | 6 | O: Google/Outlook calendar and email integrations; "AI CLI access". | https://www.lofty.com/pricing |
| 12 | Import | 6 | O: "Set up & Success Program … data migration". A reviewer says setup is "100% on the user". | https://www.lofty.com/pricing ; https://www.capterra.com/p/157457/Lofty/reviews/ |
| 13 | Localization | 1 | I: US product. | https://www.lofty.com/pricing |
| 14 | GDPR | n/e | — | — |
| 15 | Pricing fit | 2 | I: high base fee plus setup fees. O: a reviewer says you are "nickeled and dimed" (AI, CMA and home values are extra). | https://www.capterra.com/p/157457/Lofty/reviews/ |
| 16 | Multi-office | 7 | O: team management; Enterprise adds SSO, white label and a "Customizable Org Structure". | https://www.lofty.com/pricing |

### 1.4 Sierra Interactive

**Positioning.** US/Canada IDX website plus CRM for teams that buy online leads. **Pricing (O,
as of 2026-10-28):** Starter USD 299.95/month (1 user), Essential USD 399.95 (3 users), Growth
USD 599.95 (5 users) on annual billing. Monthly billing costs USD 359.95–724.95 plus a USD 500
setup fee. Extra users on Growth cost USD 20/user (users 6–10). Dialer is a USD 100/month add-on
on Starter; Lead Engage AI texting is USD 199/month. A 10-user Growth plan ≈ USD 700/month
(**≈ €600**). Source: https://www.sierrainteractive.com/pricing/

| # | Dimension | Score | One-line justification | Source URL(s) |
|---|---|---|---|---|
| 1 | Lead capture | 7 | O: IDX sites, seller lead sites, single-property sites, MLS feeds. | https://www.sierrainteractive.com/pricing/ |
| 2 | Routing | 6 | O: "advanced lead routing" from the Essential tier. | https://www.sierrainteractive.com/pricing/ |
| 3 | Follow-up | 8 | O: Fully Automated Action Plans with pre-plan, in-plan and post-plan rules (stop or pause on response, then trigger a drip) and an "actionable window" of 7am–11pm. | https://help.sierrainteractive.com/helpcenter/scale-your-lead-follow-up-with-fully-automated-action-plans |
| 4 | Contact & deal | 4 | I: The Close calls the "Sierra CRM … basic, lacking more robust features". | https://theclose.com/sierra-interactive-review/ |
| 5 | Property & matching | 5 | I: MLS-based IDX search and saved searches; no agency inventory. | https://www.sierrainteractive.com/pricing/ |
| 6 | Communication | 7 | O: dialer with SMS/MMS, voice minutes, ringless voicemail, group text; Lead Engage AI two-way texting. | https://www.sierrainteractive.com/pricing/ ; https://help.sierrainteractive.com/helpcenter/setting-up-and-using-lead-engage-sierra-ai |
| 7 | Viewings & offers | n/e | — | — |
| 8 | Reporting | 6 | O: Agent Reporting shows speed to lead (average time to first contact), assigned leads with and without activities, and activity on unassigned leads; refreshed once a day; managers only. The Close says it "lacks analytics and reporting". | https://help.sierrainteractive.com/helpcenter/agent-reporting-how-to-measure-coach-and-improve-agent-performance ; https://theclose.com/sierra-interactive-review/ |
| 9 | Mobile | 5 | O: the mobile app is "Included with Dialer upgrade". | https://www.sierrainteractive.com/pricing/ |
| 10 | UI/UX (not hands-on) | n/e | Review base too thin (no Capterra listing found). | — |
| 11 | Integrations | 6 | O: API access and integrations access in all tiers. | https://www.sierrainteractive.com/pricing/ |
| 12 | Import | n/e | — | — |
| 13 | Localization | 1 | O: US and Canada only. | https://www.sierrainteractive.com/pricing/ |
| 14 | GDPR | n/e | — | — |
| 15 | Pricing fit | 3 | O: ≈ €60/user at 10 users, but the value is MLS/IDX-bound. | https://www.sierrainteractive.com/pricing/ |
| 16 | Multi-office | 6 | O: Primary Manager and per-user permissions (e.g. "Can manage … Action Plans"). | https://help.sierrainteractive.com/helpcenter/scale-your-lead-follow-up-with-fully-automated-action-plans |

### 1.5 onOffice enterprise (Germany)

**Positioning.** Owner-managed German vendor since 2001. "40,000 users" (EN site); "35,000" on the
HR site. Its cloud software is **property-centric** (properties and contacts are the two cores)
for independent agencies. Markets: DE, AT, CH, IT, ES, HR (local d.o.o.), UK; hosted in Germany.
**Pricing (O, DE/EN site, as of 2026-10-28):** enterprise **pro €79** and **all-in €99**
per user/month, excluding VAT, plus **€50/month service fee per company (waived at 10+ users)**
and setup. **24-month contract**, 5-year price guarantee. "expert" is quote-only. The Process
Manager, Enquiry Manager, phone module, groups and API are **all-in only**. The Croatian site
shows different tier names (essential/premium/expert, quote only) and lists WhatsApp Web. A
10-broker BG agency would pay ≈ **€990/month** on all-in. Sources:
https://onoffice.com/en/real-estate-software/ ; https://hr.onoffice.com/en/real-estate-software/

| # | Dimension | Score | One-line justification | Source URL(s) |
|---|---|---|---|---|
| 1 | Lead capture | 8 | O: the **Enquiry Manager** reads portal requests from the inbox, checks for duplicates by email, optionally asks the prospect to confirm their details on a web page, creates the contact and sends the brochure. A dashboard widget shows each request's status. Also WP website forms and an API. | https://de.enterprisehilfe.onoffice.com/help_entries/overview/?lang=en ; https://onoffice.com/en/real-estate-software/ |
| 2 | Routing | 4 | I (snippet): process steps assign to the process owner, the property's or contact's "person in charge", or a named user. No round robin or pond found. Enquiries reach the main user of the inbox. | https://de.enterprisehilfe.onoffice.com/help_entries/create-process-template/action-letter/?lang=en ; https://de.enterprisehilfe.onoffice.com/help_entries/overview/?lang=en |
| 3 | Follow-up discipline | 8 | O: the Process Manager "puts recurring workflows on autopilot" (tasks, emails, resubmissions). I (snippet): steps start N days after the previous one; each has a responsible person and a deadline; a "process controller" is emailed when a step is skipped or overdue. | https://onoffice.com/en/real-estate-software/ ; https://de.enterprisehilfe.onoffice.com/help_entries/create-process-template/?lang=en |
| 4 | Contact & deal | 7 | O: contact hierarchy, "status of the customer journey", Acquisition Cockpit, multi-property module. | https://onoffice.com/en/real-estate-software/ |
| 5 | Property & matching | **10** | O: **search profiles** on the contact, built from any property field, with **KO criteria** (must match) and a **match percentage** for the rest. Matching runs from the contact ("property search") or from the property ("interested parties"). Only "open" properties match. Profiles expire automatically. The prospect can deactivate or confirm a profile through email macros. "Manual assignments" and "previously offered" tabs stop duplicate offers. | https://de.enterprisehilfe.onoffice.com/help_entries/detailed-address-view/immo-search-overview/immo-search-details/?lang=en |
| 6 | Communication | 7 | O: email management, Marketing box (email tracking), phone module (all-in), SMS steps in processes (snippet). WhatsApp Web listed on the HR site. | https://onoffice.com/en/real-estate-software/ ; https://hr.onoffice.com/en/real-estate-software/ |
| 7 | Viewings & offers | 7 | O: **Property Feedback** collects structured feedback after viewings into the CRM; the app has viewing certificates signed on the phone and a check-in questionnaire. Feedback and offers from the Interactive Brochure "land in onOffice". No formal offer-negotiation record seen. | https://onoffice.com/en/real-estate-software/ ; https://onoffice.com/en/real-estate-software/app/ |
| 8 | Reporting | 6 | O: Success Cockpit, statistics tools, property statistics, time tracking. | https://onoffice.com/en/real-estate-software/ |
| 9 | Mobile | 7 | O: native app works **offline**; logs phone calls from the phone into the database; CarPlay / Android Auto; signatures on the phone. | https://onoffice.com/en/real-estate-software/app/ |
| 10 | UI/UX (not hands-on) | n/e | Too few English reviews: GetApp has one 5-star review ("many settings"); OMR Reviews has 0 reviews. Inferred: highly configurable, so likely heavy to set up. | https://www.getapp.co.uk/software/107805/onoffice ; https://omr.com/de/reviews/product/onoffice-enterprise |
| 11 | Integrations / portals | 9 | O: "over 150 portals", automatic full update to 3 portals, API, Marketplace, Microsoft 365, AI Connector (Claude, ChatGPT, Mistral). | https://onoffice.com/en/real-estate-software/ |
| 12 | Import | 6 | O: onboarding team guides "the scope of the data transfer"; switching offers exist. Details n/e. | https://hr.onoffice.com/en/real-estate-software/ |
| 13 | Localization | 5 | O: multilingual module (property and contact language versions, per-user UI language). Croatian subsidiary. EUR-native. Bulgarian UI: n/e. | https://de.enterprisehilfe.onoffice.com/help_entries/settings-2/?lang=en ; https://hr.onoffice.com/en/ |
| 14 | GDPR | 9 | I (snippet): per-contact GDPR status (Ignore / Consent to storage / Revoke storage / No information), "save until" date and reason, a **Consent Assistant** that requests consent in one click and logs it, and a dashboard widget that lists revoked or expired records for deletion. No automatic deletion. O: hosting in Germany, audit-proof email archiving (all-in). | https://de.enterprisehilfe.onoffice.com/help_entries/dsgvo/overview-and-setup/?lang=en ; https://de.enterprisehilfe.onoffice.com/help_entries/configuring-widgets/gdpr-widget/?lang=en ; https://onoffice.com/en/real-estate-software/ |
| 15 | Pricing fit | 3 | O: €79–99/user/month for 24 months, plus €50/month under 10 users. High for BG broker economics (inferred). | https://onoffice.com/en/real-estate-software/ |
| 16 | Multi-office / admin | 7 | O: groups, intranet, rights that control which search profiles a user sees. | https://onoffice.com/en/real-estate-software/ ; https://de.enterprisehilfe.onoffice.com/help_entries/detailed-address-view/immo-search-overview/immo-search-details/?lang=en |

### 1.6 Reapit (UK)

**Positioning.** Platform for UK & Irish estate and lettings agencies, from single branch to
national chains; "2/3 of the UK's most profitable estate agencies use Reapit". Also sold in
AU/NZ and Denmark. Modules: Sales CRM, Lettings CRM, Property Management, Bookings, Reapit Go
(mobile), Client Accounts, DataWarehouse, AppMarket. **Pricing:** not published. Per-user
licence, "invoiced monthly in advance", with user numbers "reviewed quarterly" (I (snippet):
https://reapit.atlassian.net/wiki/x/OoSwD). Sources: https://www.reapit.com/ ;
https://www.reapit.com/solutions/single-branch

| # | Dimension | Score | One-line justification | Source URL(s) |
|---|---|---|---|---|
| 1 | Lead capture | 8 | O: an "internet registrations" tool turns portal leads into Reapit records automatically. **Bookings** pre-qualifies portal enquiries with per-property forms and creates applicant records. | https://www.reapit.com/solutions/single-branch ; https://www.reapit.com/platform/bookings |
| 2 | Routing | n/e | — | — |
| 3 | Follow-up | 6 | O: "Power organiser" dashboard of appointments, tasks, messages and follow-ups due; "smart workflows, bulk actions, time-saving automations". | https://www.reapit.com/solutions/single-branch ; https://www.reapit.com/platform/sales-crm |
| 4 | Contact & deal | 8 | O: single-screen applicant, vendor and property records; sales progression "from enquiry to exchange". | https://www.reapit.com/platform/sales-crm |
| 5 | Property & matching | 8 | O: applicant requirements and two-way matching (applicant → properties, property → applicants). I (snippet): applicants are a distinct resource with requirements (rooms, budget). | https://www.reapit.com/platform/sales-crm ; https://foundations-documentation.reapit.cloud/platform-glossary |
| 6 | Communication | 6 | O: Reapit Go drafts SMS or **WhatsApp** messages and offers one-tap reminder and feedback templates; letter templates. | https://www.reapit.com/platform/reapit-go |
| 7 | Viewings & offers | 9 | O: buyers book viewings **from portals** into the diary, with automated email/SMS reminders "to minimise no-shows". Agents record viewing feedback on the spot in Reapit Go. Offers sit on the applicant record. | https://www.reapit.com/platform/bookings ; https://www.reapit.com/platform/reapit-go ; https://www.reapit.com/platform/sales-crm |
| 8 | Reporting | 8 | O: predefined and custom reports, MI reports, daily progression reports for "morning meetings", DataWarehouse. I (snippet): Power Reports find properties with no viewings in a period. | https://www.reapit.com/solutions/single-branch ; https://www.estateagenttoday.co.uk/sponsored-content/2023/03/7-tactics-to-generate-more-successful-viewings-with-reapit/ |
| 9 | Mobile | 6 | O: Reapit Go has diary, appointments, records, feedback and messaging, synced to desktop. | https://www.reapit.com/platform/reapit-go |
| 10 | UI/UX (not hands-on) | 4 | O: Capterra UK has only 2 reviews (4★ and 2★); one says "very slow (even for a cloud product)". I (snippet): Trustpilot 3.5/5 (106). Weak sample. | https://www.capterra.co.uk/software/37359/reapit-property-sales ; https://at.trustpilot.com/review/www.reapit.com |
| 11 | Integrations / API | 8 | I (snippet): Foundations REST API with signed webhooks (applicants, appointments, etc.); AppMarket. O: a reviewer reports *metered* charges for API access to their own data. | https://foundations-documentation.reapit.cloud/api/ ; https://www.capterra.co.uk/software/37359/reapit-property-sales |
| 12 | Import | 6 | O: "Setup & migration" service and a migration ebook. | https://www.reapit.com/ |
| 13 | Localization | 2 | O: English-speaking markets plus Denmark; nothing for CEE. | https://www.reapit.com/ |
| 14 | GDPR / compliance | 7 | O: marketing consent on applicant, vendor and property records; built-in AML checks. | https://www.reapit.com/platform/sales-crm |
| 15 | Pricing fit | 2 | I: quote-only, aimed at multi-branch. O: a reviewer reports a charge of £80+VAT for a two-word template change. | https://www.capterra.co.uk/software/37359/reapit-property-sales |
| 16 | Multi-office | 9 | O: single-branch, multi-branch and national/franchise solutions; shared dashboard layouts. | https://www.reapit.com/solutions/single-branch |

### 1.7 Alto (Zoopla; Vebra Solutions Ltd)

**Positioning.** UK sales and lettings CRM owned by Zoopla: "6,000+ UK agencies", "1/3 of the UK
market", "average go-live 16 days", **free migration** (">1,600 migrations from 50+ systems").
Adds Alto Intelligence (AI drafting, appraisal builder) and Alto Lead Flow (BridgeAI).
**Pricing:** not published (I: https://whito.co.uk/for/estate-agents/best-software-for-uk-estate-agents/).
Sources: https://www.altosoftware.co.uk/sales-crm/ ; https://www.altosoftware.co.uk/solutions/how-we-compare/

| # | Dimension | Score | One-line justification | Source URL(s) |
|---|---|---|---|---|
| 1 | Lead capture | 8 | O: Lead Flow handles enquiries from portals, website, WhatsApp and email the moment they arrive, then qualifies and books viewings into the Alto diary. | https://www.altosoftware.co.uk/lead-flow/ |
| 2 | Routing | n/e | — | — |
| 3 | Follow-up | 6 | I (snippet): making an offer creates Dashboard tasks. O: sales progression flags "what's stalling". | https://support.altosoftware.co.uk/hc/en-gb/articles/5048131422111 ; https://www.altosoftware.co.uk/sales-crm/ |
| 4 | Contact & deal | 8 | O: customisable sales-progression milestones and checklists, chain view, conveyancer grouping, audit trail. | https://www.altosoftware.co.uk/product-features/property-sales-progression-for-estate-agents/ |
| 5 | Property & matching | 8 | O: a new property "instantly" sources matching applicants; match groups; engagement stats (opens, clicks); re-filter after a property change; **matches only applicants who gave GDPR consent**. | https://www.altosoftware.co.uk/product-features/applicant-property-matching/ |
| 6 | Communication | 6 | O: mailouts with tracking; SMS/email progression updates; WhatsApp through Lead Flow. | https://www.altosoftware.co.uk/product-features/property-sales-progression-for-estate-agents/ ; https://www.altosoftware.co.uk/lead-flow/ |
| 7 | Viewings & offers | 9 | I (snippet): automated feedback request to the applicant **30 minutes after a confirmed viewing**; the branch can share it with the owner. Offers are made from Dashboard, Property or Contact; chasing and revising offers keeps the negotiation history. O: the Keyflo portal shows vendors live status and viewing feedback. | https://support.altosoftware.co.uk/hc/en-gb/articles/5048145022495 ; https://support.altosoftware.co.uk/hc/en-gb/articles/5048069591839-Chasing-and-revising-offers ; https://www.altosoftware.co.uk/sales-crm/ |
| 8 | Reporting | 7 | O: Alto Analytics has pre-built dashboards, custom reports, "Presentation Mode" for team meetings and scheduled updates. | https://www.altosoftware.co.uk/analytics/ |
| 9 | Mobile | n/e | — | — |
| 10 | UI/UX (not hands-on) | 4 | O: Capterra UK has 6 reviews, three of them 1★ ("slow loading", "multiple different tabs just to get a tenancy set up"). The vendor claims 4.55★ on Trusted Reviews. Weak sample. | https://www.capterra.co.uk/software/153764/alto ; https://www.altosoftware.co.uk/sales-crm/ |
| 11 | Integrations | 7 | O: dozens of named partner integrations (Goodlord, Fixflo, LeadPro, Moneypenny…); portal publishing. | https://www.altosoftware.co.uk/ |
| 12 | Import / migration | 9 | O: migration is free, average go-live 16 days, ">1,600 migrations from more than 50 systems"; says rivals charge "up to £1,500". | https://www.altosoftware.co.uk/solutions/how-we-compare/ |
| 13 | Localization | 1 | O: UK only. | https://www.altosoftware.co.uk/ |
| 14 | GDPR / compliance | 7 | O: consent-gated matching; AML checks via Thirdfort and SmartSearch. | https://www.altosoftware.co.uk/product-features/applicant-property-matching/ ; https://www.altosoftware.co.uk/sales-crm/ |
| 15 | Pricing fit | 2 | I: quote-only. O: a reviewer reports a price rise 7 months into a 24-month contract. | https://www.capterra.co.uk/software/153764/alto |
| 16 | Multi-office | 7 | O: single-branch and multi-branch offerings; branch-scoped AI. | https://www.altosoftware.co.uk/alto-intelligence-win-instructions/ |

### 1.8 Propertybase Salesforce Edition (Lone Wolf)

**Positioning.** Real-estate CRM built natively on Salesforce: "20k+ users", "60+ countries",
brokerages of "10 agents to 200+". Covers leads, listings, deals through commission, and e-sign
(Authentisign). **Pricing (O):** "from **USD 89/user/month**, Force.com licence included" (≈
**€77/user**); implementation is extra (inferred). Source: https://www.propertybase.com/

| # | Dimension | Score | One-line justification | Source URL(s) |
|---|---|---|---|---|
| 1 | Lead capture | 7 | O: "Lead capture, routing, and auto-matching to listings". | https://www.propertybase.com/ |
| 2 | Routing | 6 | O: routing listed; Salesforce assignment rules (inferred). | https://www.propertybase.com/ |
| 3 | Follow-up | 7 | O: "Automated lead follow-up and task creation"; Salesforce Flow. | https://www.propertybase.com/ |
| 4 | Contact & deal | 8 | O: "Deal pipeline from first enquiry to commission payout"; milestone tracking. | https://www.propertybase.com/ |
| 5 | Property & matching | 7 | O: listings, auto-matching, property alerts. I (snippet): reviewers cite the inquiry-to-listing matching tool. | https://www.propertybase.com/ ; https://www.capterra.co.uk/reviews/122129/propertybase |
| 6 | Communication | 5 | O: email marketing and property alerts; calling n/e. | https://www.propertybase.com/ |
| 7 | Viewings & offers | 5 | O: offers "sent, signed, and tracked inside the CRM" via Authentisign; showings mentioned. | https://www.propertybase.com/ |
| 8 | Reporting | 8 | O: "Real-time reporting and Salesforce dashboards". | https://www.propertybase.com/ |
| 9 | Mobile | 6 | O: iOS and Android "full feature access". | https://www.propertybase.com/ |
| 10 | UI/UX (not hands-on) | 3 | I (snippet): Capterra 3.8/5 (51), ease of use 3.3; "setup and customization, a fair amount of on-going maintenance … learning curve" (mostly 2018–19 reviews). | https://www.capterra.co.uk/reviews/122129/propertybase |
| 11 | Integrations | 8 | O: "4,000+ apps via Salesforce AgentExchange". | https://www.propertybase.com/ |
| 12 | Import | n/e | — | — |
| 13 | Localization | 6 | I (snippet): language and currency configurable. Salesforce supports Bulgarian as an end-user language with Setup and help in English. Custom-object translation n/e. | https://propertybase.com/real-estate-crm/salesforce-edition ; https://developer.salesforce.com/docs/atlas.en-us.216.0.api_meta.meta/api_meta/meta_translations.htm |
| 14 | GDPR | 5 | O: claims "SOC 2, GDPR, and 99.9% uptime". No feature-level evidence. | https://www.propertybase.com/ |
| 15 | Pricing fit | 4 | O: ≈ €77/user, plus Salesforce admin effort (inferred). | https://www.propertybase.com/ |
| 16 | Multi-office | 9 | O: "Multi-office and multi-territory structures"; Salesforce roles and sharing. | https://www.propertybase.com/ |

### 1.9 Score matrix (copy of the tables above)

| Dim | FUB | BoldTrail | Lofty | Sierra | onOffice | Reapit | Alto | Propertybase |
|---|---|---|---|---|---|---|---|---|
| 1 Lead capture | 8 | 8 | 8 | 7 | 8 | 8 | 8 | 7 |
| 2 Routing | 9 | 7 | 7 | 6 | 4 | n/e | n/e | 6 |
| 3 Follow-up | 9 | 7 | 7 | 8 | 8 | 6 | 6 | 7 |
| 4 Contact & deal | 6 | 6 | 6 | 4 | 7 | 8 | 8 | 8 |
| 5 Property & matching | 2 | 5 | 5 | 5 | 10 | 8 | 8 | 7 |
| 6 Communication | 8 | 6 | 6 | 7 | 7 | 6 | 6 | 5 |
| 7 Viewings & offers | 2 | n/e | n/e | n/e | 7 | 9 | 9 | 5 |
| 8 Reporting | 7 | 6 | 4 | 6 | 6 | 8 | 7 | 8 |
| 9 Mobile | 6 | 4 | 5 | 5 | 7 | 6 | n/e | 6 |
| 10 UI/UX | 8 | 4 | 4 | n/e | n/e | 4 | 4 | 3 |
| 11 Integrations | 9 | 7 | 6 | 6 | 9 | 8 | 7 | 8 |
| 12 Import | 7 | n/e | 6 | n/e | 6 | 6 | 9 | n/e |
| 13 Localization (BG) | 1 | 1 | 1 | 1 | 5 | 2 | 1 | 6 |
| 14 GDPR | n/e | n/e | n/e | n/e | 9 | 7 | 7 | 5 |
| 15 Pricing fit | 3 | 2 | 2 | 3 | 3 | 2 | 2 | 4 |
| 16 Multi-office | 7 | 8 | 7 | 6 | 7 | 9 | 7 | 9 |

---

## 2. Signature patterns worth learning from

Pattern IDs refer to `.claude/skills/sprint-planning/references/crm-benchmark.md`. "NEW" = no
matching B-ID. Patterns that fall under the benchmark's excluded list (syndication, drip
marketing, AI scoring, WhatsApp inbox, e-sign, document generation) are flagged **[excluded]**.

| # | Pattern (what to borrow) | Product(s) | Maps to | Source |
|---|---|---|---|---|
| S-01 | **Smart List with an "advance to next lead" arrow.** A saved dynamic filter you work top to bottom without returning to the list ("New leads < 7 days", "last emailed > 60 days ago + past client"). | FUB | B-01, B-08, B-17 | https://www.followupboss.com/features/smart-list |
| S-02 | **Lead Flow per source:** each source sets its own assignee rule *and* the follow-up plan to start. | FUB | B-04, B-03 | https://help.followupboss.com/hc/en-us/articles/4402121268631 (snippet) |
| S-03 | **Routing modes:** round robin, first-to-claim, rule-based (area, price band, "lead on a listing → listing agent"). | FUB, Lofty, BoldTrail | B-04 | https://www.followupboss.com/features/lead-routing ; https://help.lofty.com/hc/en-us/articles/360042342411 (snippet) |
| S-04 | **Ponds:** inactive or unclaimed leads go to a shared pool that agents can claim; a claim moves ownership and open plan tasks to the claimer and is logged on the timeline. Also a first-to-claim fallback ("not claimed → pond"). | FUB | B-04 (variant), B-18 | https://www.followupboss.com/features/lead-routing ; https://help.followupboss.com/hc/en-us/articles/4422920700439 (snippet) |
| S-05 | **"Uncontacted on day 2 → reassign"** automation: if a lead is still in "Lead" with no call, text or email, reassign it to another agent, group or pond. | FUB | B-04, B-05 | https://help.followupboss.com/hc/en-us/articles/9961386591895 (snippet) |
| S-06 | **Action Plans that auto-pause** when the contact replies, calls in, or changes pipeline stage. Sierra adds pre-plan, in-plan and post-plan rules plus "only send between 7am and 11pm". | FUB, Lofty, Sierra | B-03 | https://help.followupboss.com/hc/en-us/articles/1500008539982 (snippet) ; https://help.lofty.com/hc/en-us/articles/4407222860315 (snippet) ; https://help.sierrainteractive.com/helpcenter/scale-your-lead-follow-up-with-fully-automated-action-plans |
| S-07 | **Speed-to-lead and "assigned leads without activity" report** for managers: average time to first contact per agent, leads with zero outreach, and activity on *unassigned* leads as a routing smell. | Sierra, FUB | B-05, B-20 | https://help.sierrainteractive.com/helpcenter/agent-reporting-how-to-measure-coach-and-improve-agent-performance ; https://help.followupboss.com/hc/en-us/articles/360014693073 (snippet) |
| S-08 | **Stage-changed automation trigger** (fires when a deal moves stage, not when it is created). | FUB, Lofty | NEW (related to B-15) | https://help.followupboss.com/hc/en-us/articles/4402695405847 (snippet) |
| S-09 | **Search profile with KO criteria and a match %.** Required criteria filter; the rest score; matching runs from both sides; profiles expire; "previously offered" list prevents re-sending. | onOffice | B-11, B-12 | https://de.enterprisehilfe.onoffice.com/help_entries/detailed-address-view/immo-search-overview/immo-search-details/?lang=en |
| S-10 | **Enquiry manager pipeline with visible status:** portal email → duplicate check by email → optional confirmation of details by the prospect → contact created → brochure sent. A widget shows each request as *waiting / aborted (duplicate) / completed*, and a duplicate creates a task instead of a second record. | onOffice | B-16, NEW (inquiry processing status) | https://de.enterprisehilfe.onoffice.com/help_entries/overview/?lang=en |
| S-11 | **Process template with deadlines and a "process controller"** who is emailed when a step is missed or skipped; steps are assigned to "the property's person in charge". | onOffice | B-03 + NEW (escalation) | https://de.enterprisehilfe.onoffice.com/help_entries/create-process-template/?lang=en (snippet) |
| S-12 | **GDPR status per contact:** consent / revoked / no info / ignore, "keep until" date and reason, a one-click consent request that is logged, a deletion worklist widget, and no silent auto-delete. | onOffice | NEW (Bulgarian adaptation checklist: GDPR) | https://de.enterprisehilfe.onoffice.com/help_entries/dsgvo/overview-and-setup/?lang=en (snippet) ; https://de.enterprisehilfe.onoffice.com/help_entries/configuring-widgets/gdpr-widget/?lang=en (snippet) |
| S-13 | **Consent-gated matching:** only applicants who agreed to contact appear in matches and mailouts. | Alto | B-12 + GDPR | https://www.altosoftware.co.uk/product-features/applicant-property-matching/ |
| S-14 | **Automated viewing-feedback request** sent 30 minutes after a confirmed viewing, optionally shared with the owner. Reapit Go records feedback at the door. | Alto, Reapit, onOffice | B-13 | https://support.altosoftware.co.uk/hc/en-gb/articles/5048145022495 (snippet) ; https://www.reapit.com/platform/reapit-go ; https://onoffice.com/en/real-estate-software/ |
| S-15 | **Offer record with history:** an offer is entered from the dashboard, property or applicant; creates follow-up tasks; revisions keep the negotiation trail; offers are chased. | Alto, Reapit | NEW (offers) | https://support.altosoftware.co.uk/hc/en-gb/articles/5048131422111 (snippet) ; https://support.altosoftware.co.uk/hc/en-gb/articles/5048069591839-Chasing-and-revising-offers (snippet) |
| S-16 | **Owner/vendor update view:** the vendor sees live status and viewing feedback (Keyflo/PropertyFile); progression updates sent by SMS or email. | Alto | NEW (owner report; benchmark lists "vendor/landlord update reports" for Reapit/Alto) | https://www.altosoftware.co.uk/sales-crm/ ; https://www.altosoftware.co.uk/product-features/property-sales-progression-for-estate-agents/ |
| S-17 | **Self-booked viewings with SMS reminders** from portal enquiries, with per-property pre-qualification forms. | Reapit (Bookings), Alto (Lead Flow) | NEW (related to B-13, B-16) | https://www.reapit.com/platform/bookings ; https://www.altosoftware.co.uk/lead-flow/ |
| S-18 | **"Power organiser" daily dashboard:** appointments, tasks, messages and follow-ups due, with quick call and email links; layouts shareable across the team. | Reapit | B-08 (Today-screen analogue) | https://www.reapit.com/solutions/single-branch |
| S-19 | **Stale-stock report:** properties for sale with no viewings in N days, to prompt price-reduction talks. | Reapit | B-06 (applied to listings) | https://www.estateagenttoday.co.uk/sponsored-content/2023/03/7-tactics-to-generate-more-successful-viewings-with-reapit/ |
| S-20 | **Mobile app that works offline and logs calls automatically** into the contact record. | onOffice | B-09, B-10 | https://onoffice.com/en/real-estate-software/app/ |
| S-21 | **Free, fast migration as a sales weapon** (16-day go-live, 50+ source systems). | Alto | NEW (onboarding/import) | https://www.altosoftware.co.uk/solutions/how-we-compare/ |
| S-22 | **Pipeline meeting from the dashboard** ("Presentation Mode", scheduled dashboard updates to the team). | Alto | B-20 | https://www.altosoftware.co.uk/analytics/ |
| S-23 | **Import with explicit consent attestation** before contacts can be called or texted. | FUB | NEW (import + GDPR) | https://help.followupboss.com/hc/en-us/articles/4402323033751 (snippet) |
| S-24 | Behavioural alerts from website activity, with a 3-day "recently messaged" suppression. | BoldTrail | NEW **[excluded-adjacent: marketing automation]** | https://help.insiderealestate.com/en/articles/3332635-kvcore-behavioral-automation-overview (snippet) |
| S-25 | Portal syndication to 150+ portals. | onOffice | **[excluded]** | https://onoffice.com/en/real-estate-software/ |
| S-26 | AI two-way texting nurture (Lead Engage), AI lead scoring, AI appraisal drafting. | Sierra, Lofty, Alto | **[excluded]** | https://help.sierrainteractive.com/helpcenter/setting-up-and-using-lead-engage-sierra-ai ; https://www.lofty.com/pricing ; https://www.altosoftware.co.uk/alto-intelligence-win-instructions/ |

---

## 3. Contrary evidence and complaints

- **Support quality is the most common complaint across almost all of them.**
  - BoldTrail: "support is horrendous"; tickets stay open for months (O: https://www.capterra.com/p/176447/kvCORE/reviews/).
  - Lofty: customer service rated 3.4/5; "tickets drag on for weeks or months" (O: https://www.capterra.com/p/157457/Lofty/reviews/).
  - Reapit: "support is terrible … email ticketing" (O: https://www.capterra.co.uk/software/37359/reapit-property-sales).
  - Alto: "since the sellout … support team York closed down" (O: https://www.capterra.co.uk/software/153764/alto).
  - Propertybase: generic link-to-article replies (I: https://www.capterra.co.uk/reviews/122129/propertybase).
  - FUB has the fewest support complaints. One reviewer says "Less helpful when it comes to troubleshooting" (O: https://www.capterra.com/p/130020/Follow-Up-Boss/reviews/).
- **Contract and pricing traps.**
  - onOffice requires a **24-month contract** (O).
  - Alto: a reviewer reports a price rise 7 months into a 24-month contract and long tie-ins (O).
  - BoldTrail: "will not let you out of the contract" (O).
  - Lofty: setup fees of USD 500–2,000 and paid add-ons ("AI Assistant? Extra. CMA tool? Extra.") (I/O).
  - Sierra charges a USD 500 setup fee on monthly billing (O).
  - Reapit charges for template edits and meters API access to customers' own data (O, single reviewer).
- **Performance.** "Slow" recurs for BoldTrail, Reapit and Alto (O, review pages above).
- **Complex automation setup.** Lofty Smart Plans are "technical and cumbersome"; BoldTrail campaigns are "confusing to implement"; Propertybase needs "ongoing maintenance" (O/I). Inference: automation depth reduces adoption in small agencies unless it ships with good defaults.
- **Mobile is weaker than desktop for most of them.** BoldTrail "horrible"; FUB call logging works "SOME of the time"; Lofty is not iPad-optimised (O).
- **FUB gaps.** No native listing inventory or matching (I); reporting stops at activity and lead source, so one team "had to make our own external reporting system" for lead progression (O). Automatic reassignment of uncontacted leads needs a tag-plus-automation workaround (I, snippet).
- **Sierra's CRM is "basic"** and it "lacks analytics and reporting" per The Close (I), although its help centre documents a decent agent report (O). The two sources disagree.
- **Small or old review samples.** Reapit (2 Capterra reviews), Alto (6), onOffice (≈ 0 English reviews), Propertybase (51, mostly 2018–19). Their UI/UX scores are low-confidence.
- **Vendor claims that could not be verified:** onOffice "40,000 users" vs "35,000" on the HR site (O, inconsistent); Alto "1/3 of the UK market" and "4.55★" (O, vendor claim); Propertybase "60+ countries" (O, vendor claim; no named EU customers found).

---

## 4. Open questions (not resolved)

1. Does onOffice offer a **Croatian or Bulgarian UI**, and does its portal list include any
   Bulgarian (imot.bg, homes.bg, OLX.bg) or Croatian (Njuškalo) portal? The Croatian subsidiary
   exists, but nothing about portals or language was found.
2. onOffice pricing on the Croatian site is quote-only with different tier names. Is it lower than
   the €79/€99 DE price? Unknown.
3. Propertybase: does the current Lone Wolf offering still sell and support EU customers directly,
   or only through partners? Are its custom objects translated into Bulgarian, or only Salesforce
   standard labels?
4. FUB, Lofty, Alto help-centre articles answered 403. Their claims (auto-pause triggers, pond
   claiming, Alto feedback timing, offers workflow) rest on search snippets and should be re-checked
   in a browser.
5. kvCORE's Behavioral Automation article moved (404 at the new Intercom URL). The current BoldTrail
   equivalent and its "Hot Prospects" naming were not confirmed.
6. Real prices for Reapit, Alto, BoldTrail and Lofty are not public. The third-party estimates
   (Luxury Presence, The Close) come from a competitor or an affiliate site.
7. Does Alto have a native mobile app comparable to Reapit Go? No evidence was found either way.
8. Does any of the US products support non-US phone numbers for its built-in calling and texting?
   This decides whether their communication score would carry over to BG. Not checked.
9. G2 refused the fetch (403), so G2 ratings are missing for all eight products.
