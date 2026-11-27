---
title: Catalogues
---

The `fdm-data` package is a key component of the Farm Data Model (FDM) that provides pre-defined, standardized data sets for a variety of agricultural concepts. These data sets are known as **catalogues**.

## Purpose of Catalogues

The primary purpose of the catalogues is to ensure data consistency and reduce the need for manual data entry. By providing standardized lists of common agricultural inputs and products, the catalogues help to:

- **Standardize Data:** Ensure that the same terminology is used for the same concepts across different farms and applications.
- **Improve Data Quality:** Reduce the risk of errors and inconsistencies that can arise from manual data entry.
- **Simplify Data Entry:** Make it easier and faster to enter data by providing pre-populated lists of options.

## Available Catalogues

The `fdm-data` package includes the following catalogues, which are stored in the `cultivations_catalogue`, `fertilizers_catalogue`, `feeds_catalogue` and `animal_categories_catalogue` tables:

- **`cultivationsCatalogue`**: A standardized list of crops, including their names, varieties, typical yields, nutrient content, and other agronomic properties. Each entry has a `b_lu_catalogue` as its primary key.
- **`fertilizersCatalogue`**: A standardized list of common fertilizers, including their nutrient content, density, and application methods. Each entry has a `p_id_catalogue` as its primary key.
- **`feedsCatalogue`**: A standardized list of feeds, with default dry matter, nitrogen and phosphate contents (the `nmi` source follows RVO Tabel 8). Each entry has an `f_id_catalogue` as its primary key.
- **`animalCategoriesCatalogue`**: A standardized list of animal categories, with their species, allowed sexes and livestock units per animal (the `rvo` source follows the RVO categories). Each entry has an `l_id_category` as its primary key. Which categories an animal can move to is not stored in this table. Every animal-category catalogue in `@nmi-agro/fdm-data` provides its own moves next to its list of categories (`getAnimalCategoryTransitionsCatalogue`): per category, the next life stages of the same species and the sexes that can reach them. `getAnimalCategoryTransitions` combines the moves of all catalogues, and fdm-core checks every move of an animal to a herd of another category against it.

## Farm-Specific Catalogue Selection

FDM provides a flexible system for managing which catalogues a farm uses. The `cultivationCatalogueSelecting`, `fertilizerCatalogueEnabling`, `feedCatalogueEnabling` and `animalCategoryCatalogueSelecting` tables allow each farm to specify which catalogue sources (`b_lu_source`, `p_source`, `f_source` and `l_category_source`) they want to use. Farms can add custom feed entries with their farm ID as `f_source`.
