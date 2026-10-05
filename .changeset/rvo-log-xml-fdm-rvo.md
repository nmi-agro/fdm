---
"@nmi-agro/fdm-rvo": minor
---

Upgrade `@nmi-agro/rvo-connector` to `^2.3.0` and add an optional `logXml` parameter to `createRvoClient` (`none`, `request`, `response` or `both`; default `none`) to log the SOAP XML exchanged with RVO. Logged XML can contain farm data, so only enable it temporarily for debugging.
