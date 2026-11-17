---
"@nmi-agro/fdm-core": minor
---

Add a batch API to the calculation cache. A function wrapped with `withCalculationCache` now has a `many(fdm, inputs, { concurrency })` method: it reads the cache for all inputs with one query, calculates only the misses (identical inputs once, optionally with a limit on the number running at the same time), and writes the new results and the errors with one insert each. It returns one promise per input, so a cached result is available without waiting for the misses. New exports: `getCachedCalculations`, `setCachedCalculations` and the types `CachedCalculation`, `CachedCalculationManyOptions` and `CachedCalculationRow`. Empty results such as `null` are no longer written to the cache, since they were never read as a hit.
