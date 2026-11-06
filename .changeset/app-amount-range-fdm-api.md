---
"@nmi-agro/fdm-api": patch
---

Creating or updating a fertilizer application now requires `p_app_amount_display` to be greater than 0 (400 otherwise) and returns a 422 problem response when the amount, converted to kg/ha, is greater than 100,000 kg/ha. The `detail` names the maximum in the unit of the fertilizer. `PATCH /fertilizer-applications/{p_app_id}` without a new amount and without a new fertilizer keeps the stored amount.
