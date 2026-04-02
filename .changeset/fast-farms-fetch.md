---
"@nmi-agro/fdm-calculator": minor
---

Replace per-field query loops with farm-level batch queries in all input collectors for balances and norms, eliminating N+1 database round-trips for large farms.
