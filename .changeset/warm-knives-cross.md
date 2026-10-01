---
"@nmi-agro/fdm-core": minor
---

Upgrade better-auth to 1.7 and switch Microsoft sign-in from the generic OAuth plugin to the built-in Microsoft provider, keeping certificate based authentication and tenant support. Microsoft accounts are now identified by the `oid` claim, and a migration backfills the `account_id` of existing Microsoft accounts from their stored id_token.
