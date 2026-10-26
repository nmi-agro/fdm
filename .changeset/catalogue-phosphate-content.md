---
"@nmi-agro/fdm-core": minor
"@nmi-agro/fdm-data": minor
"@nmi-agro/fdm-app": minor
---

Add `b_lu_p_harvestable` and `b_lu_p_residue` (g P₂O₅ / kg DM) to the cultivation catalogue. When the catalogues are synchronised with an NMI API key, the BRP catalogue retrieves these phosphate contents from the NMI API cultivations lookup; without a key they are empty. `getCultivationCatalogue` accepts an optional `{ nmiApiKey }`.

The phosphate content of the harvested product (`b_lu_p_harvestable`) is now a harvest parameter for the harvest categories HC010, HC040, HC041 and HC042: `getParametersForHarvestCat` includes it and `getDefaultsForHarvestParameters` takes its default from the cultivation catalogue. `addCultivationToCatalogue` accepts `b_lu_p_harvestable` and `b_lu_p_residue`.

In the app, the harvest forms show the phosphate content (g P₂O₅ / kg DS), pre-filled with the catalogue default and editable, so a value from the farmer's own crop analysis can be entered. Harvests recorded before this change are pre-filled with the catalogue default when they are edited.
