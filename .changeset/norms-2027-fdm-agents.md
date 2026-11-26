---
"@nmi-agro/fdm-agents": patch
---

The fertilizer planner tools support calendar year 2027 and fail with a clear error for a year without legal application norms, instead of passing an unchecked year to the calculator. The 2027 norms are provisional: a copy of the 2026 norms until the official 2027 tables are published.
