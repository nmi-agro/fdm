---
"@nmi-agro/fdm-calculator": minor
---

Add the Dutch legal application norms (gebruiksnormen) for 2027. `createFunctionsForNorms`, `createFunctionsForFertilizerApplicationFilling`, `createUncachedFunctionsForFertilizerApplicationFilling` and `calculateFertilizerApplicationFillingsWithRegion` accept `"2027"` and return the same functions as for 2026, including Renure. The 2027 norms are provisional: they are a copy of the 2026 norms until the official 2027 RVO tables are published.

The supported years are exported as `NORMS_YEARS`, with the `NormsYear` type and the `isNormsYear` type guard (also from `@nmi-agro/fdm-calculator/browser`). The function shapes per year are now keyed by year, so a year without its own entry no longer silently gets the 2025 shape.

Fixes in the 2026 norms (and so in the 2027 copy):

- The nitrogen norm of "Aardappel, bestrijdingsmaatregel": Tabel 2 matched it to the BRP code `nl_2026` (fallow land with forest) instead of `nl_2025` (potato control measure).
- Red fescue (roodzwenkgras) grown as a follow-up crop no longer stops the nitrogen norm calculation with an error; it gets the "Roodzwenkgras, volgteelt" norm ("1e jaars" or "overjarig").
- A nature area (`nl_335`) after temporary grassland no longer counts as renewed grass, so the grassland keeps its nitrogen norm. The new `graslandCodes` list holds the grass codes that can replace a grass stand.
- The phosphate filling of organic-rich fertilizers now says "% meegeteld" (the share that counts towards the norm) instead of "% korting", also for 2025.
