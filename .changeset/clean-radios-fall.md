---
"@nmi-agro/fdm-docs": minor
---

Add REST API documentation section

Introduces `docs/rest-api/` in `fdm-docs` covering the contract baseline for the new FDM public REST API:

- **Overview** — target audience (first-party automation, trusted partners, public integrations), compatibility policy (no `/v1`, follows `fdm-core`), FDM-native field names, and the existing internal routes that remain unchanged.
- **Authentication** — user-owned API keys, `X-API-Key` and `Authorization: Bearer` header support, ambiguity rejection when both headers are present, key lifecycle (active/revoked/expired), rotation guidance, and leaked-key incident response.
- **Authorization** — effective access model (API key inherits owning user's FDM access), role-based permissions (`owner`/`advisor`/`researcher`), organization-membership access path, membership-removal behaviour, and `audit_channel` tagging.
- **Limits & Pagination** — 5 MB JSON body limit, 10,000-coordinate GeoJSON limit, per-key rate limits (120 general / 30 write / 10 calculation requests per minute), and offset-based pagination with defaults (limit 50, max 200).
- **Errors** — RFC 7807 Problem Details format, full error catalog (400–500), and examples for validation, not-found, and internal-error responses.
- **Endpoints** — endpoint tables with `fdm-core` mappings and example requests/responses for farms, fields, cultivations, soil analyses, and calculation endpoints.
- **Delete Semantics** — hard-delete behavior and exact cascade chains for `removeFarm`, `removeField`, `removeCultivation`, and `removeSoilAnalysis`, sourced directly from `fdm-core` implementation.

