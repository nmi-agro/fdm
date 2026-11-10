---
"@nmi-agro/fdm-core": minor
---

Record the origin of a fertilizer application.

- `fertilizer_applying` gets the column `p_app_origin` (enum `own_production`, `supplied` or `mixed`, not null, default `own_production`). Existing applications become `own_production`.
- `addFertilizerApplication` takes an optional `p_app_origin` (default `own_production`). `updateFertilizerApplication` takes an optional `p_app_origin`; leaving it out keeps the stored origin.
- `getFertilizerApplication`, `getFertilizerApplications` and `getFertilizerApplicationsForFarm` return `p_app_origin`.
- New exports `applicationOriginOptions` and the type `ApplicationOrigin`.
