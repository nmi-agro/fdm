---
"@nmi-agro/fdm-app": patch
---

Fix shapefile upload failing with EACCES permission denied in production.The Docker runner stage now creates the `uploads/shapefiles` directory with correct ownership before switching to the non-root user, so `@remix-run/file-storage` can write temporary upload files.
