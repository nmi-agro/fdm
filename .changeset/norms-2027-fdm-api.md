---
"@nmi-agro/fdm-api": minor
---

The norm endpoints (`/farms/{b_id_farm}/calculations/norms` and `/fields/{b_id}/calculations/norms`) accept `year=2027`. The 2027 norms are provisional: a copy of the 2026 norms until the official 2027 tables are published. Each year now uses its own norm functions, instead of every year other than 2025 falling back to the 2026 functions.

Without `year`, the endpoints now use the current calendar year instead of always 2026. When the current year has no norms yet, they answer `400` with a message listing the supported years.
