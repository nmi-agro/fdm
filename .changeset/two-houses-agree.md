---
"@nmi-agro/fdm-app": patch
---

Fix persistent "Not a FlatGeobuf file" error caused by browser HTTP cache poisoning. Retries the FGB fetch with `nocache=true` to self-heal without user action.
