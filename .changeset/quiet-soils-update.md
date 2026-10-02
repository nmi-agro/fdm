---
"@nmi-agro/fdm-core": minor
---

`updateSoilAnalysis` can now also update the sampling date (`b_sampling_date`) and lower sampling depth (`a_depth_lower`) of the related soil sampling. Pass `null` for a nullable field, such as a BodemConditieScore indicator, to clear its value.
