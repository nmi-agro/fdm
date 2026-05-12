---
"@nmi-agro/fdm-core": minor
---

Add BLN3 measures tables and CRUD layer. New schema tables `measures_catalogue`, `measures`, and `measure_adopting` follow the action-asset model. Exports `addMeasure`, `getMeasure`, `getMeasures`, `getMeasuresForFarm`, `getMeasuresFromCatalogue`, `updateMeasure`, `removeMeasure`, `syncMeasuresCatalogueArray`, `enableMeasureCatalogue`, `disableMeasureCatalogue`, `isMeasureCatalogueEnabled`, `getEnabledMeasureCatalogues`, and the `Measure` / `MeasureCatalogue` types. `syncCatalogues` now accepts an optional `nmiApiKey` to populate the measures catalogue. All existing farms have the `bln` catalogue enabled by default via migration.
