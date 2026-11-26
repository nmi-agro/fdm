---
"@nmi-agro/fdm-api": minor
---

The norm endpoints (`/farms/{b_id_farm}/calculations/norms` and `/fields/{b_id}/calculations/norms`) accept `year=2027`. The 2027 norms are provisional: a copy of the 2026 norms until the official 2027 tables are published. Each year now uses its own norm functions, instead of every year other than 2025 falling back to the 2026 functions.

**Breaking:** `year` is now required on both norm endpoints. A request without `year` returns `400` instead of the 2026 norms, so a client never silently gets the norms of another year than it meant.
