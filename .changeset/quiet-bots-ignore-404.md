---
"@nmi-agro/fdm-app": patch
---

Stop reporting React Router's internal 404 and 405 responses (unmatched routes and unsupported methods, typically from bots and scanners) to Sentry. These are now logged as a single debug line with status, method and path instead of a multi-line error with stack trace.
