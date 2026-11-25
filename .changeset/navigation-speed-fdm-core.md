---
"@nmi-agro/fdm-core": patch
---

`getFarms` reads the roles of the principal on all listed farms in one query instead of one query per farm, so listing farms no longer slows down as a user gets access to more farms. The internal `getRolesOfPrincipalForResources` returns the roles per resource for several resources at once; `getRolesOfPrincipalForResource` now uses it.
