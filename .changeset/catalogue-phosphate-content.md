---
"@nmi-agro/fdm-core": minor
"@nmi-agro/fdm-data": minor
"@nmi-agro/fdm-calculator": minor
---

Add `b_lu_p_harvestable` and `b_lu_p_residue` (g P₂O₅ / kg DM) to the cultivation catalogue. When the catalogues are synchronised with an NMI API key, the BRP catalogue retrieves these phosphate contents from the NMI API cultivations lookup; without a key they are empty, and a later synchronisation without a key keeps the stored values. With a key, rows that lack phosphate contents are filled in on the next synchronisation even when their hash is unchanged. The app logs at startup how many BRP crops have a phosphate content and warns when `NMI_API_KEY` is missing. `getCultivationCatalogue` accepts an optional `{ nmiApiKey }`, and `addCultivationToCatalogue` accepts `b_lu_p_harvestable` and `b_lu_p_residue`.

Add a first, experimental (`@alpha`) phosphate balance to `@nmi-agro/fdm-calculator`: `calculatePhosphateBalance` / `calculatePhosphateBalanceField` (supply by fertilizers, removal by harvests and crop residues, in kg P₂O₅/ha), the Opbouwen / Onderhouden / Afbouwen frame from P-AL, `calculatePhosphateSaturation` (phosphorus saturation degree from `a_p_ox`, `a_fe_ox` and `a_al_ox` with alpha_max 0.5, falling back to `a_p_sg` or an indicative estimate from P-AL), `calculatePhosphateSaturationThreshold` (field-specific threshold from P-CaCl₂ and the groundwater class) and `calculatePhosphateProjection` (P-AL and saturation trajectory including fixation, with years as classes). Values and parameters are provisional.
