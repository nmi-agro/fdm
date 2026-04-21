---
"@nmi-agro/fdm-calculator": patch
---

Move GeoTIFF deposition fetch outside DB transaction in nitrogen balance data collection, freeing the database connection during HTTP/raster operations and reducing connection pool pressure under concurrent load
