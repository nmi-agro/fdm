---
"@nmi-agro/fdm-core": minor
---

Added `getEnabledCultivationCataloguesForFarms` and `getEnabledFertilizerCataloguesForFarms` to retrieve the enabled catalogues for multiple farms in one query. Added `getCultivationsFromCatalogues` and `getFertilizersFromCatalogues` to fetch catalogue items for a given list of catalogue source IDs. These composable building blocks replace the removed `getCultivationsFromCatalogueForFarms` and `getFertilizersFromCatalogueForFarms` functions.
