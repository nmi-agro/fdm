---
"@nmi-agro/fdm-core": minor
---

Add `getSoilImage` and `getSoilImageAnnotation`, which return a single soil image or annotation (`undefined` when it does not exist) and check read access to the field. Add `isFarmGroupMembershipInYear` and `getFarmIdsOfFarmGroupInYear` for the farms of a group in a calendar year, `getEffectiveHarvestable` (only grassland can have multiple harvests) and `getFertilizerTypesByRvoCode` (the fertilizer type of existing fertilizers per RVO code).
