---
"@nmi-agro/fdm-app": patch
---

Downloading or viewing the PDF of a soil analysis or fertilizer plan no longer fails with a server error when the connection to file storage drops briefly. The download is retried once, and if it still fails a regular error page is shown instead of a broken download.
