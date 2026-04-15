---
"@nmi-agro/fdm-app": patch
---

Fix the "Gewasresten achterlaten" input visibility to depend on crop rotation category (`b_lu_croprotation === 'cereal'`) and ensure its default value is `undefined` when hidden.
