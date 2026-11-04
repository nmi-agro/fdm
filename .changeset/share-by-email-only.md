---
"@nmi-agro/fdm-core": minor
"@nmi-agro/fdm-app": minor
---

`lookupPrincipal` now finds users only by their exact email address (case-insensitive) by default; organizations are still found by partial name or slug. Pass `{ includeUserNameSearch: true }` to keep the partial search on username, firstname, surname and name. `identifyPrincipal` is now exported and matches username, email and organization slug case-insensitively. On the access page, people are added with their full email address and organizations by name (including names with spaces); a matched user is shown with their name and the typed email address.

`createInvitation` and `grantRoleToFarm` accept an optional `target_kind` (`"email"` or `"selected"`). With `"email"`, a target that resolves to a user is rejected unless it is an email address; organization slugs stay valid. `"selected"` allows a username picked from the lookup. The access forms send this value with the invitation, and the server defaults to `"email"` when it is missing.
