---
"@nmi-agro/fdm-calculator": minor
---

Add BCS (BodemConditieScore) calculation functions.

- `calculateBcs(scores, labContext?)` — computes D_BCS (weighted total) and I_BCS (normalized 0–1 indicator) using exact Decimal.js arithmetic. Supports all 9 visual field indicators; when the optional `labContext` is provided, also derives and includes lab-based `a_ph_bcs` and `a_som_bcs` scores
- `getBcsScoreColor(d_bcs)` — maps a D_BCS value to a colour band: `"red"` (< 10), `"orange"` (< 20), `"yellow"` (< 30), `"green"` (< 40), or `"emerald"` (≥ 40)
- `getBcsScoreLabel(d_bcs)` — returns a Dutch label for a D_BCS value (Slecht / Onvoldoende / Matig / Goed / Zeer goed)
- `derivePhBcs(d_ph_delta)` — derives a BCS pH score (0–2) from D_PH_DELTA using the OBIC logistic function
- `deriveOmBcs(a_som_loi, crop_category, soiltype_n)` — derives a BCS organic matter score (0–2) from an a_som_loi lab measurement using OBIC crop × soil type quantile thresholds
- `BCS_INDICATORS` — expanded to 11 entries (9 field + 2 lab-derived) with `source: "field" | "lab"` property, in paper-form order
- `calcPhDelta(params)` — ports the OBIC `calc_ph_delta` function using embedded Handboek Bodem en Bemesting lookup tables (5.1, 5.2, 5.3, mh, mh_kl). Accepts soil type, clay%, OM%, crop plan fractions, and measured pH-CaCl₂. Returns D_PH_DELTA = max(0, pH_optimum − pH_measured)
- `SoiltypeAgr` and `CalcPhDeltaParams` — exported types for calcPhDelta
