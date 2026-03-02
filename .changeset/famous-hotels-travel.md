---
"@nmi-agro/fdm-app": patch
---

Fix systemic double-click bug in actions by ensuring buttons and forms remain disabled during both the "submitting" and "loading" (revalidation) phases by checking for `state !== "idle"`.
