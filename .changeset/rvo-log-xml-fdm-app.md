---
"@nmi-agro/fdm-app": patch
---

Add the `RVO_LOG_XML` environment variable (`none`, `request`, `response` or `both`; default `none`) to log the SOAP XML exchanged with RVO. The value is validated at startup. Logged XML can contain farm data, so only enable it temporarily for debugging.
