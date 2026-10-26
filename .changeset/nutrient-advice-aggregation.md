---
"@nmi-agro/fdm-calculator": minor
---

Add `aggregateNutrientAdviceToFarmLevel` to aggregate the nutrient dose and advice of several fields to an area-weighted average per hectare or a total. Add the browser-safe entry point `@nmi-agro/fdm-calculator/browser`, which exports the pure aggregation functions (`aggregateNutrientAdviceToFarmLevel`, `calculateNitrogenBalancesFieldToFarm` and `aggregateNormFillingsToFarmLevel`) without server-only dependencies.

The browser entry point also exports `calculateDose`, `calculateNitrogenBalanceField` and the new `calculateFertilizerApplicationFillingsWithRegion`, which calculates the fillings of all gebruiksnormen of a field for 2025 or 2026 with a known soil region, so the effect of an unsaved fertilizer application can be calculated in the browser. The nitrogen filling functions now have a `…WithRegion` variant that takes the soil region instead of looking it up.

Raster values (for example the soil region and atmospheric deposition) are now cached in memory per location, so repeated calculations for the same fields do not read the raster again.
