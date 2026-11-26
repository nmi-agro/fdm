---
"@nmi-agro/fdm-calculator": minor
---

Add the Dutch legal application norms (gebruiksnormen) for 2027. `createFunctionsForNorms`, `createFunctionsForFertilizerApplicationFilling`, `createUncachedFunctionsForFertilizerApplicationFilling` and `calculateFertilizerApplicationFillingsWithRegion` accept `"2027"` and return the same functions as for 2026, including Renure. The 2027 norms are provisional: they are a copy of the 2026 norms until the official 2027 RVO tables are published.

The supported years are exported as `NORMS_YEARS`, with the `NormsYear` type and the `isNormsYear` type guard (also from `@nmi-agro/fdm-calculator/browser`). The function shapes per year are now keyed by year, so a year without its own entry no longer silently gets the 2025 shape.

Fix the nitrogen norm of "Aardappel, bestrijdingsmaatregel" in 2026: Tabel 2 matched it to the BRP code `nl_2026` (fallow land with forest) instead of `nl_2025` (potato control measure).
