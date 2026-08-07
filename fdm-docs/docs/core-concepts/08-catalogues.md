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

The `fdm-data` package includes the following catalogues, which are stored in the `cultivations_catalogue`, `fertilizers_catalogue`, and `feeds_catalogue` tables:

- **`cultivationsCatalogue`**: A standardized list of crops, including their names, varieties, typical yields, nutrient content, and other agronomic properties. Each entry has a `b_lu_catalogue` as its primary key.
- **`fertilizersCatalogue`**: A standardized list of common fertilizers, including their nutrient content, density, and application methods. Each entry has a `p_id_catalogue` as its primary key.
- **`feedsCatalogue`**: The NMI feed catalogue. Each entry has an opaque `f_id_catalogue`, an `f_type_rvo` option code, and optional defaults for dry matter, nitrogen, and P2O5.

## Farm-Specific Catalogue Selection

FDM provides a flexible system for managing which catalogues a farm uses. The `cultivationCatalogueSelecting`, `fertilizerCatalogueEnabling`, and `feedCatalogueEnabling` tables allow each farm to specify which catalogue sources (`b_lu_source`, `p_source`, and `f_source`) they want to use. Farms can add custom feed entries with their farm ID as `f_source`.

## Feed catalogue

The bundled `nmi` feed source contains the 25 feed options formerly exposed as a core enum. `overig` is intentionally not included. Default values are sourced from [RVO Tabel 8 (January 2026)](https://www.rvo.nl/sites/default/files/2026-02/Tabel-8-Opbrengst-en-stikstof-en-fosfaat-in-diervoer-2026.pdf):

- `f_dm`: g DM / kg fresh product
- `f_n_dm`: g N / kg DM
- `f_p_dm`: g P2O5 / kg DM

`feed_batches.f_id_catalogue` references `feeds_catalogue.f_id_catalogue`; feed analysis values remain separate in `feed_analyses`.

## Animal categories catalogue

A livestock (animal) categories catalogue standardises commonly used animal categories, their species, allowed sex options and the livestock-unit conversion used by calculators. The catalogue is stored in the `animal_categories_catalogue` table and farms choose which sources to use with `animal_category_catalogue_selecting`.

Table: `animal_categories_catalogue`

- `l_id_category` (text, Primary Key): Catalogue identifier (opaque id).
- `l_category_source` (text): Source identifier for the catalogue entry (for example: an official dataset or third-party source; the Dutch RVO is a common source).
- `l_category` (text): Human-readable category label (e.g. “adult dairy cow”).
- `l_specie` (enum `l_specie`): Species code (e.g. `cattle`, `pig`, `poultry`).
- `l_sex_options` (array of `l_sex`): Allowed sexes for this category (e.g. `['female']`, `['male','female']`).
- `l_lsu` (numeric): Livestock units per animal (LSU) — a numeric conversion factor available to `fdm-calculator` and reporting.
- `hash`, `created`, `updated`: standard catalogue bookkeeping columns.

Farm selection: `animal_category_catalogue_selecting`

- Links `b_id_farm` to a chosen `l_category_source`. Use this to declare which catalogue sources a farm trusts and uses for conversions and UI lists. Primary key: (`b_id_farm`, `l_category_source`).

Note on naming: the catalogue table uses the plural name `animal_categories_catalogue` while the selecting table intentionally uses the singular `animal_category_catalogue_selecting`. This name mismatch is deliberate and is a documented breaking rename — integrations should reference the schema names above exactly.

The bundled `rvo` source uses RVO category definitions and documents the LSU
mapping alongside the source data in `fdm-data`; additional catalogue sources
must document their own conversion basis.
