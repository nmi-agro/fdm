---
"@nmi-agro/fdm-mcp": patch
---

The `get_fertilization_norms` tool accepts `year` 2027 (provisional norms, a copy of 2026). Without `year` it uses the current calendar year instead of always 2026.
