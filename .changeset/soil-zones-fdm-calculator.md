---
"@nmi-agro/fdm-calculator": minor
---

Support the new shape of the current soil data, which lists the contributing soil analyses per parameter in `sources`. `MineralizationSoilItem` now takes `sources` instead of `a_source` and `b_sampling_date`; the mineralization input reports the newest source. The nutrient advice keeps Nmin per layer: for each layer (to 30 cm and to 60 cm) it takes the area-weighted mean of the sources sampled to that depth, so zones sampled at different depths are not mixed. Norms use the field value, which for fields sampled per zone is the area-weighted mean of the phosphate values.
