---
"@nmi-agro/fdm-calculator": minor
---

The nitrogen balance and the organic matter balance now use the most recent soil data per parameter up to the end of the selected period, in the same way as the application standards and the nutrient advice. Soil analyses sampled before the period now count; analyses sampled after the period still don't.

Breaking: the field input of both balances takes `currentSoilData` (the current soil data from `getCurrentSoilData` or `getCurrentSoilDataForFarm` in fdm-core) instead of `soilAnalyses`. `collectInputForNitrogenBalance` and `collectInputForOrganicMatterBalance` fill it for you; only code that builds the balance input itself needs to change.
