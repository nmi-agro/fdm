---
"@nmi-agro/fdm-app": patch
---

Pre-bundle heavy transitive deps that workspace packages pull in, so they are processed once rather than on every cold dev start
