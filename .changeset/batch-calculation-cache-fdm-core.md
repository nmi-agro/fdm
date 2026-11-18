---
"@nmi-agro/fdm-core": minor
---

Add a batch API to the calculation cache. A function wrapped with `withCalculationCache` now has a `many(fdm, inputs, options)` method. It reads the cache for all inputs with one query and calculates only the misses, identical inputs once. The option `concurrency` limits how many misses run at the same time, and `limit` runs each miss through a limiter that other work can share. New results and errors are written in batches: results that are ready within a second of each other share one insert, so a slow calculation does not hold back the others. `many` returns one promise per input, so a cached result is available without waiting for the misses. An input that cannot be hashed rejects only its own promise; an invalid `concurrency` rejects all of them. The result is copied before it waits to be written, so later changes by the caller do not reach the cache.

An error that cannot be turned into text no longer breaks the error logging; it is recorded as "Unknown error".

New exports: `getCachedCalculations`, `setCachedCalculations` and the types `CachedCalculation`, `CachedCalculationManyOptions` and `CachedCalculationRow`. Empty results (`null` or `undefined`) are no longer written to the cache. Other falsy results, such as `0` or `false`, are now read as a hit instead of being calculated again.
