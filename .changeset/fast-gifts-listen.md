---
"@nmi-agro/fdm-core": minor
---

The cultivation catalogue data model now supports the `b_lu_ya` field, which is the array of years the cultivation catalogue code is available in the RVO Basisregistratie Percelen. It is synchronized with the `b_lu_ya` data available in fdm-data, which currently encompasses 2009 through 2026. Just like in fdm-data, `b_lu_ya` being null means that it is available in all years the catalogue is available for. `getCultivationsFromCatalogue` now supports an extra `year` argument which will filter the result by the given availability year. `addCultivationToCatalogue` also supports adding this field.
