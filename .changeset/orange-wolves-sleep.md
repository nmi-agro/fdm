---
"@nmi-agro/fdm-calculator": minor
---

Add new public API exports for uncached norm-filling calculations and nitrogen balance aggregation:

- **`createUncachedFunctionsForFertilizerApplicationFilling`:** Creates calculation functions that bypass the fdm database cache layer. Intended for evaluating proposed (not yet persisted) fertilizer plans where caching provides no benefit and direct calculation is preferred.
- **`calculateNitrogenBalancesFieldToFarm`:** Aggregates field-level nitrogen balances up to the farm level.
