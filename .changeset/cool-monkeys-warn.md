---
"@nmi-agro/fdm-rvo": patch
---

Fix `exchangeToken` to return `tokenResponse.access_token` (was returning `unknown` via the wrong camelCase property)
