---
"@nmi-agro/fdm-core": minor
"@nmi-agro/fdm-data": minor
---

Add `b_lu_p_harvestable` and `b_lu_p_residue` (g P₂O₅ / kg DM) to the cultivation catalogue. When the catalogues are synchronised with an NMI API key, the BRP catalogue retrieves these phosphate contents from the NMI API cultivations lookup; without a key they are empty. `getCultivationCatalogue` accepts an optional `{ nmiApiKey }`, and `addCultivationToCatalogue` accepts `b_lu_p_harvestable` and `b_lu_p_residue`.
