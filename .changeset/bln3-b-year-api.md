---
"@nmi-agro/fdm-api": patch
---

Fields without a main cultivation in the requested year get no indicator scores and no measure options. `GET /fields/{b_id}/indicators` and `GET /fields/{b_id}/measures/catalogue` return them with `is_excluded: true`, and both responses have a new `exclusion_reason` (`bufferstrip`, `nature`, `no_main_cultivation` or `null`).
