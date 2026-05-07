---
"@nmi-agro/fdm-data": minor
---

Add measures catalogue module for BLN3 integration. Exports `getMeasuresCatalogue(catalogueName, nmiApiKey)` as a dispatcher (mirroring `getFertilizersCatalogue`), with BLN3 implemented in `measures/catalogues/bln.ts`. Adding future catalogues (e.g. ANLb) only requires a new file and extending the `CatalogueMeasureName` union. Also exports `hashMeasure` and the `CatalogueMeasure`, `CatalogueMeasureItem`, `CatalogueMeasureName` types using pandex naming conventions (`m_id`, `m_source`, `m_name`, etc.).
