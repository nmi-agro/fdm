---
"@nmi-agro/fdm-calculator": minor
---

Add the Dutch legal application norms (gebruiksnormen) for 2027. `createFunctionsForNorms`, `createFunctionsForFertilizerApplicationFilling`, `createUncachedFunctionsForFertilizerApplicationFilling` and `calculateFertilizerApplicationFillingsWithRegion` accept `"2027"`. The 2027 norms are provisional: they use the 2026 rules, including Renure, until the official 2027 RVO tables are published.

2027 runs the 2026 functions instead of a copy of them. A later year uses the functions of the earliest year with the same rules, until a regulation or RVO table changes something. For that, the 2026 functions read the norm year from their input: the input of the norm functions now has a `year` field, set by `collectInputForNorms` and `collectInputForNormsForFarm`, and the main crop period, the previous-year checks and the reduction windows follow that year.

The supported years are exported as `NORMS_YEARS`, with the `NormsYear` type and the `isNormsYear` type guard (also from `@nmi-agro/fdm-calculator/browser`). The function shapes per year are now keyed by year, so a year without its own entry no longer silently gets the 2025 shape.

Fixes in the 2026 norms (and so in 2027):

- The nitrogen norm of "Aardappel, bestrijdingsmaatregel": Tabel 2 matched it to the BRP code `nl_2026` (fallow land with forest) instead of `nl_2025` (potato control measure).
- Red fescue (roodzwenkgras) on the "Roodzwenkgras, volgteelt" row no longer stops the nitrogen norm calculation with an error; it gets the "1e jaars" or "overjarig" norm of that row (also for 2025).
- The grass seed and green manure codes now follow the RVO crop code list for the nitrogen norm (also for 2025): `nl_6784` (roodzwenkgras, graszaad) and `nl_6782` (rietzwenkgras, graszaad) only match their main row, `nl_6785` and `nl_6783` (groenbemesting, vanggewas) only the "volgteelt" row, and `nl_6788` and `nl_6789` (veldbeemdgras) only the "Veldbeemdgras" row. Before, each code matched both rows and the choice depended on whether the crop was the main crop.
- A nature area (`nl_335`) no longer counts as grass in the grassland rules: after temporary grassland it no longer replaces the grass stand (so the grassland keeps its nitrogen norm), and it no longer triggers the grassland renewal or destruction reduction. The new `graslandCodes` list holds the grass codes these rules use.
- The phosphate filling of organic-rich fertilizers now says "% meegeteld" (the share that counts towards the norm) instead of "% korting", also for 2025.
- A nature area (`nl_335`) earlier in the year no longer uses up the grassland allowance of grass sown later that year.
- The potato control measure (`nl_2025`) no longer triggers the 65 kg N/ha grassland destruction reduction, which applies to maize and to consumption and starch potatoes only (also for 2025).
- The norm input includes cultivations that start during 31 December, not only those that start at midnight.
- The Renure nitrogen above 80 kg N/ha now counts towards the animal manure norm at the later applications of the year, also when the applications are passed newest first. The year total does not change.
