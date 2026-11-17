---
"@nmi-agro/fdm-calculator": minor
---

Calculate farm-level results with fewer database queries. The nitrogen and organic matter balance of a farm, the farm nutrient advice (`startFarmNutrientAdviceRows`) and the farm indicators (`getFarmIndicators`) look up the cached results of all fields with one query instead of one per field. New functions: `collectInputForBln3ScoreForFarm` and `collectInputForBln3MeasureApplicabilityForFarm` collect the BLN3 inputs of all fields of a farm with farm-level queries and one permission check, and give the same inputs per field as their single-field versions; `getBln3Scores` returns the cached BLN3 scores of several fields at once.
