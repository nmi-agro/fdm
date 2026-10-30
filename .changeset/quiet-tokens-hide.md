---
"@nmi-agro/fdm-app": patch
---

Stop sending invitation tokens and other long opaque identifiers in page paths to analytics and error tracking. They are now replaced by `:token`, and organization slugs by `:slug`.
