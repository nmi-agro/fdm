---
"@nmi-agro/fdm-app": patch
---

Pages are no longer served from a cache for minutes after a deploy, which could leave the sign-in page without its sign-in options. The browser now checks every page with the server on each visit, pages behind sign-in (including farm pages) are no longer stored in shared caches, and the manual is cached only by the browser, for at most an hour instead of up to a day.
