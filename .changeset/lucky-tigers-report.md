---
"@nmi-agro/fdm-app": patch
---

Improve error handling robustness in `handleActionError` to correctly identify permission denied errors even when wrapped, preventing unnecessary 500 error pages
