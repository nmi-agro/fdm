---
title: Cultivations
---

A `Cultivation` represents the lifecycle of a crop on a `Field`. It is a central concept in the Farm Data Model (FDM) that allows you to track the entire process of growing a crop, from planting to harvest.

## The Cultivation Lifecycle

A `Cultivation` is defined by a sequence of actions that are stored in separate tables:

1. **`cultivationStarting`**: This action marks the beginning of a cultivation. It links a `cultivation` to a `field` and records the following information:
   - `b_lu_start`: The date when the crop was planted.
   - `b_sowing_amount`: The amount of seed that was used.
   - `b_sowing_method`: The method used for sowing.
2. **`cultivationHarvesting`**: This action represents the gathering of the crop. It links a `cultivation` to a `harvestable` and records the `b_lu_harvest_date`. A single cultivation can have multiple harvesting events.
3. **`cultivationEnding`**: This action marks the end of a cultivation. It records the `b_lu_end` date and whether the crop residue was left on the field (`m_cropresidue`).

This sequence of actions defines a single cultivation period. A `Field` can have multiple cultivations over time, be fallow or have multiple cultivations on the same time.

## Linking to Catalogues

Each `Cultivation` is linked to the `cultivationsCatalogue` via the `b_lu_catalogue` foreign key. This catalogue is a standardized list of crops that ensures data consistency and comparability across different farms and applications.

The `cultivationsCatalogue` provides a wealth of information about each crop, including:

- `b_lu_name`: The name of the crop.
- `b_lu_variety_options`: A list of possible varieties for the crop.
- `b_lu_harvestable`: Indicates whether the crop is harvested `none`, `once`, or `multiple` times.
- `b_lu_yield`: The typical yield of the crop.
- `b_lu_n_harvestable` and `b_lu_n_residue`: The nitrogen content of the harvestable part of the crop and the residue, respectively.

A farm can select which cultivation catalogues it wants to use by creating an entry in the `cultivationCatalogueSelecting` table.
