---
"@nmi-agro/fdm-core": minor
---

addFertilizerApplication and updateFertilizerApplication functions now expect an application value in the unit defined for the fertilizer, instead of kg/ha for every fertilizer. The unit is included in the return values of `getFertilizer`, `getFertilizers` etc. as `p_app_amount_unit`. `getFertilizerApplication`, `getFertilizerApplications` etc. now include `p_app_amount_display` and `p_app_amount_unit` which are to be shown to the user instead of p_app_amount and `kg/ha`.
