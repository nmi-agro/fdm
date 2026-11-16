---
"@nmi-agro/fdm-calculator": minor
---

Add the direct nitrous oxide (N₂O) emission to the nitrogen balance, following the Dutch National Emission Model for Agriculture (NEMA). The field and farm results have a new `emission.nitrous_oxide` with the emission from fertilizers, crop residues left on the field and organic soils (`veen` and `moerige_klei`), and the total, in kg N/ha (negative), plus `co2eq` in kg CO₂-eq/ha (positive, GWP 265). These values have three decimals in the field results and one decimal in the farm results. The indirect N₂O emission is not calculated.

Like the ammonia emission, the N₂O emission is subtracted in the balance, so the balance (surplus) of fields and farms becomes lower. The nitrate leaching is calculated from this lower surplus, so it becomes slightly lower too. The N₂O emission is also included in `emission.total`.

Also:

- A harvest analysis with a yield of `null` now falls back to the catalogue yield for the crop residues, as the residue removal already did. This can change the ammonia emission from crop residues for such harvests.
- `convertDecimalToNumberRecursive` accepts an optional number of decimals (default 0).
- `FertilizerDetail` accepts an optional `p_type_rvo`, used to recognise sewage sludge.
- The types `NitrogenEmissionNitrousOxideNumeric` and `NitrogenEmissionNitrousOxideFarmNumeric` are exported.
- The nitrogen in crop residues is calculated by one shared function for the removal, the ammonia emission and the N₂O emission, and the crop rotation group (grassland, cropland or bare soil) by one shared function for the nitrate leaching and the emissions. The results do not change.
- Field balances cached by an earlier build of the same version are no longer reused, because the shape of the result changed.
