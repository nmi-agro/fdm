---
"@nmi-agro/fdm-app": patch
"@nmi-agro/fdm-calculator": patch
---

Fix nitrogen balance timeout for large farms

- Increase SSR stream timeout from 90s to 150s to prevent React stream aborts for farms with many fields
- Move GeoTIFF deposition fetch outside DB transaction in nitrogen balance data collection, freeing the database connection during HTTP/raster operations and reducing connection pool pressure under concurrent load
