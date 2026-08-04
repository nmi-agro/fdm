# [fdm-app] Dairy UI/UX — Melkvee entry screens + dairy insights

**Epic:** C — fdm-app dairy UI/UX · **Depends on:** 01 (fdm-core dairy schema & CRUD), 02 (fdm-calculator factor tables & balance extension) · **Milestones covered:** M1-M4 app halves

## Background

This single issue covers every dairy-facing screen in `fdm-app` — data entry under a new "Melkvee" sidebar group and the corresponding insight cards under the dashboard "Apps" grid — combining what was originally scoped as four separate issues (one per plan milestone) because the entry screens share the same farm-type gate, sidebar group, and settings-form pattern, and the insight pages share the same balance-page layout; reviewing/merging them independently would mean repeatedly re-touching the same sidebar/gating code. See `research\diary\dairy-farming-implementation-plan-FINAL.md` §7 (both subsections) for the full IA and wireframes, and the fdm-app custom-instructions conventions (flat file routes, `*.server.ts`/`*.client.ts` split, Zustand for client state) plus `PRODUCT.md`/`DESIGN.md` for the visual system.

**Rule (established, intuitive):** the sidebar "Bedrijf" group is where facts are entered; the dashboard "Apps" cards are where computed insight is shown. Both are `$calendar`-scoped. All dairy surfaces are gated on `b_type_farm` including `"dairy"` (+ optional PostHog flag).

## Scope

### Farm-type gate
- Add a farm-type `MultiSelect` field to the existing `settings.properties` route so a farm can be marked `dairy` (multi-select, since a farm can be both `arable` and `dairy`).
- All dairy sidebar/insight surfaces below are gated on `b_type_farm` including `"dairy"` (read from the route loader), optionally behind a PostHog feature flag for staged rollout.

### Sidebar — new "Melkvee" group
Collapsible **Melkvee** entry (icon `cowHead`) in `blocks/sidebar/farm.tsx`, visible only when `isDairy` is true, with six routes under `farm.$b_id_farm.$calendar.dairy.*`, each following the existing per-year settings-form pattern (loader reads existing rows; `fetcher.Form`/remix-hook-form; action upserts via fdm-core; toast):

- **Veestapel** (`.../dairy/veestapel`) — herd/count entry:
  ```
  ┌ Veestapel 2025 ─────────────────────────────────────────────┐
  │ Herd / categorie              Aantal (dieren)    GVE          │
  │ Melkkoeien (RVO 100)          [   96    ]        96.0         │
  │ Jongvee < 1 jr (RVO 101)      [   20    ]         4.6         │
  │ Jongvee ≥ 1 jr (RVO 102)      [   14    ]         7.3         │
  │ Totaal 130 dieren · 107.9 GVE               [+ Categorie]     │
  │ ⓘ Wijzig het aantal → dieren worden aangemaakt/afgevoerd.     │
  │ ⓘ Wijzig de categorie van een dier → automatisch herindelen. │
  └──────────────────────────────────────────────────────────────┘
  ```
  Counts are derived from active `animal_assigning` rows, not stored — the count input's `onChange` calls `addAnimalsToHerd`/a reduce-helper (issue 01), never writes a raw count column. Changing a category calls `setAnimalCategory` (issue 01), presented as "reassigns automatically". GVE per row and the total are computed server-side (issue 02's `getNL{year}DairyGve`, passed via loader data).
- **Melk** (`.../dairy/melk`) — card form: period, kg delivered, fat %, protein %, lactose %, ureum → creates `delivering` + `milk_sampling` + `milk_analyses` for the milking herd's tank. Live read-out of FPCM and milk/cow (derived server-side via issue 02, shown not asked). TanStack list/edit/delete of existing deliveries for the selected year.
- **Voer** (`.../dairy/voer`) — inline add/edit/delete table writing `feed_batches` + `feeding` (type, origin, optional analysis fields).
- **Mest** (`.../dairy/mest`) — inline add/edit/delete table writing `excreting` + `manure_discarding`; surfaces available own manure with a visible link/CTA into the **existing** fertilizer-acquiring screen (the `b_id_manurepit` provenance FK from issue 01).
- **Beweiding** (`.../dairy/beweiding`) — inline add/edit/delete table writing `grazing`; **supersedes** the old settings toggle for grazing intention — remove/redirect the old toggle once this route ships, migrating any existing `intending_grazing` value into a sensible default if feasible.
- **Stal** (`.../dairy/stal`, optional/later per the plan — confirm priority with the team before starting) — inline add/edit/delete table writing `barns` + `housing`; may be descoped to a follow-up if the team decides it's not needed for the initial dairy launch — flag this explicitly in the PR description rather than silently dropping it.

### Insights — new cards in the dashboard "Apps" grid
Add `<NavLink>` cards to the "Apps" grid in `farm.$b_id_farm._index.tsx` (existing card structure: `bg-muted rounded-lg p-3` icon + `CardTitle` + `CardDescription`), shown only for dairy farms:

- **Veestapel-analyse** (`.../dairy/veestapel-analyse`) — GVE, GVE/ha (benchmarks: <2.0 extensief, 2.0–2.6 gemiddeld, >2.6 intensief), herd composition.
- **Melkproductie** (`.../dairy/melk-analyse`) — milk/cow, FPCM, ureum band (15–25 mg/100 g healthy band).
- **Excretie & ruimte** (`.../dairy/excretie`) — farm N/P₂O₅ excretion vs. P₂O₅ plaatsingsruimte (`getNL{year}FosfaatGebruiksNorm`), resulting afvoer surplus/deficit; provenance footer must show the actual RVO factor year in effect, since forfaits change yearly.
- **Voerefficiëntie** (`.../dairy/voer-analyse`) — roughage-from-own-land % (DM, >70–80% benchmark) and protein-from-own-land % (RE, >65% benchmark).
- **Stikstofbalans** (**existing** `/balance/nitrogen` route, updated) — include the new terms from issue 02 (`emission.ammonia.grazing`, `emission.ammonia.barn`/`manure_storage`, `weidegift`, `mestproductie`); these must only appear for dairy farms (or only render with non-zero/defined values) — arable-only farms must see **no visual or numeric change** to the existing balance page (add a regression check for this). Reuse the existing balance-page chart/KPI components rather than introducing new ones.

Each new analysis route reuses the balance-page layout: KPI cards with benchmark badges (`CircleCheck`/`Alert`/`X`) + one `ChartContainer` + stacked horizontal `BarChart` (recharts, streamed via `Suspense`/`use()`), and a provenance/trust footer ("handmatig ingevuld · normfactoren RVO {year}"). Empty state uses `FieldDashboardTileEmpty` with a CTA to the relevant sidebar Melkvee entry screen.

## Acceptance criteria

- [ ] Farm-type `MultiSelect` on `settings.properties` saves and reloads correctly; a farm can have both `arable` and `dairy`.
- [ ] "Melkvee" sidebar group only renders for farms with `dairy` in `b_type_farm`.
- [ ] Veestapel entry: changing a count creates/removes animals via `addAnimalsToHerd`; changing a category re-assigns via `setAnimalCategory`; both reflected immediately after the loader re-runs.
- [ ] Melk entry creates the correct three rows per submission and lists/edits/deletes them correctly for the selected year; FPCM/milk-per-cow read-outs match issue 02's calculator functions for a known worked example.
- [ ] Voer/Mest/Beweiding entry tables support add/edit/delete and persist correctly; Mest's "own manure as fertilizer" link correctly pre-fills/deep-links into the existing fertilizer-acquiring screen; Beweiding fully replaces the old grazing-intention toggle with no dangling dead code.
- [ ] All five insight pages render correct KPI values and benchmark badges for known worked examples (cross-checked against issue 02's unit test fixtures), and the correct empty state when their prerequisite data doesn't exist yet.
- [ ] Existing `/balance/nitrogen` page output for arable-only farms (no dairy data) is unchanged; for dairy farms, the new balance terms appear with correct values.
- [ ] `pnpm exec react-router typegen` then `pnpm exec tsc --noEmit` pass with no errors from `fdm-app`.
- [ ] No server-only package (`@nmi-agro/fdm-core`, `@nmi-agro/fdm-calculator`) is imported at runtime by any client-rendered component — verify with a production build (`pnpm exec vite build`) and check the client bundle doesn't pull in `node:crypto` or similar server-only modules (this exact regression happened once already on the Tijdlijn page; the fix pattern is to precompute values server-side in the loader).

## Out of scope

`fdm-core`/`fdm-calculator` implementation (issues 01/02 — this issue only consumes their exports), per-animal (`milking_animal`/`feeding_animal`) UI (decide separately whether/when a robot-milking/feeding per-animal view is needed; not required for this issue's manual-entry scope), RVO ingestion UI.

## References

`dairy-farming-implementation-plan-FINAL.md` §7.1, §7.2, §8.3.
