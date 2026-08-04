# [fdm-calculator] Dairy factor tables + nitrogen-balance extension

**Epic:** B — fdm-calculator dairy factor tables & balance extension · **Depends on:** 01 (herds/animals for category/count inputs; manure pit provenance FK for the `mestproductie`/manure-N term) · **Milestone:** M3 Excretion + balance

## Background

This issue is entirely within `fdm-calculator` — its own package with its own year-keyed factor-table pattern and its own test surface, so it stays a separate issue from the fdm-core schema work even after the other core issues were combined. It extends the **existing** nitrogen balance rather than introducing a new model; the balance already has an explicit `emission.ammonia.grazing: undefined` hook and field→farm area-weighted aggregation in place. See `research\diary\dairy-farming-implementation-plan-FINAL.md` §5, §6, §9 (open questions 4, 5, 6).

## Scope

### Factor tables (§5)
- `fdm-calculator/src/norms/nl/{2025,2026}/value/dairy-gve-data.ts` — GVE factors per RVO diercategorie (100: melkkoe 1.00, 101: jongvee <1jr 0.23, 102: jongvee ≥1jr 0.52, etc.).
- `fdm-calculator/src/norms/nl/{2025,2026}/value/dairy-excretion-data.ts` — RVO Tabel 4 (jongvee N/P₂O₅ per category) + Tabel 6 (melkkoe 2-D table: melkproductie × ureum → N/P₂O₅ excretion), including the 2025→2026 correctiefactor change (N-correctiefactor 8.5%→14%) and the 2026 derogatie N-norm change (→170 kg N/ha).
- `dairy-gve.ts` (`getNL{year}DairyGve(category, count) -> gve`) and `dairy-excretion.ts` (`getNL{year}DairyExcretion(input) -> { n_kg, p2o5_kg, source }`), registered as new keys in `createFunctionsForNorms("NL", year)` so calling code never year-branches; wrap in `withCalculationCache`.
- Register new **`L_*`** parameter codes in `nmi_parameters.csv` (owned by this repo): milk `L_MILK_FAT/PROTEIN/LACTOSE/UREA`, grazing `L_GRAZE_DAYS/HOURS/AREA/TYPE`, derived `L_GVE`, `L_N_EXCRETION`, `L_P_EXCRETION`, `L_MILK_PER_COW`, `L_FPCM` — a new registry family parallel to the existing `P_`/`A_`/`F_`/`B_LU_`/`M_`/`D_`/`S_` families; this does not change any table column prefix (milk/grazing action columns in fdm-core stay `b_`, feed stays `f_`).

### Nitrogen-balance extension (§6)
- Activate `emission.ammonia.grazing` from grazing hours/days + excretion factors.
- Add `emission.ammonia.barn` / `emission.ammonia.manure_storage` term slots, fed by housing + manure (from issue 01).
- Add a supply term `weidegift` (N deposited on grazed fields).
- Add a farm-level `mestproductie` term (total excreted N/P from the herd), using the new dairy-excretion factors and the manure-pit provenance from issue 01.
- Thread `grazingInput`/`herdInput` through `NitrogenBalanceInput` so the above terms have data to consume.

### Self-contained dairy KPIs (pure calculation functions only — the `fdm-app` epic's insight pages consume these, they don't implement them)
- Total GVE = `Σ derived_count(category) × GVE_factor(category)`; GVE/ha.
- FPCM = `milk × (0.337 + 0.116·fat% + 0.06·protein%)`; N-in-milk = `milk·protein%/100/6.38`.
- Excretion vs. placement space: farm N/P₂O₅ excretion (Tabel 4/6) vs. P₂O₅ gebruiksnorm × ha (reuses the **existing** `getNL{year}FosfaatGebruiksNorm`).
- Feed self-sufficiency: roughage-from-own-land % (DM) and protein-from-own-land % (RE).

## Acceptance criteria

- [ ] `createFunctionsForNorms("NL", 2025)` and `("NL", 2026)` both expose `getNL{year}DairyGve` and `getNL{year}DairyExcretion` with correct year-specific factors (including the 2026 correctiefactor/derogatie changes) — covered by a test per year.
- [ ] `NitrogenBalanceInput` accepts `grazingInput`/`herdInput`; `emission.ammonia.grazing` is no longer `undefined` when grazing input is supplied, and existing balance tests without dairy input still pass unchanged (no regression for arable-only farms).
- [ ] New `L_*` parameter codes are present in `nmi_parameters.csv` with correct units/domains, and do not collide with any existing code.
- [ ] GVE, FPCM, N-in-milk, excretion-vs-placement, and feed-self-sufficiency helper functions each have a unit test with a known-good worked example (values from the RVO reference tables), so the numbers are auditable.
- [ ] `pnpm build` succeeds for `fdm-calculator`.

## Out of scope

Any fdm-core schema changes (issue 01), any fdm-app UI (fdm-app epic consumes these functions, doesn't implement them).

## References

`dairy-farming-implementation-plan-FINAL.md` §5, §6, §8.2, §9 (open questions 4, 5 resolved, 6).
