---
"@nmi-agro/fdm-app": patch
---

Adding or changing a measure that already runs on the field in an overlapping period now shows a clear warning instead of an unexpected error with an error code. When a measure is added to several fields at once, the fields that already have it are skipped and the message says how many fields got the measure and how many were skipped.
