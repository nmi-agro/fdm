---
"@nmi-agro/fdm-api": minor
---

Add the optional query parameter `effective_nitrogen` to `GET /farms/{b_id_farm}/calculations/nitrogen-balance` and `GET /fields/{b_id}/calculations/nitrogen-balance`. With `effective_nitrogen=true`, the nitrogen balance is calculated with effective nitrogen and MINIP mineralization, and the `target` is omitted from the response because it only applies to the balance with total nitrogen. The default remains the balance with total nitrogen.
