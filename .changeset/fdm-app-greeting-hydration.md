---
"@nmi-agro/fdm-app": patch
---

Fix a recurring React hydration error on the bedrijven overview page (`/farm`). The time-based greeting in the page title was computed while rendering, both on the server and again in the browser, so the two renders disagreed whenever their clocks or timezones did. The greeting is now resolved once in the loader and in a fixed timezone (`Europe/Amsterdam`), which also keeps it correct when the server runs in another timezone.
