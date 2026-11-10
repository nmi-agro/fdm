---
"@nmi-agro/fdm-api": minor
---

The logic of the REST endpoints now lives in a shared operations layer, published as `@nmi-agro/fdm-api/operations`, so other services can run the same operations with the same validation, permissions and errors. Every route in the OpenAPI document now has an `operationId`. The package also exports `createApiKeyAuth` (with options for the audit channel and a `WWW-Authenticate` challenge), `consumeRateLimit`, `classifyError` and `defaultServices`. REST behaviour is unchanged.
