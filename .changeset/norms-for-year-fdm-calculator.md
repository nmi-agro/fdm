---
"@nmi-agro/fdm-calculator": minor
---

Add norms for any target year. `resolveNormsYear` returns the norm year that applies to a target year, and `createFunctionsForNormsForYear`, `createFunctionsForFertilizerApplicationFillingForYear` and `createUncachedFunctionsForFertilizerApplicationFillingForYear` return the norm and filling functions for that year. A year with its own norms gets the same functions as before. A later year, for which no norms are published yet, uses the newest norms provisionally: the data of the target year is collected, its dates are moved to the norm year before each calculation, and the result is marked with `provisional: true` and the `normsYear` that was used. `NORMS_YEARS` and `LATEST_NORMS_YEAR` list the norm years that have their own implementation. `calculateVanggewasWinterteeltKorting` (the catch crop reduction under article 28d Urm) and `isVanggewas` are now exported, so the season planning wizard can show the expected reduction.
