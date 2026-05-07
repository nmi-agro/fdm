---
"@nmi-agro/fdm-app": minor
---

Add REST API infrastructure

The foundation for the public REST API is now in place. API requests are authenticated using personal API keys, and every call is rate-limited per key to keep usage fair. Errors are returned in a consistent, machine-readable format. An interactive API reference is available at `/api/docs`, and the full API specification can be found at `/api/openapi.json`.
