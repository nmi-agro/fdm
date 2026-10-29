---
"@nmi-agro/fdm-app": patch
---

Fixed the KvK lookup reporting the same result on every render. When creating a farm, "Wijzigen" after a lookup now returns to the KvK step instead of freezing the page, and on the farm settings page fields filled in from KvK can be edited again.
