---
"@nmi-agro/fdm-api": minor
---

Fertilizer applications have `p_app_origin` (`own_production`, `supplied` or `mixed`). It is returned on every fertilizer application and can be set when creating (default `own_production`) or updating (omitted keeps the stored origin) an application.
