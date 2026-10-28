---
"@nmi-agro/fdm-app": patch
---

Initialize PostHog before hydration, using the stored cookie consent for persistence, so events at the start of a page load are no longer dropped for lacking a `distinct_id`.
