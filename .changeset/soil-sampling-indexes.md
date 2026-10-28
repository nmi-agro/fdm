---
"@nmi-agro/fdm-core": minor
---

Add database indexes to speed up reading fields and soil analyses. `field_acquiring` gets an index on `b_id_farm`; `soil_sampling` gets an index on `b_id` with `b_sampling_date` (descending, nulls last) and an index on `a_id`. Before, `getFields` scanned the whole `field_acquiring` table, and `getSoilAnalyses`, `getCurrentSoilData`, `getSoilAnalysis` and their farm-level variants scanned the whole `soil_sampling` table on every call. The migration only creates indexes and does not change any data.
