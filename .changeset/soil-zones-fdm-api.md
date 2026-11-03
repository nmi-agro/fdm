---
"@nmi-agro/fdm-api": minor
---

Return and accept the sampling geometries of soil analyses (`b_sampling_geometry` and `b_sampling_geometry_zone`). **Breaking:** `GET /fields/{b_id}/current-soil-data` lists the contributing soil analyses per parameter in `sources`, with `is_aggregated`, `coverage` and `has_coverage_warning`, instead of a single `a_id`, `b_sampling_date`, `a_source`, `a_depth_upper` and `a_depth_lower` (each source now has its own depths). New endpoint `GET /fields/{b_id}/current-soil-data/zones` returns the current soil data per sampling zone. Sampling geometries that are empty, have a position outside WGS84, or have a sampling zone with an empty polygon or an unclosed ring or a ring of fewer than four positions are rejected with a 422.
