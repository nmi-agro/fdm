---
"@nmi-agro/fdm-calculator": minor
---

Add an experimental (`@alpha`) phosphate balance, structured like the nitrogen and organic matter balances. All values are in kg P₂O₅ / ha and the parameters are provisional.

- `calculatePhosphateBalance`, `calculatePhosphateBalanceForFarms`, `calculatePhosphateBalanceField`, `calculatePhosphateBalancesFieldToFarm` and the cached `getPhosphateBalanceField`. The farm balance is the area-weighted average of its fields; the cache of all fields is read at once. A failing field is reported in `fields[].errorMessage` instead of failing the farm. Buffer strips, nature and landscape elements are not calculated: their result has `exclusion` (see `getPhosphateFieldExclusion`).
- `getPhosphateBalanceForFarms` returns the balance of several farms together and per farm, like `getNitrogenBalanceForFarms`.
- `collectInputForPhosphateBalance` and `collectInputForPhosphateBalanceForFarms` collect the selected year and up to four earlier years (`historyYears`). With the option `nmiApiKey`, they add the NMI soil estimates of each field: the BRP crop history, and for fields without measured oxalate data the estimated P-ox, Fe-ox, Al-ox, P-CaCl₂ and PSD. The requests run with a concurrency limit.
- Supply: fertilizers (`p_p_rt` at full value, no working coefficients), mineralisation of soil organic matter (on mineral soils from the organic matter degradation, on peat from peat oxidation by groundwater class) and deposition. Removal: harvests and removed crop residues, with the catalogue values when a harvest has no phosphate content. Leaching is estimated from a surplus only and is not part of the balance.
- The long-term average balance (`long_term`) covers the crop rotation of the last five years with registered fertilisation or harvests, and drives the projection of P-AL and the phosphorus saturation degree (PSD) against a field-specific environmental threshold.
- `assessPhosphateStatus` (also in `@nmi-agro/fdm-calculator/browser`) judges a field against its target zone (P-AL at least 35, PSD at most the threshold): the aim (opbouwen, onderhouden or afbouwen), the direction, a verdict (`good`, `attention`, `adjust` or `unknown`), the years as a range and the long-term balance needed. The rules are in `PHOSPHATE_STATUS_RULES`.
- A field counts as grassland, with a sampling depth of 0–10 cm, only when its main cultivation of the year is grass.
