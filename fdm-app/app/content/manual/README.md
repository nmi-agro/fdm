# User manual: author guide

This folder holds the public, Dutch user manual of fdm-app, served at `/manual`. It has two kinds of page:

- **Chapters** (`chapters/<slug>.md`, URL `/manual/<slug>`): how to use a part of the app.
- **Background pages** (`background/<slug>.md`, URL `/manual/background/<slug>`, headed "Achtergrond"): what an agronomic result means and how it is calculated. They are written for farmers, advisors and policy staff, and must be complete on their own.

The pages are parsed once when the server starts (`app/lib/manual/content.server.ts`) and checked by `pnpm --filter @nmi-agro/fdm-app test`.

## Writing style

- Dutch, professional but informal, addressed to the reader as "je". Metric units and Dutch number formatting (0,5; 1.250 kg).
- Say honestly what the app can and cannot do. Mark estimates as estimates and say when the regulations or RVO take precedence.
- Never include personal data, real farm or field names, identifiers, coordinates or author names.
- **Current year first.** Describe the rules and values of the current year. Earlier years that the app still calculates go in a short section at the end, such as `## Verschillen in 2025 {#2025}`. When a new year starts, move the old year's rules into that section.
- **Usage-norms disclaimer.** Every page that explains the usage norms (gebruiksruimte) includes this note verbatim; a test enforces it for those pages and for any heading about gebruiksruimte or gebruiksnormen:

  > De gebruiksnormen in {{appName}} zijn indicatief en alleen bedoeld ter informatie. Raadpleeg voor de definitieve normen en je verantwoording altijd de officiële publicaties van RVO en je adviseur.

  The list of situations the app does not support lives on the background page `gebruiksruimte#niet-ondersteund` and mirrors `NormsDisclaimer` in `app/components/blocks/norms/norms-disclaimer.tsx`; keep both in step.

- Use `{{appName}}` for the product name and `{{appUrl}}` for its URL. The repository is white-label, so never hard-code a name. Other `{{tokens}}` fail the tests.

## Frontmatter

```yaml
---
title: Bouwplan # required; the page title (h1)
description: Vul zaaidata, … # required; 50–160 characters, used as meta description
section: Gegevens vastleggen # required; see the sections below
order: 2 # required; order within the section
routes: # required; may be empty for background pages
  - farm.$b_id_farm.$calendar.rotation*
watch: # optional; extra files this page describes
  - fdm-app/app/components/blocks/rotation/**
inApp: # optional; "Zo vind je het in de app" path of UI labels
  - Bouwplan
keywords: [bouwplan, teeltplan] # optional; search terms
aliases: [teeltplan] # optional; old slugs that redirect (301) here
related: [bemesting, background/stikstofbalans] # optional; "Lees ook"
image: bouwplan-tabel # optional; screenshot id for social previews
updated: 2026-11-05 # optional; last content change (YYYY-MM-DD)
lastReviewed: 2026-11-05 # required on background pages; last agronomic review
---
```

Sections for chapters: `Aan de slag`, `Gegevens vastleggen`, `Resultaten`, `Samenwerken en account`. Sections for background pages: `Balansen`, `Normen en advies`, `Bodem`.

`routes` globs are relative to `fdm-app/app/routes/`; `watch` globs are relative to the repository root. Every glob must match at least one file. Escape `[` and `]` in globs (`sitemap\[.\]xml.ts`), because brackets are a character class.

## Body

- Don't write an h1; the title comes from the frontmatter. Start with an introduction, then `##` sections and `###` subsections, without skipping a level.
- Headings get an id from their text (diacritics removed, `&` becomes "en"). Add an explicit id when other pages or help links point to the heading, or when the heading contains a token: `## Gerrit, de AI-assistent {#gerrit}`.
- Link to other pages with root-relative URLs: `[Bouwplan](/manual/bouwplan)`, `[het doel](/manual/background/stikstofbalans#doel)`. The tests check that pages and anchors exist. External links must use `https://`.
- Tables (GitHub-flavoured Markdown) and `>` notes are fine.

### Bold means a UI label

**Bold** text is shown as an app-style button and must be a label that exists in the app (a button, tab, menu item, field label or status). The label test fails when a bold text cannot be found in the source of fdm-app, fdm-core, fdm-data or fdm-calculator. Short labels (fewer than 3 words and under 20 characters) must match a whole string exactly; longer labels may match part of a string.

The test ignores code comments, so commented-out UI does not count. It does not know which screen a label belongs to: a label removed from one screen still passes when the same text appears elsewhere, and short labels such as "Opslaan" almost always pass. A green test means no stale or misspelled labels, not that the steps are still correct; that is what the route-drift warning and review are for.

Use plain text or _italics_ for emphasis. If bold text really is a label that the test cannot find (for example because the app composes it at runtime), add it to `label-allowlist.json` with a reason. Unused allowlist entries fail the test.

### Screenshots

Images only use the `screenshot:` scheme: `![De bouwplantabel met één gewas opengeklapt](screenshot:bouwplan-tabel)`. The alt text becomes the caption. Screenshot files (`screenshots/<id>.webp`, optional sizes in `screenshots/manifest.json`) are generated separately; until a file exists, the page renders nothing in production and a placeholder in development.

### Frequently asked questions

In the `hulp` chapter, each `###` heading under `## Veelgestelde vragen {#veelgestelde-vragen}` is a question and the text below it the answer. They are published as `FAQPage` structured data.

## Keeping the manual up to date

- A pull request that changes a user-visible label, flow or page updates the chapter that lists the route in `routes` or `watch`, in the same PR.
- CI warns (it never fails) when a PR changes a described file without its chapter: `node fdm-app/scripts/manual-route-drift.mjs` with `BASE_SHA` set shows the same locally.
- The `fdm-user-guide-sync` skill (`.claude/skills/`) updates the affected chapters for you: run it in your PR, or let the weekly routine open a sync PR against `development`.
- Before every release a maintainer reviews the background pages against the calculations and updates `lastReviewed`.

## Help links from the app

Screens link to the manual through the typed registry in `app/lib/manual/help-targets.ts`. A route declares `export const handle: HelpHandle = { help: "bouwplan" }`; the sidebar item "Handleiding" then links to that target. Screens that need explaining also show a "?" next to their title (`FarmTitle help="…"`), once per screen. When you rename a heading that a help target points to, keep its explicit `{#id}`. The tests fail when a help target no longer resolves.
