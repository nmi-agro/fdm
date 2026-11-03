---
"@nmi-agro/fdm-core": minor
---

Store and use the sampling geometries of soil analyses, so that fields sampled per zone get consistent current soil data.

- `soil_sampling` gets the column `b_sampling_geometry_zone` (MultiPolygon, WGS84): the area the analysis represents, or `null` for the whole field. `addSoilAnalysis`, `updateSoilAnalysis`, `getSoilAnalysis`, `getSoilAnalyses` and `getSoilAnalysesForFarm` now write and return `b_sampling_geometry` and `b_sampling_geometry_zone`. A `Polygon` zone is stored as a `MultiPolygon`; an empty MultiPoint or zone is stored as `null`; other geometry types and non-WGS84 coordinates are rejected.
- **Breaking:** `CurrentSoilDataItem` no longer has `a_id`, `b_sampling_date`, `a_source`, `a_depth_upper` and `a_depth_lower`. It lists the contributing analyses in `sources` instead, with `is_aggregated`, `coverage` and `has_coverage_warning`.
- `getCurrentSoilData` and `getCurrentSoilDataForFarm` combine sampling zones per parameter. When the most recent analysis for a parameter has a zone, the zone analyses sampled within one calendar month of it are combined: numeric parameters by the area-weighted mean, `b_soiltype_agr` and `b_gwl_class` by the value with the largest area. A warning is set when the zones cover less than 95% of the field. Fields without zones give the same values as before.
- New function `getCurrentSoilDataPerZone` returns the current soil data per sampling zone.
- Fix reading `MultiPoint` geometries from the database, which returned wrong coordinates.
