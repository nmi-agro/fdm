# Product

## Register

product

Note: the authenticated app is the primary surface and sets the default register. The public, unauthenticated pages (sign-in, privacy, about / what's-new) double as marketing for fdm-app and may lean brand when worked on specifically.

## Users

Primarily agronomic advisors and farmers, and to some extent policy makers. They come to fdm-app to turn the farm data they already know — fields, cultivations, soil analyses, fertilizer applications, harvests — into agronomic insight: nutrient balances, gebruiksruimte (usage norms), nutrient advice, soil-health indicators, and spatial context. They are mid-task, often comparing fields or seasons, and frequently working under time pressure. Most use 14-inch laptops; some reach for a phone in passing.

## Product Purpose

fdm-app exists to be the single place where a farm's raw data becomes connected agronomic insight, instead of being re-entered into many disconnected single-purpose tools. The user provides the minimal raw data they actually know (never derived values like "total nitrogen input"), ideally topped up by integrations with other systems, and in return gets as many connected insights as possible: balances, norms, advice, indicators, and spatial overviews (including datasets like Bodemkaart and Hoogtekaart). Success is when users can quickly and correctly provide that minimal data, clearly see which insights fdm-app can give them, and use those insights to improve farm management — raising production while lowering environmental impact. Data entry is the main bottleneck, so reducing its cost is a first-order product goal.

## Brand Personality

Calm, trustworthy, modern. The voice is that of a competent agronomic colleague: plain-spoken, substantiated, and quietly confident. It explains and shows its work rather than overselling. Tone is professional but approachable — never corporate-intimidating, never hype.

## Anti-references

- Not another cluttered agri-tool that ends up barely used — density must serve the task, not overwhelm it.
- Not an overselling "we save your farm and the world" app making unsubstantiated claims — insight must be backed by transparent calculation.
- Not an enterprise website that feels gated to big corporations — it should feel available to an individual advisor or farmer.

## Design Principles

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
