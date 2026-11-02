---
"@nmi-agro/fdm-calculator": minor
"@nmi-agro/fdm-app": minor
---

Add organic-P mineralisation, deposition and leaching to the phosphate balance. Mineralisation is added to the supply with two tracks: on mineral soils from the soil organic matter degradation of the organic matter balance, on peat (`veen`) from peat oxidation by groundwater class (the organic matter degradation is not used there). Deposition adds 0.7 kg P₂O₅/ha/year. Leaching and runoff are estimated from the surplus only (fraction by the phosphorus saturation degree relative to the field threshold, times a groundwater factor), reported in `leaching` and, like nitrate leaching, not subtracted from the balance; the projection of P-AL and PSD does include it. Peat fields whose groundwater class changed get a warning that Fe-bound phosphate can be released on rewetting (not calculated). The phosphate pages show the leaching as a separate card and mineralisation and deposition in the breakdown. All parameters are drafts to be reviewed.

The phosphate balance chart now shows the terms as stacked bars like the nitrogen balance (deposition, mineralisation and fertilizers per type, with each application on field level, against harvests and crop residues), and the breakdown lists the fertilizer applications under their fertilizer type. `supply.fertilizers` now holds `{ total, applications }` per fertilizer type, and the farm result has the area-weighted `terms`.
