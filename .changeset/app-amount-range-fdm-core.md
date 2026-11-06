---
"@nmi-agro/fdm-core": patch
---

`addFertilizerApplication` and `updateFertilizerApplication` now reject an applied amount that, converted to kg/ha, is not greater than 0 or is greater than 100,000 kg/ha. The thrown error has an `AppAmountOutOfRangeError` as its `cause`, which carries the unit of the fertilizer and the maximum in that unit. Existing records outside this range can still be read, and `updateFertilizerApplication` without a new amount keeps the stored amount. Adds `P_APP_AMOUNT_MAX`, `isAppAmountInRange`, `getAppAmountDisplayRange` and `AppAmountOutOfRangeError`.
