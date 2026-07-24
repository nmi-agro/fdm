---
"@nmi-agro/fdm-agents": minor
"@nmi-agro/fdm-app": minor
---

Gerrit is now Renure-aware. Added an `includeRenure` fertilizer plan strategy (RVO mestcodes 130-134) with a new "RENURE" prompt section explaining the 80 kg N/ha norm (on top of the 170 kg dierlijke-mest norm). `searchFertilizers` now exposes `p_type_rvo` and, together with `simulateFarmPlan`'s new compliance check, only filters/flags Renure products when `includeRenure` is false **and** the plan's calendar year is 2026 or later — Renure has no legal meaning before 2026, so the toggle never affects earlier years.
