---
"@nmi-agro/fdm-api": minor
---

The logic of the REST endpoints now lives in a shared operations layer, published as `@nmi-agro/fdm-api/operations`, so other services can run the same operations with the same validation, permissions and errors. Every route in the OpenAPI document now has an `operationId`. The package also exports `createApiKeyAuth` (with options for the audit channel and a `WWW-Authenticate` challenge), `consumeRateLimit`, `classifyError` and `defaultServices`.

New usage limits prevent misuse of the API: a farm can have at most 500 fields (adding more fields fails with 422, and farm-level lists and calculations of a larger farm fail with 422), and a user can create at most 10 farms per 24 hours across all their API keys (429 with `Retry-After`).
