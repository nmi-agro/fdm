---
"@nmi-agro/fdm-mcp": patch
---

The `get_fertilization_norms` tool accepts `year` 2027 (provisional norms, with the 2026 rules). Without `year` it uses the current calendar year instead of always 2026. The tool description and the server instructions now tell the model to pass the year the user asks about, to ask when the year is unclear, and to say which year the norms are for.
