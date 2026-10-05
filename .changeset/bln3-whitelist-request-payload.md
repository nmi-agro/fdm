---
"@nmi-agro/fdm-calculator": patch
---

Send only the documented request parameters to the NMI BLN3 endpoints (`score/field`, `measure/applicability` and `measure/advice`). Internal fields such as `b_bufferstrip`, `b_lu_croprotation`, `b_lu_catalogue` and `isExcluded` are still used for the exclusion check but are no longer part of the request body, which fixes HTTP 400 responses caused by FDM crop rotation values (e.g. `maize`).
