---
"@nmi-agro/fdm-core": minor
---

Add farm groups: named, organization-scoped groupings of farms. New tables `farm_groups`, `farm_group_joining` and `farm_group_leaving`, a `farm_group` authorization resource and the functions `createFarmGroup`, `getFarmGroup`, `listFarmGroups`, `renameFarmGroup`, `removeFarmGroup`, `addFarmToGroup` and `removeFarmFromGroup`. Group membership is derived from joining and leaving events. `removeFarm` now also removes the farm from its groups.
