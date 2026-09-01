---
"@nmi-agro/fdm-core": minor
"@nmi-agro/fdm-calculator": minor
"@nmi-agro/fdm-app": patch
---

Farm- and organization-level pages for nitrogen balance, gebruiksnormen and bemestingsadvies now render from cached per-field results immediately instead of blocking on a full recompute. Stale or missing per-field cache entries are recomputed in the background and deduplicated via the existing `calculation_cache.is_processing` lock (with an automatic 15-minute stuck-lock timeout), streamed through a new NDJSON `api.calculation-refresh` route. Once fresh results are ready, users see an explicit "Bijwerken" prompt instead of having the data silently swapped underneath them, and scoped spinners indicate exactly which farm/field is still recomputing. Field-level pages are unchanged and keep their existing blocking behavior.

`fdm-core`'s `calculation_cache` table gains an `updated_at` column and a nullable `result` column, plus new exported helpers (`getCachedCalculationEntry`, `getLatestCachedResultForEntity`, `tryAcquireCalculationLock`, `releaseCalculationLock`, `getCalculationCacheStatus`, `computeCacheKey`). `fdm-calculator`'s cached per-field calculators (nitrogen balance, NL 2025/2026 norm values, nutrient advice) now tag their cache entries with `entity_type`/`entity_id` so they can be looked up per field.
