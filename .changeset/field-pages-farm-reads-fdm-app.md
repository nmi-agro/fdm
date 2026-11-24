---
"@nmi-agro/fdm-app": patch
---

Open the fields table, the field dashboard and the cultivation page faster on farms with many fields. The harvests of a field are now read once for the farm instead of once per cultivation. The fields table checks the write permission once for the farm instead of once per field, reads the soil data and cultivations for the soil condition score (BCS) once for the farm instead of once per field, and runs its farm-level reads in parallel.
