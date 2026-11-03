---
"@nmi-agro/fdm-calculator": minor
---

Add functions that the web app and the REST API now share: `enrichCurrentSoilDataWithNlv` (the nitrogen supplying capacity calculated from organic matter, clay and C/N when no analysis has it), `startFarmNutrientAdviceRows` and `getFarmNutrientAdviceRows` (advice, dose and remaining advice per field of a farm, with error codes per field), `findMainCultivation`, `getCultivationSuggestion`, `getNitrogenBalanceForFarms` and `getOrganicMatterBalanceForFarms` (combined and per farm), `computeMinimumScores`, `getFarmMeasureSummary`, `extractSoilAnalysesFromPdfs` and `parseSoilReaderField` (reading lab reports with the NMI SoilReader), `getSoilParameterEstimatesForGeometry` and `addSoilParameterEstimatesToField`, and `getYearTimeframe`.
