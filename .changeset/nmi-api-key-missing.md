---
"@nmi-agro/fdm-app": patch
---

Treat a missing or empty `NMI_API_KEY` as not configured. Previously the application sent the text `undefined` as the API key, so NMI API requests failed with an authorization error instead of being skipped.
