---
"@nmi-agro/fdm-api": minor
---

Add read-only indicator endpoints: `GET /fields/{b_id}/indicators`, `GET /farms/{b_id_farm}/indicators` (area-weighted farm scores) and `GET /fields/{b_id}/measures/catalogue` (field measure options with applicability, predicted impacts and recommendations). These endpoints use a new `nmi` rate-limit bucket (10 requests per minute per key), counted instead of the `general` bucket. The API reference marks these operations with a "New" badge. When indicator results are unavailable, the endpoints return a generic 503; the underlying cause is logged server-side under the same `error_id` as the response.
