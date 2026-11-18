---
"@nmi-agro/fdm-app": patch
---

The farm pages for usage norms, indicators, measures, nutrient advice and balances load faster and put less load on the database, especially for farms with many fields: cached calculation results of all fields are looked up at once, and the BLN3 inputs are collected per farm instead of per field.

For fields with soil analyses for several zones, the BLN3 indicators and measures now use the same soil values as the soil page: the area-weighted mean of the zones.

The input overview on the indicator page of a field shows the cultivation history exactly as it is sent for the BLN3 score: the main cultivation per year up to and including the selected year.
