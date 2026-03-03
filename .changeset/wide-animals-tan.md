---
"@nmi-agro/fdm-app": patch
---

Suppress logging `BodyStreamBuffer was aborted` to Sentry, as this is caused by users navigating to another page while the current page is still loading.
