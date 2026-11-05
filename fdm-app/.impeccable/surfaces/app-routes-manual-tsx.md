---
version: 1
slug: "app-routes-manual-tsx"
primary_target: "app/routes/manual.tsx"
related_targets: ["app/routes/manual.$slug.tsx","app/routes/manual.background.$slug.tsx"]
---

## Scope

Public user manual at `/manual` (index, chapter, background index, background page). Visitor mode: Read. Background pages double as search landing pages for prospective users (e.g. "stikstofbalans"), so they carry a calm sign-up card; the reading column never turns into marketing.

Audience: farmers and advisors (some policy staff) — prospective users deciding whether to sign up, new users getting started, and existing users looking up how a page works. Copy addresses the reader as "je" (decided in the issue; overrides the u/uw rule for this surface).

## Direction contract

THESIS: Every page shows where you find it in the app. UI labels are set inline as small outlined app-style buttons, exactly as the app draws them, and each page can open with a "Zo vind je het in de app" path. Refuses the generic docs page where labels are just bold text and the app is described from a distance.

OWN-WORLD: fdm-app interior system — white paper, slate ink, hairline borders, Inter only, rounded-md controls with shadow-xs; brand dark #122023 only on the logomark. Label chips: 1px border, white fill, 500 weight, rounded-md. No decorative hue: section labels in muted ink; no kicker above the title (a breadcrumb gives the location).

STORY: The reader lands on a question (how is my nitrogen balance calculated / where do I add a harvest), reads a direct answer in a calm 65–75ch column, sees the exact buttons to click, and either continues to the next chapter or signs up from the card.

FIRST VIEWPORT: 56px header (logomark, "Handleiding" breadcrumb, primary button to the app). Three columns on desktop: 256px section-grouped nav (Aan de slag / Gegevens vastleggen / Resultaten / Samenwerken en account, then Achtergrond groups), the article (breadcrumb, 30–36px title, 20px muted lede, then the in-app path row and a hairline before the typeset body of about 70 characters), and a 224px right rail with "Op deze pagina" and, on background pages and the index, a sign-up card. Phone: nav in a sheet from the header, contents as a disclosure above the article.

FORM: Dealt structure 7 of 7 (labels as app controls), seed: seed:fa192c65283c3539

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Screenshots arrive in a follow-up issue; figures must render nothing when missing.
