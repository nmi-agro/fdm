---
"@nmi-agro/fdm-core": minor
"@nmi-agro/fdm-app": minor
---

`lookupPrincipal` now finds users only by their exact email address (case-insensitive) by default; organizations are still found by partial name or slug. Pass `{ includeUserNameSearch: true }` to keep the partial search on username, firstname, surname and name. `identifyPrincipal` is now exported and matches username, email and organization slug case-insensitively. On the access page, people are added with their full email address and organizations by name (including names with spaces); a matched user is shown with their name and the typed email address.

`createInvitation` and `grantRoleToFarm` now reject a target that resolves to a registered user unless it is an email address, so users can no longer be invited by username. Organizations are still invited by slug. The principal lookup returns a user's email address as the selectable value.
