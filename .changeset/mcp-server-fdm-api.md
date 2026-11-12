---
"@nmi-agro/fdm-api": minor
---

The logic of the JSON endpoints now lives in a shared operations layer, published as `@nmi-agro/fdm-api/operations`, so other services can run the same operations with the same validation, permissions and errors. File downloads and uploads, imports, invitations and fertilizer plans keep their logic in their route handlers. Every route in the OpenAPI document now has an `operationId`. The package also exports `createApiKeyAuth` (with options for the audit channel and a `WWW-Authenticate` challenge), `consumeRateLimit`, `classifyError`, `createErrorHandler`, `createNotFoundHandler` and `defaultServices`.

The write rate limit is raised from 30 to 120 requests per minute per API key, so that AI assistants and integrations can enter data in larger batches. New usage limits prevent misuse of the API: a farm can have at most 500 fields (adding more fields fails with 422, and farm-level lists, calculations and field imports of a larger farm fail with 422), and a user can create at most 10 farms per 24 hours across all their API keys (429 with `Retry-After`).

Coded fields now list every code with the Dutch name the web app shows, so clients and AI assistants can map a user's words to the right code: the application method (`p_app_method`), the acquiring method of a field (`b_acquiring_method`), the source of a soil analysis (`a_source`), the soil type (`b_soiltype_agr`) and the groundwater class (`b_gwl_class`). Requests accept only these codes and answer an unknown code with 400 and the allowed values, instead of failing with 500. A client cannot choose the system-only source `nl-other-nmi`.
