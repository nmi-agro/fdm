---
"@nmi-agro/fdm-docs": patch
---

Restore the full API reference. After TypeDoc switched to `NodeNext` module resolution, the package entry points could not resolve their re-exports, so most functions and types were missing from the Reference section.
