---
"@nmi-agro/fdm-calculator": minor
---

Add the nitrous oxide (N₂O) emission to the nitrogen balance, following the Dutch National Emission Model for Agriculture (NEMA). The field and farm results have a new `emission.nitrous_oxide` with the direct emission from fertilizers, crop residues left on the field and organic soils (`veen` and `moerige_klei`), the indirect emission from ammonia volatilisation and nitrate leaching, and the total, in kg N/ha (negative, one decimal), plus `co2eq` in kg CO₂-eq/ha (positive, GWP 265). Like the nitrate leaching, the N₂O emission is included in `emission.total` but not in the balance, so the balance and the surplus do not change.

Also:

- A harvest analysis with a yield of `null` now falls back to the catalogue yield for the crop residues, as the residue removal already did. This can change the ammonia emission from crop residues for such harvests.
- `convertDecimalToNumberRecursive` accepts an optional number of decimals (default 0).
- `FertilizerDetail` accepts an optional `p_type_rvo`, used to recognise sewage sludge.
- The types `NitrogenEmissionNitrousOxideNumeric` and `NitrogenEmissionNitrousOxideFarmNumeric` are exported.
