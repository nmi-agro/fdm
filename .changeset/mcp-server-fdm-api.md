---
"@nmi-agro/fdm-api": minor
---

The logic of the JSON endpoints now lives in a shared operations layer, published as `@nmi-agro/fdm-api/operations`, so other services can run the same operations with the same validation, permissions and errors. File downloads and uploads, imports, invitations and fertilizer plans keep their logic in their route handlers. Every route in the OpenAPI document now has an `operationId`. The package also exports `createApiKeyAuth` (with options for the audit channel and a `WWW-Authenticate` challenge), `consumeRateLimit`, `classifyError`, `createErrorHandler`, `createNotFoundHandler` and `defaultServices`.

The write rate limit is raised from 30 to 120 requests per minute per API key, so that AI assistants and integrations can enter data in larger batches. New usage limits prevent misuse of the API: a farm can have at most 500 fields (adding more fields fails with 422, and farm-level lists and calculations of a larger farm fail with 422), and a user can create at most 10 farms per 24 hours across all their API keys (429 with `Retry-After`).

Fixes found by checking real data against the documented schemas: `PATCH /fields/{b_id}` now returns the centroid, area and perimeter of the field; `GET /farms/{b_id_farm}/derogations` returns `b_id_farm` with each derogation, without the undocumented `created` and `updated`; the measure catalogue documents `m_summary`, `m_source_url` and `m_conflicts` as nullable and `m_stage_applicability` as `field` or `farm`. A second harvest of a crop that is harvested once now gives 409 instead of 500, and a field balance with incomplete soil data gives 422 naming the missing parameters instead of 500.
