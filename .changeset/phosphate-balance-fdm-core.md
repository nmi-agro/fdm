---
"@nmi-agro/fdm-core": minor
---

Add `b_lu_p_harvestable` and `b_lu_p_residue` (phosphate content of the harvested product and of the crop residues, g P₂O₅ / kg DM) to the cultivation catalogue, with a migration. `addCultivationToCatalogue` accepts both values.

`syncCatalogues(fdm, { nmiApiKey })` passes the NMI API key to the cultivation catalogue, which then fills in the phosphate contents from the NMI API. Without a key, or when the NMI API cannot be reached, the catalogue is synchronised without them and the stored values are kept. With a key, a row that lacks phosphate contents is filled in on the next synchronisation even when its hash is unchanged. Because the catalogue items have new fields, every BRP row is updated once on the first synchronisation after the upgrade.
