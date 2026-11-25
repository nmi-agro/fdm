---
"@nmi-agro/fdm-data": minor
---

Add `b_lu_p_harvestable` and `b_lu_p_residue` (g P₂O₅ / kg DM) to the cultivation catalogue items. `getCultivationCatalogue("brp", { nmiApiKey })` retrieves these phosphate contents from the NMI API cultivations lookup; without a key they are `null`. Blank values from the NMI API are read as `null`, not as 0, and BRP codes and numeric strings are accepted. The hashes of the catalogue items change because of the new fields.
