---
"@nmi-agro/fdm-core": minor
---

Add farm groups: named, organization-scoped groupings of farms. New tables `farm_groups`, `farm_group_joining` (`b_group_joined`) and `farm_group_leaving` (`b_group_leaved`), a `farm_group` authorization resource and the functions `createFarmGroup`, `getFarmGroup`, `listFarmGroups`, `renameFarmGroup`, `removeFarmGroup`, `addFarmToGroup` and `removeFarmFromGroup`. The dates are the dates from which and until which a farm is part of a group, chosen by the user, not the moment of recording. Membership periods are derived from the joining and leaving events. `removeFarm` now also removes the farm from its groups.
