---
"@nmi-agro/fdm-core": minor
"@nmi-agro/fdm-data": minor
"@nmi-agro/fdm-calculator": minor
---

Add `b_lu_p_harvestable` and `b_lu_p_residue` (g P₂O₅ / kg DM) to the cultivation catalogue. When the catalogues are synchronised with an NMI API key, the BRP catalogue retrieves these phosphate contents from the NMI API cultivations lookup; without a key they are empty. `getCultivationCatalogue` accepts an optional `{ nmiApiKey }`, and `addCultivationToCatalogue` accepts `b_lu_p_harvestable` and `b_lu_p_residue`.

Add a first, experimental (`@alpha`) phosphate balance to `@nmi-agro/fdm-calculator`: `calculatePhosphateBalance` / `calculatePhosphateBalanceField` (supply by fertilizers, removal by harvests and crop residues, in kg P₂O₅/ha), `calculatePhosphateSaturation` (phosphorus saturation degree from `a_p_ox`, `a_fe_ox` and `a_al_ox`, falling back to `a_p_sg` or an estimate from P-AL), `calculatePhosphateStock` (effect of the balance on P-ox and the saturation degree of the sampled layer) and a draft table of soil-type parameters (`phosphateSoilTypeParameters`). Values and parameters are provisional.
