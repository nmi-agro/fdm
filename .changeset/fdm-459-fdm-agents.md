---
"@nmi-agro/fdm-agents": patch
---

Read the data of the fertilizer planner tools once for the whole farm instead of once per field. `getFarmFields` reads the cultivations and current soil data for the farm. `getFarmNutrientAdvice` and `simulateFarmPlan` read the fields, cultivations and soil data for the farm, and look up the nutrient advice of all fields with batched cache lookups, with at most four requests to the NMI API at the same time per tool call. `getFarmLegalNorms` and `simulateFarmPlan` collect the norm input for the farm and calculate the norms of all fields together; `simulateFarmPlan` also collects the norm filling input for the farm. A field outside the farm, or every field when the farm cannot be read, is still read on its own, so the tool output does not change.
