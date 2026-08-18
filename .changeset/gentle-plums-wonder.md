---
"@nmi-agro/fdm-agents": patch
---

Improve Gerrit's fertilizer planning so cultivations receive enough N, P and K according to the agronomic advice. The `simulateFarmPlan` tool now flags fields whose proposed nitrogen, phosphate or potassium dose falls meaningfully short of the nutrient advice via a new `agronomicWarnings` entry, and Gerrit's prompt instructs the agent to always check for and close such shortfalls — topping up with a suitable mineral or organic fertilizer where legal farm-level room remains for nitrogen/phosphate (or without restriction for potassium, which has no legal norm). This NPK-advice check is independent of the (opt-in) manure-space-filling strategy, which remains a separate, financially-driven strategy for maximizing (often negatively priced) manure use.
