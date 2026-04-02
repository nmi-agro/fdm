---
"@nmi-agro/fdm-core": minor
---

Add farm-level batch query functions to avoid N+1 database round-trips when processing all fields of a farm at once.

New functions (all return a `Map` keyed by field or cultivation ID):

- `getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe?)` → `Map<b_id, Cultivation[]>`
- `getSoilAnalysesForFarm(fdm, principal_id, b_id_farm, timeframe?)` → `Map<b_id, SoilAnalysis[]>`
- `getFertilizerApplicationsForFarm(fdm, principal_id, b_id_farm, timeframe?)` → `Map<b_id, FertilizerApplication[]>`
- `getHarvestsForFarm(fdm, principal_id, b_id_farm, timeframe?)` → `Map<b_lu, Harvest[]>`
- `getCurrentSoilDataForFarm(fdm, principal_id, b_id_farm, timeframe?)` → `Map<b_id, CurrentSoilData>`

Each function performs a single farm-level permission check and retrieves all data for the farm in one query, grouping results in memory by field or cultivation ID.
