---
"@nmi-agro/fdm-calculator": minor
---

Add BCS (BodemConditieScore) calculation functions.

- `calculateBcs(scores)` — computes D_BCS (weighted total) and I_BCS (normalized 0–1 indicator) using exact Decimal.js arithmetic. Supports all 9 visual indicators plus optional lab-derived `bcs_om` and `bcs_ph` scores
- `getBcsScoreColor(i_bcs)` — maps an I_BCS value to a `"red"` / `"orange"` / `"green"` band
- `BCS_INDICATORS` — metadata array (key, name, description, weight, direction) for all 9 indicators, useful for rendering score forms and result tables
- Full unit test coverage included
