---
"@nmi-agro/fdm-agents": minor
---

The fertilizer planner tools of Gerrit can plan years for which no norms are published yet: they use the newest norms provisionally, and `getFarmLegalNorms` returns the `normsYear` that was used and whether it is `provisional`.
