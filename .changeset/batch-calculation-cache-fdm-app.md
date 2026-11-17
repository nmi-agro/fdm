---
"@nmi-agro/fdm-app": patch
---

The farm pages for usage norms, indicators, measures, nutrient advice and balances load faster and put less load on the database, especially for farms with many fields: cached calculation results of all fields are looked up at once, and the BLN3 inputs are collected per farm instead of per field.
