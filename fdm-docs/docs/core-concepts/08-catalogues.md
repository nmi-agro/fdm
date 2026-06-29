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

The `fdm-data` package includes the following catalogues, which are stored in the `cultivations_catalogue` and `fertilizers_catalogue` tables respectively:

- **`cultivationsCatalogue`**: A standardized list of crops, including their names, varieties, typical yields, nutrient content, and other agronomic properties. Each entry has a `b_lu_catalogue` as its primary key.
- **`fertilizersCatalogue`**: A standardized list of common fertilizers, including their nutrient content, density, and application methods. Each entry has a `p_id_catalogue` as its primary key.

## Farm-Specific Catalogue Selection

FDM provides a flexible system for managing which catalogues a farm uses. The `cultivationCatalogueSelecting` and `fertilizerCatalogueEnabling` tables allow each farm to specify which catalogue sources (`b_lu_source` and `p_source`) they want to use. This allows for customization and localization of the standardized data.
