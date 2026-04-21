---
"@nmi-agro/fdm-core": patch
---

Fixed a performance issue where parallel calculator cache INSERT queries caused PostgreSQL lock contention, leading to nitrogen balance page timeouts (~90s requests). Cache writes (`setCachedCalculation`) and error logging (`setCalculationError`) in `withCalculationCache` are now fire-and-forget, eliminating the INSERT bottleneck while still persisting results asynchronously.
