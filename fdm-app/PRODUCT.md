# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primarily agronomic advisors and farmers, and to some extent policy makers. They come to fdm-app to turn the farm data they already know — fields, cultivations, soil analyses, fertilizer applications, harvests — into agronomic insight: nutrient balances, gebruiksruimte (usage norms), nutrient advice, soil-health indicators, and spatial context. They are mid-task, often comparing fields or seasons, and frequently working under time pressure. Most use 14-inch laptops; some reach for a phone in passing.

## Product Purpose

fdm-app exists to be the single place where a farm's raw data becomes connected agronomic insight, instead of being re-entered into many disconnected single-purpose tools. The user provides the minimal raw data they actually know (never derived values like "total nitrogen input"), ideally topped up by integrations with other systems, and in return gets as many connected insights as possible: balances, norms, advice, indicators, and spatial overviews (including datasets like Bodemkaart and Hoogtekaart). Success is when users can quickly and correctly provide that minimal data, clearly see which insights fdm-app can give them, and use those insights to improve farm management — raising production while lowering environmental impact. Data entry is the main bottleneck, so reducing its cost is a first-order product goal.

## Positioning

fdm-app is an agronomy-first farm data tool: it connects best agricultural practice and environmental impact in one picture. Neighbouring tools sit on one side of that line — farm business software handles invoices and administration, sustainability tools quantify environmental impact without saying what good agronomy looks like, and single-issue tools go deep on one parameter while neglecting the broader farm. fdm-app's claim is the connection itself: the same raw farm record drives balances, norms, advice, indicators and spatial context, so production and environmental impact are judged together rather than in separate tools. It rests on an open-source, standardized farm data model and transparent, auditable calculations developed by NMI.

## Operating Context

Two working rhythms, both organized around the crop year (the calendar in the URL of every farm route):

- **Keeping track.** A farmer or advisor records farm management as it happens — fields, cultivations, fertilizer applications, harvests, soil analyses.
- **Looking back and planning forward.** Just as often an advisor reviews a farm's past season to evaluate it, then builds the plan for the next one. This is the season-boundary peak, and it is comparative work: field against field, year against year.

Advisors work across multiple farms and share access through organizations. Data arrives from outside as much as by hand: RVO parcel registration imports, lab soil analyses as PDF, spatial datasets (Bodemkaart, Hoogtekaart/AHN). A bemestingsplan PDF is the artifact that leaves the app and gets handed over. Sessions with real users are the current feedback channel.

The authenticated app is the primary surface and the one the product is judged by. The public, unauthenticated pages — sign-in, privacy, about / what's-new — double as fdm-app's marketing: for most prospective users they are the only thing seen before signing in.

## Capabilities and Constraints

- **Record:** farms, fields (spatial), cultivations, harvests, fertilizer applications and custom fertilizers, soil analyses (manual, PDF upload, bulk), visual soil assessment (BCS), farm properties such as derogation, grazing intention and organic certification.
- **Insight:** nitrogen and organic-matter balances (farm and field level), gebruiksruimte / usage norms, nutrient advice, mineralization, BLN3 indicators and measures, spatial atlas layers (cultivations, soil, elevation, indicators), timeline, and the Gerrit AI fertilizer planner.
- **Deliverable:** bemestingsplan PDF export.
- **Collaboration:** organizations, membership and invitations, per-farm access sharing, API keys, built-in helpdesk/support.
- **Constraints:** much of the agronomic value depends on the external NMI API (soil estimates, PDF extraction, advice, mineralization, Gerrit, BLN3 catalogue) — features degrade or disappear without its key. Gerrit additionally needs a Gemini key and is rate-limited per user. Auth is better-auth (magic link, Google, Microsoft); maps are MapLibre with OSM or MapTiler. Terminology is Dutch agronomic vocabulary (gebruiksruimte, bemestingsplan, derogatie, perceel, bouwplan) and the Dutch regulatory context is a product fact, not a localization detail.
- **Status:** in production with real users, still actively developed; the README's "alpha" wording predates that.

## Brand Commitments

- **Name and identity:** fdm-app, by NMI. Logo set in `fdm-app/public/` (full colour, grayscale, transparent, no-text variants) plus favicons and touch icons.
- **Voice:** calm, trustworthy, modern — a competent agronomic colleague: plain-spoken, substantiated, quietly confident. It explains and shows its work rather than overselling. Professional but approachable; never corporate-intimidating, never hype.
- **Anti-references:**
  - Not another cluttered agri-tool that ends up barely used — density must serve the task, not overwhelm it.
  - Not an overselling "we save your farm and the world" app making unsubstantiated claims — insight must be backed by transparent calculation.
  - Not an enterprise website that feels gated to big corporations — it should feel available to an individual advisor or farmer.

## Evidence on Hand

Real and citable:

- Open-source repository, actively developed by NMI (`nmi-agro/fdm`).
- In production with real users who give feedback in sessions.
- Currently a free pilot.
- Product screenshots in `fdm-app/public/`: `fdm-screenshot-atlas-cultivations.png`, `fdm-screenshot-atlas-cultivation-history.png`, `fdm-screenshot-atlas-elevation.png`, `fdm-screenshot-nutrient-advice-npk.png`, plus `bemestingsplan_cover.jpg` and the logo set.
- Public surfaces that carry factual content: `/about/whats-new` (changelog) and `/privacy` (policy fetched from `FDM_PRIVACY_URL`).

Deliberately absent — never fabricate: named customers or logos, testimonials, quantified outcome claims (yield gained, nitrogen saved), user counts, awards, certifications, pricing or licensing tiers, and SLA or deployment guarantees.

## Product Principles

- **Raw data in, connected insight out.** Only ask for what the farmer/advisor genuinely knows; derive everything else. Asking a user to enter a computed value is a design failure.
- **Lower the entry barrier relentlessly.** Data entry is the bottleneck. Favor minimal required fields, smart defaults, integrations and bulk/spatial entry, and progressive disclosure over long forms.
- **Make insight discoverable, not hidden.** Users should always know which insights fdm-app can give them and reach them in a click or two; one connected surface beats many disconnected tools.
- **Earn trust through substance.** Calm, transparent, auditable. Show the basis for a number; never inflate or hide uncertainty.
- **Work where the work happens.** Fast and legible on laptops and larger desktops; the 14-inch laptop is not the primary target but is a constant constraint — never let layouts break there. Usable on a phone, with advanced/spatial features gracefully degraded and clearly explained when they need a desktop.

## Accessibility & Inclusion

- Target WCAG 2.1 AA (contrast, focus visibility, keyboard operability, semantic structure).
- Responsive priority: laptops and larger desktops are the working surface; the 14-inch laptop is not the primary target but a constant constraint to respect (layouts must never break at that width). Phones are supported with graceful degradation of advanced/spatial features plus an explanation that they work best on desktop.
- Language: Dutch only today; structure copy so future i18n is possible.
- Data visualization should remain readable for color-vision deficiencies (don't rely on hue alone for balance/indicator status); honor reduced-motion preferences.
