---
"@nmi-agro/fdm-calculator": patch
"@nmi-agro/fdm-reports": patch
"@nmi-agro/fdm-app": patch
---

The nitrogen balance and the organic matter balance (also in the fertilizer plan report) now use the most recent soil data per parameter up to the end of the selected period, in the same way as the application standards and the nutrient advice. Soil analyses sampled before the period now count; analyses sampled after the period still don't. Adds `currentSoilDataToSoilAnalyses` to convert current soil data into the `soilAnalyses` input of the balances.
