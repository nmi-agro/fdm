---
"@nmi-agro/fdm-core": patch
---

Optimized `checkPermission` in `fdm-core` by making the audit log insertion non-blocking, significantly improving performance for data-intensive calculations like the farm-level nitrogen balance
