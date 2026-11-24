---
"@nmi-agro/fdm-core": minor
---

Add reads that serve several farms, organizations or cultivations with a fixed number of queries. Each checks the permission of the principal itself.

- `getFieldsForFarms` reads the fields of several farms at once. It checks read access once per farm and returns a `Map` from farm ID to the farm's fields, with the same fields, timeframe filter and order (largest area first) as `getFields` returns per farm.
- `listFarmGroupsOfOrganizations` lists the farm groups of several organizations and gives the same groups per organization as `listFarmGroups`.
- `listOrganizationRolesOfUser` returns the roles of a user in each of the user's organizations with one query. Only the user itself may read its roles.
- `getDefaultDatesOfCultivations` returns the default start and end dates of several cultivations and gives the same dates per cultivation as `getDefaultDatesOfCultivation`.
