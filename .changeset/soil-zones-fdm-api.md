---
"@nmi-agro/fdm-api": minor
---

Return and accept the sampling geometries of soil analyses (`b_sampling_geometry` and `b_sampling_geometry_zone`). **Breaking:** `GET /fields/{b_id}/current-soil-data` lists the contributing soil analyses per parameter in `sources`, with `is_aggregated`, `coverage` and `has_coverage_warning`, instead of a single `a_id`, `b_sampling_date` and `a_source`. New endpoint `GET /fields/{b_id}/current-soil-data/zones` returns the current soil data per sampling zone.
