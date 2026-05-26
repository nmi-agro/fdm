---
"@nmi-agro/fdm-api": minor
---

Initial release

A new package that hosts the FDM REST API. The Hono-based API is created via `createFdmApi(fdm, auth, config)` and can be mounted in any host application. Includes API key authentication, RFC 7807 error responses, request guards, per-key rate limiting, an OpenAPI 3.1 specification, and interactive API documentation.
