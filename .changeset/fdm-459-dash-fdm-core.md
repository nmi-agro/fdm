---
"@nmi-agro/fdm-core": minor
---

Add `listFarmGroupsOfOrganizations`, which lists the farm groups of several organizations with a fixed number of queries and gives the same groups per organization as `listFarmGroups`.

Add `listOrganizationRolesOfUser`, which returns the roles of a user in each of the user's organizations with one query, so the own role no longer needs a member list per organization. Only the user itself may read its roles.

Add `getDefaultDatesOfCultivations`, which returns the default start and end dates of several cultivations with a fixed number of queries and gives the same dates per cultivation as `getDefaultDatesOfCultivation`.
