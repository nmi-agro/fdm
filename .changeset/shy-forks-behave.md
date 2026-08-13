---
"@nmi-agro/fdm-agents": patch
---

Improve the quality of Gerrit's generated Dutch text: the plan summary no longer leaks internal identifiers (like the farm ID), field summaries no longer needlessly open with the cultivation/crop type name, and the prompt now guards against stray non-Latin script characters appearing in the output. `buildFertilizerPlanPrompt` and `generateFarmFertilizerPlan` also accept an optional `b_name_farm` so the prompt can reference the farm by name instead of by its internal ID
