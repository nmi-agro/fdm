---
"@nmi-agro/fdm-app": patch
---

Stop sending invitation tokens and other secrets in URLs to analytics and error tracking. Page paths on error events now show `:token` instead of long opaque identifiers and `:slug` instead of organization slugs. Page views, autocapture, session recordings, error reports, breadcrumbs and traces mask long opaque tokens in URLs and the values of the `code`, `token` and `secret` query parameters.
