---
"@nmi-agro/fdm-core": patch
---

`syncFertilizerCatalogueArray` (and therefore `syncCatalogues`, run on app startup) now automatically acquires a newly introduced fertilizer catalogue product for every existing farm that already has that catalogue source enabled, mirroring the bulk-acquisition that happens when a new farm is created. Previously, only farms created after a product was added to the catalogue would ever see it; existing farms had no automatic or manual way to pick up new catalogue products (e.g. the new Renure BAAT products). This only applies to genuinely new catalogue items (first-time insert); updates to existing catalogue items are unaffected.
