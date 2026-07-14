---
"@nmi-agro/fdm-calculator": minor
---

Added a new `estimates` module exporting `getSoilParameterEstimates` (DB-cached via `withCalculationCache`, moved here from `@nmi-agro/fdm-app`'s internal `nmi.server.ts`), its uncached counterpart `requestSoilParameterEstimates`, and `collectInputForSoilParameterEstimates(fdm, principal_id, b_id, nmiApiKey)`, which resolves a persisted field's centroid via `getField`, mirroring `collectInputForBln3Score`.

This is a **breaking change**: `getSoilParameterEstimates` now takes `(fdm, { a_lat, a_lon, nmiApiKey })` instead of `(field, nmiApiKey)`.
