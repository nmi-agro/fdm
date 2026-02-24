---
title: Database Schema
---

This document provides a comprehensive overview of the Farm Data Model (FDM) database schema. It details each schema and table, their properties, and columns, explaining their purpose and how they relate to the overall data structure.

FDM uses a relational database to store its data. The schema is defined using TypeScript and then translated into a physical database schema using a tool called an **Object-Relational Mapper (ORM)**.

> **What is an ORM?**
>
> An ORM is a library that provides a way to interact with a database using an object-oriented programming language. It maps the tables in a database to classes in the code, and the rows in those tables to instances of those classes. This allows developers to work with the database in a more intuitive and natural way, without having to write raw SQL queries.
>
> FDM uses the [Drizzle ORM](https://orm.drizzle.team/) to manage its database schema.

## Schema Overview

The FDM database is organized into four distinct PostgreSQL schemas:

1. **`fdm`**: Contains the core tables related to farm management, fields, cultivations, fertilizers, soil data, etc.
2. **`fdm-authn`**: Handles authentication, storing user accounts, sessions, organizations, and related information.
3. **`fdm-authz`**: Manages authorization, defining roles, permissions, and maintaining an audit trail.
4. **`fdm-calculator`**: Caches calculation results and stores calculation errors to improve performance and provide better debugging capabilities.

---

## `fdm` Schema (Core Farm Data)

This schema holds the primary data related to farm operations.

### Farms & Fields

#### **`farms`**

**Purpose**: Stores basic information about each farm entity in the system.

| Column              | Type                        | Constraints | Description                               |
|---------------------|-----------------------------|-------------|-------------------------------------------|
| **b_id_farm**       | `text`                      | Primary Key | Unique identifier for the farm.           |
| **b_name_farm**     | `text`                      |             | Name of the farm.                         |
| **b_businessid_farm**| `text`                     |             | Business ID associated with the farm.     |
| **b_address_farm**  | `text`                      |             | Physical address of the farm.             |
| **b_postalcode_farm**| `text`                    |             | Postal code of the farm address.          |
| **created**         | `timestamp with time zone`  | Not Null    | Timestamp when this record was created (default: now()). |
| **updated**         | `timestamp with time zone`  |             | Timestamp when this record was last updated. |

**Indexes:**

* Unique index on `b_id_farm`.

#### **`fields`**

**Purpose**: Stores information about each agricultural field, including its geometry and identifiers.

| Column          | Type                        | Constraints | Description                                                     |
|-----------------|-----------------------------|-------------|-----------------------------------------------------------------|
| **b_id**        | `text`                      | Primary Key | Unique identifier for the field.                                |
| **b_name**      | `text`                      | Not Null    | Name of the field.                                              |
| **b_geometry**  | `geometry` (Polygon, SRID 4326) |           | Polygon geometry representing the field boundary. See Custom Types section. |
| **b_id_source** | `text`                      |             | Optional identifier from an external data source.               |
| **created**     | `timestamp with time zone`  | Not Null    | Timestamp when this record was created (default: now()).        |
| **updated**     | `timestamp with time zone`  |             | Timestamp when this record was last updated.                    |

**Indexes:**

* Unique index on `b_id`.
* GIST index on `b_geometry` for spatial queries.

#### **`fieldAcquiring`**

**Purpose**: Tracks the relationship between a farm and a field it manages, including the method and timeframe of acquisition.

| Column                | Type                        | Constraints                                  | Description                                                              |
|-----------------------|-----------------------------|----------------------------------------------|--------------------------------------------------------------------------|
| **b_id**              | `text`                      | Not Null, Foreign Key (references `fields.b_id`) | Identifier of the field being acquired.                                  |
| **b_id_farm**         | `text`                      | Not Null, Foreign Key (references `farms.b_id_farm`) | Identifier of the farm acquiring the field.                              |
| **b_start**           | `timestamp with time zone`  |                                              | Timestamp indicating the start of the farm's management/acquisition.     |
| **b_acquiring_method**| `acquiringMethodEnum`       | Not Null (default: 'unknown')                | Method by which the farm acquired the field. |
| **created**           | `timestamp with time zone`  | Not Null                                     | Timestamp when this record was created (default: now()).                 |
| **updated**           | `timestamp with time zone`  |                                              | Timestamp when this record was last updated.                             |

**Constraints:**

* Primary Key on (`b_id`, `b_id_farm`).

##### `acquiringMethodEnum`

* **Name**: `b_acquiring_method`
* **Possible values**: `nl_01`, `nl_02`, `nl_03`, `nl_04`, `nl_07`, `nl_09`, `nl_10`, `nl_11`, `nl_12`, `nl_13`, `nl_61`, `nl_63`, `unknown`

#### **`fieldDiscarding`**

**Purpose**: Marks when a field is no longer actively managed or used within the system.

| Column      | Type                        | Constraints                                  | Description                                      |
|-------------|-----------------------------|----------------------------------------------|--------------------------------------------------|
| **b_id**    | `text`                      | Primary Key, Foreign Key (references `fields.b_id`) | Identifier of the field being discarded.         |
| **b_end**   | `timestamp with time zone`  |                                              | Timestamp indicating when the field was discarded. |
| **created** | `timestamp with time zone`  | Not Null                                     | Timestamp when this record was created (default: now()). |
| **updated** | `timestamp with time zone`  |                                              | Timestamp when this record was last updated.     |

---

### Cultivations

#### **`cultivationsCatalogue`**

**Purpose**: A standardized catalogue of possible cultivation types (crops, cover crops, etc.).

| Column              | Type                        | Constraints | Description                                                                        |
|---------------------|-----------------------------|-------------|------------------------------------------------------------------------------------|
| **b_lu_catalogue**  | `text`                      | Primary Key | Unique identifier for the cultivation type in the catalogue.                       |
| **b_lu_source**     | `text`                      | Not Null    | Identifier for the source of this catalogue entry (e.g., 'BRP', 'EuroCrops').      |
| **b_lu_name**       | `text`                      | Not Null    | Name of the cultivation (often in the local language, e.g., Dutch).                |
| **b_lu_name_en**    | `text`                      |             | English name of the cultivation.                                                   |
| **b_lu_harvestable**| `harvestableEnum`           | Not Null    | Indicates if/how the cultivation is typically harvested ('none', 'once', 'multiple'). |
| **b_lu_hcat3**      | `text`                      |             | Hierarchical grouping code (e.g., from EuroCrops).                                 |
| **b_lu_hcat3_name** | `text`                      |             | Human-readable name of the hierarchical grouping.                                  |
| **b_lu_croprotation**| `rotationEnum`             |             | Crop rotation category for the cultivation.                                        |
| **b_lu_yield**      | `numeric` (custom)         |             | Typical yield of the cultivation.                                                  |
| **b_lu_hi**         | `numeric` (custom)         |             | Harvest index (ratio of harvested biomass to total biomass).                       |
| **b_lu_n_harvestable**| `numeric` (custom)       |             | Nitrogen content in the harvested portion.                                         |
| **b_lu_n_residue**  | `numeric` (custom)         |             | Nitrogen content in the crop residue.                                              |
| **b_n_fixation**    | `numeric` (custom)         |             | Nitrogen fixation rate (for legumes).                                              |
| **b_lu_rest_oravib**| `boolean`                   |             | Is the cultivation a 'rustgewas' with regards to Dutch manure legislation                                                                         |
| **b_lu_variety_options**| `text[]`                |             | A set of varieties (cultivars) that a cultivation may be                                                                                 |
| **b_lu_start_default**| `text`                    |             | Default start date of the cultivation (MM-DD).                                     |
| **b_date_harvest_default**| `text`                |             | Default harvest date of the cultivation (MM-DD).                                   |
| **hash**            | `text`                      |             | A hash value representing the content of the catalogue entry, for change tracking. |
| **created**         | `timestamp with time zone`  | Not Null    | Timestamp when this record was created (default: now()).                           |
| **updated**         | `timestamp with time zone`  |             | Timestamp when this record was last updated.                                       |

**Indexes:**

* Unique index on `b_lu_catalogue`.

##### `harvestableEnum`

* **Name**: `b_lu_harvestable`
* **Possible values**: `none`, `once`, `multiple`

##### `rotationEnum`

* **Name**: `b_lu_croprotation`
* **Possible values**: `other`, `clover`, `nature`, `potato`, `grass`, `rapeseed`, `starch`, `maize`, `cereal`, `sugarbeet`, `alfalfa`, `catchcrop`

#### **`cultivations`**

**Purpose**: Represents an instance of a cultivation being grown, linking it to its catalogue definition.

| Column             | Type                        | Constraints                                                  | Description                                                              |
|--------------------|-----------------------------|--------------------------------------------------------------|--------------------------------------------------------------------------|
| **b_lu**           | `text`                      | Primary Key                                                  | Unique identifier for this specific cultivation instance.                |
| **b_lu_catalogue** | `text`                      | Not Null, Foreign Key (references `cultivationsCatalogue.b_lu_catalogue`) | Links to the type of cultivation in the catalogue.                       |
| **b_lu_variety**   | `text`                      |                                                              | Variety of the cultivation.                                              |
| **created**        | `timestamp with time zone`  | Not Null                                                     | Timestamp when this record was created (default: now()).                 |
| **updated**        | `timestamp with time zone`  |                                                              | Timestamp when this record was last updated.                             |

**Indexes:**

* Unique index on `b_lu`.

#### **`cultivationStarting`**

**Purpose**: Records the event of starting a specific cultivation instance on a particular field.

| Column            | Type                        | Constraints                                  | Description                                                        |
|-------------------|-----------------------------|----------------------------------------------|--------------------------------------------------------------------|
| **b_id**          | `text`                      | Not Null, Foreign Key (references `fields.b_id`) | Identifier of the field where the cultivation is started.          |
| **b_lu**          | `text`                      | Not Null, Foreign Key (references `cultivations.b_lu`) | Identifier of the cultivation instance being started.              |
| **b_lu_start**    | `timestamp with time zone`  |                                              | Timestamp indicating the start of the cultivation (e.g., sowing date). |
| **b_sowing_amount**| `numeric` (custom)         |                                              | Amount of seed/material used for sowing (units may vary).          |
| **b_sowing_method**| `text`                     |                                              | Method used for sowing/planting.                                   |
| **created**       | `timestamp with time zone`  | Not Null                                     | Timestamp when this record was created (default: now()).           |
| **updated**       | `timestamp with time zone`  |                                              | Timestamp when this record was last updated.                       |

**Constraints:**

* Primary Key on (`b_id`, `b_lu`).

#### **`cultivationEnding`**

**Purpose**: Marks the end date for a specific cultivation instance.

| Column      | Type                        | Constraints                                  | Description                                                     |
|-------------|-----------------------------|----------------------------------------------|-----------------------------------------------------------------|
| **b_lu**    | `text`                      | Primary Key, Foreign Key (references `cultivations.b_lu`) | Identifier of the cultivation instance ending.                  |
| **b_lu_end**| `timestamp with time zone`  |                                              | Timestamp indicating the end of the cultivation (e.g., final harvest, termination). |
| **m_cropresidue**| `boolean`                |                                              | Indicates if crop residue was left on the field.                |
| **created** | `timestamp with time zone`  | Not Null                                     | Timestamp when this record was created (default: now()).        |
| **updated** | `timestamp with time zone`  |                                              | Timestamp when this record was last updated.                    |

#### **`cultivationCatalogueSelecting`**

**Purpose**: Indicates which cultivation catalogues are actively selected or used by a specific farm.

| Column        | Type                        | Constraints                                                        | Description                                                     |
|---------------|-----------------------------|--------------------------------------------------------------------|-----------------------------------------------------------------|
| **b_id_farm** | `text`                      | Not Null, Foreign Key (references `farms.b_id_farm`)               | Identifier of the farm selecting the catalogue source.          |
| **b_lu_source**| `text`                     | Not Null                                                           | Identifier of the cultivation catalogue source being selected. |
| **created**   | `timestamp with time zone`  | Not Null                                                           | Timestamp when this record was created (default: now()).        |
| **updated**   | `timestamp with time zone`  |                                                                    | Timestamp when this record was last updated.                    |

**Constraints:**

* Primary Key on (`b_id_farm`, `b_lu_source`).

---

### Harvestables

#### **`harvestables`**

**Purpose**: Represents a potential or actual harvestable product derived from a cultivation.

| Column             | Type                        | Constraints | Description                                      |
|--------------------|-----------------------------|-------------|--------------------------------------------------|
| **b_id_harvestable**| `text`                     | Primary Key | Unique identifier for the harvestable product.   |
| **created**        | `timestamp with time zone`  | Not Null    | Timestamp when this record was created (default: now()). |
| **updated**        | `timestamp with time zone`  |             | Timestamp when this record was last updated.     |

**Indexes:**

* Unique index on `b_id_harvestable`.

#### **`harvestableAnalyses`**

**Purpose**: Stores the results of analyses performed on harvested products.

| Column                      | Type                        | Constraints | Description                                                                 |
|-----------------------------|-----------------------------|-------------|-----------------------------------------------------------------------------|
| **b_id_harvestable_analysis**| `text`                     | Primary Key | Unique identifier for the harvest analysis record.                          |
| **b_lu_yield**              | `numeric` (custom)         |             | Measured dry matter yield of the harvestable product (kg DM / ha).    |
| **b_lu_yield_fresh**        | `numeric` (custom)         |             | Measured fresh yield of the harvestable product (kg fresh / ha).                            |
| **b_lu_yield_bruto**        | `numeric` (custom)         |             | Measured gross yield (including tare) of the harvestable product (kg fresh / ha).                            |
| **b_lu_tarra**              | `numeric` (custom)         |             | Measured tarra (tare) of the harvestable product (%).                           |
| **b_lu_dm**                 | `numeric` (custom)         |             | Measured dry matter content of the harvestable product (g DM / kg fresh).                     |
| **b_lu_moist**              | `numeric` (custom)         |             | Measured moisture content of the harvestable product (%).                       |
| **b_lu_uww**                | `numeric` (custom)         |             | Measured underwater weight of the harvestable product (g  / 5 kg).                      |
| **b_lu_cp**                 | `numeric` (custom)         |             | Measured crude protein content of the harvestable product (g RE / kg DM).                  |
| **b_lu_n_harvestable**      | `numeric` (custom)         |             | Nitrogen content in the harvested portion (g N/ kg DM).                                  |
| **b_lu_n_residue**          | `numeric` (custom)         |             | Nitrogen content in the crop residue.                                       |
| **b_lu_p_harvestable**      | `numeric` (custom)         |             | Phosphorus content in the harvested portion.                                |
| **b_lu_p_residue**          | `numeric` (custom)         |             | Phosphorus content in the crop residue.                                     |
| **b_lu_k_harvestable**      | `numeric` (custom)         |             | Potassium content in the harvested portion.                                 |
| **b_lu_k_residue**          | `numeric` (custom)         |             | Potassium content in the crop residue.                                      |
| **created**                 | `timestamp with time zone`  | Not Null    | Timestamp when this record was created (default: now()).                    |
| **updated**                 | `timestamp with time zone`  |             | Timestamp when this record was last updated.                                |

**Indexes:**

* Unique index on `b_id_harvestable_analysis`.

#### **`harvestableSampling`**

**Purpose**: Links a harvestable product instance to its analysis results, recording the sampling date.

| Column                      | Type                        | Constraints                                                  | Description                                                              |
|-----------------------------|-----------------------------|--------------------------------------------------------------|--------------------------------------------------------------------------|
| **b_id_harvestable**        | `text`                      | Not Null, Foreign Key (references `harvestables.b_id_harvestable`) | Identifier of the harvestable product sampled.                           |
| **b_id_harvestable_analysis**| `text`                     | Not Null, Foreign Key (references `harvestableAnalyses.b_id_harvestable_analysis`) | Identifier of the analysis performed on the sample.                      |
| **b_sampling_date**         | `timestamp with time zone`  |                                                              | Timestamp when the harvestable product was sampled for analysis.         |
| **created**                 | `timestamp with time zone`  | Not Null                                                     | Timestamp when this record was created (default: now()).                 |
| **updated**                 | `timestamp with time zone`  |                                                              | Timestamp when this record was last updated.                             |

**Constraints:**

* Primary Key on (`b_id_harvestable`, `b_id_harvestable_analysis`).

#### **`cultivationHarvesting`**

**Purpose**: Records a specific harvesting event, linking the cultivation instance to the resulting harvestable product.

| Column             | Type                        | Constraints                                                  | Description                                                              |
|--------------------|-----------------------------|----------------------------------------------|--------------------------------------------------------------------------|
| **b_id_harvesting**| `text`                     | Primary Key                                                  | Unique identifier for this harvesting event.                             |
| **b_id_harvestable**| `text`                     | Not Null, Foreign Key (references `harvestables.b_id_harvestable`) | Identifier of the harvestable product obtained from this event.          |
| **b_lu**           | `text`                      | Not Null, Foreign Key (references `cultivations.b_lu`)       | Identifier of the cultivation instance that was harvested.               |
| **b_lu_harvest_date**| `timestamp with time zone` |                                                              | Timestamp when the harvesting event occurred.                            |
| **created**        | `timestamp with time zone`  | Not Null                                                     | Timestamp when this record was created (default: now()).                 |
| **updated**        | `timestamp with time zone`  |                                                              | Timestamp when this record was last updated.                             |

---

### Fertilizers

#### **`fertilizersCatalogue`**

**Purpose**: A standardized catalogue of fertilizer products, detailing their composition and properties.

| Column             | Type                        | Constraints | Description                                                                    |
|--------------------|-----------------------------|-------------|--------------------------------------------------------------------------------|
| **p_id_catalogue** | `text`                      | Primary Key | Unique identifier for the fertilizer type in the catalogue.                    |
| **p_source**       | `text`                      | Not Null    | Identifier for the source of this catalogue entry (e.g., 'baat', 'srm').        |
| **p_name_nl**      | `text`                      | Not Null    | Name of the fertilizer (often in Dutch).                                       |
| **p_name_en**      | `text`                      |             | English name of the fertilizer.                                                |
| **p_description**  | `text`                      |             | Additional descriptive text about the fertilizer.                              |
| **p_app_method_options** | `applicationMethodEnum[]` |           | Allowed application methods for the fertilizer.                                |
| **p_dm**           | `numeric` (custom)         |             | Dry Matter content (%).                                                        |
| **p_density**      | `numeric` (custom)         |             | Density (e.g., kg/m³).                                                         |
| **p_om**           | `numeric` (custom)         |             | Organic Matter content (%).                                                    |
| **p_a**            | `numeric` (custom)         |             | Ammonium content (%).                                                          |
| **p_hc**           | `numeric` (custom)         |             | Humic content (%).                                                             |
| **p_eom**          | `numeric` (custom)         |             | Effective Organic Matter (%).                                                  |
| **p_eoc**          | `numeric` (custom)         |             | Effective Organic Carbon (%).                                                  |
| **p_c_rt**         | `numeric` (custom)         |             | Total Carbon content (%).                                                      |
| **p_c_of**         | `numeric` (custom)         |             | Organic Carbon content (%).                                                    |
| **p_c_if**         | `numeric` (custom)         |             | Inorganic Carbon content (%).                                                  |
| **p_c_fr**         | `numeric` (custom)         |             | Carbon content in fresh matter (%).                                            |
| **p_cn_of**        | `numeric` (custom)         |             | Carbon to Nitrogen ratio in organic fraction.                                  |
| **p_n_rt**         | `numeric` (custom)         |             | Total Nitrogen content (%).                                                    |
| **p_n_if**         | `numeric` (custom)         |             | Inorganic Nitrogen content (%).                                                |
| **p_n_of**         | `numeric` (custom)         |             | Organic Nitrogen content (%).                                                  |
| **p_n_wc**         | `numeric` (custom)         |             | Water-soluble Nitrogen content (%).                                            |
| **p_no3_rt**       | `numeric` (custom)         |             | Total Nitrate content (%).                                                     |
| **p_nh4_rt**       | `numeric` (custom)         |             | Total Ammonium content (%).                                                    |
| **p_p_rt**         | `numeric` (custom)         |             | Total Phosphorus content (%).                                                  |
| **p_k_rt**         | `numeric` (custom)         |             | Total Potassium content (%).                                                   |
| **p_mg_rt**        | `numeric` (custom)         |             | Total Magnesium content (%).                                                   |
| **p_ca_rt**        | `numeric` (custom)         |             | Total Calcium content (%).                                                     |
| **p_ne**           | `numeric` (custom)         |             | Neutralizing equivalent (%).                                                   |
| **p_s_rt**         | `numeric` (custom)         |             | Total Sulfur content (%).                                                      |
| **p_s_wc**         | `numeric` (custom)         |             | Water-soluble Sulfur content (%).                                              |
| **p_cu_rt**        | `numeric` (custom)         |             | Total Copper content (%).                                                      |
| **p_zn_rt**        | `numeric` (custom)         |             | Total Zinc content (%).                                                        |
| **p_na_rt**        | `numeric` (custom)         |             | Total Sodium content (%).                                                      |
| **p_si_rt**        | `numeric` (custom)         |             | Total Silicon content (%).                                                     |
| **p_b_rt**         | `numeric` (custom)         |             | Total Boron content (%).                                                       |
| **p_mn_rt**        | `numeric` (custom)         |             | Total Manganese content (%).                                                   |
| **p_ni_rt**        | `numeric` (custom)         |             | Total Nickel content (%).                                                      |
| **p_fe_rt**        | `numeric` (custom)         |             | Total Iron content (%).                                                        |
| **p_mo_rt**        | `numeric` (custom)         |             | Total Molybdenum content (%).                                                  |
| **p_co_rt**        | `numeric` (custom)         |             | Total Cobalt content (%).                                                      |
| **p_as_rt**        | `numeric` (custom)         |             | Total Arsenic content (%).                                                     |
| **p_cd_rt**        | `numeric` (custom)         |             | Total Cadmium content (%).                                                     |
| **p_cr_rt**        | `numeric` (custom)         |             | Total Chromium content (%).                                                    |
| **p_cr_vi**        | `numeric` (custom)         |             | Chromium VI content (%).                                                       |
| **p_pb_rt**        | `numeric` (custom)         |             | Total Lead content (%).                                                        |
| **p_hg_rt**        | `numeric` (custom)         |             | Total Mercury content (%).                                                     |
| **p_cl_rt**        | `numeric` (custom)         |             | Total Chlorine content (%).                                                    |
| **p_ef_nh3**       | `numeric` (custom)         |             | Ammonia emission factor.                                                       |
| **p_type_manure**  | `boolean`                   |             | Flag indicating if it's a manure type fertilizer.                              |
| **p_type_mineral** | `boolean`                   |             | Flag indicating if it's a mineral type fertilizer.                             |
| **p_type_compost** | `boolean`                   |             | Flag indicating if it's a compost type fertilizer.                             |
| **p_type_rvo**     | `typeRvoEnum`               |             | RVO manure type code.                                                          |
| **hash**           | `text`                      |             | A hash value representing the content of the catalogue entry, for change tracking. |
| **created**        | `timestamp with time zone`  | Not Null    | Timestamp when this record was created (default: now()).                       |
| **updated**        | `timestamp with time zone`  |             | Timestamp when this record was last updated.                                   |

**Indexes:**

* Unique index on `p_id_catalogue`.

#### **`fertilizers`**

**Purpose**: Represents an instance of a fertilizer product (e.g., a specific batch or acquisition).

| Column      | Type                        | Constraints | Description                                      |
|-------------|-----------------------------|-------------|--------------------------------------------------|
| **p_id**    | `text`                      | Primary Key | Unique identifier for this fertilizer instance.  |
| **created** | `timestamp with time zone`  | Not Null    | Timestamp when this record was created (default: now()). |
| **updated** | `timestamp with time zone`  |             | Timestamp when this record was last updated.     |

**Indexes:**

* Unique index on `p_id`.

#### **`fertilizerAcquiring`**

**Purpose**: Tracks the acquisition of a specific fertilizer instance by a farm.

| Column               | Type                        | Constraints                                  | Description                                                 |
|----------------------|-----------------------------|----------------------------------------------|-------------------------------------------------------------|
| **b_id_farm**        | `text`                      | Not Null, Foreign Key (references `farms.b_id_farm`) | Identifier of the farm acquiring the fertilizer.            |
| **p_id**             | `text`                      | Not Null, Foreign Key (references `fertilizers.p_id`) | Identifier of the fertilizer instance being acquired.       |
| **p_acquiring_amount**| `numeric` (custom)         |                                              | Quantity of fertilizer acquired (in kg).                    |
| **p_acquiring_date** | `timestamp with time zone`  |                                              | Timestamp when the fertilizer was acquired.                 |
| **created**          | `timestamp with time zone`  | Not Null                                     | Timestamp when this record was created (default: now()).    |
| **updated**          | `timestamp with time zone`  |                                              | Timestamp when this record was last updated.                |

#### **`fertilizerPicking`**

**Purpose**: Links a specific fertilizer instance to its corresponding entry in the `fertilizersCatalogue`.

| Column             | Type                        | Constraints                                                  | Description                                                              |
|--------------------|-----------------------------|--------------------------------------------------------------|--------------------------------------------------------------------------|
| **p_id**           | `text`                      | Not Null, Foreign Key (references `fertilizers.p_id`)        | Identifier of the fertilizer instance.                                   |
| **p_id_catalogue** | `text`                      | Not Null, Foreign Key (references `fertilizersCatalogue.p_id_catalogue`) | Identifier of the catalogue entry matching this fertilizer instance. |
| **p_picking_date** | `timestamp with time zone`  |                                                              | Timestamp when this fertilizer instance was matched to a catalogue entry. |
| **created**        | `timestamp with time zone`  | Not Null                                                     | Timestamp when this record was created (default: now()).                 |
| **updated**        | `timestamp with time zone`  |                                                              | Timestamp when this record was last updated.                             |

#### **`fertilizerApplication`**

**Purpose**: Logs the event of applying a specific fertilizer instance to a field.

| Column         | Type                        | Constraints                                  | Description                                                              |
|----------------|-----------------------------|----------------------------------------------|--------------------------------------------------------------------------|
| **p_app_id**   | `text`                      | Primary Key                                  | Unique identifier for this application event.                            |
| **b_id**       | `text`                      | Not Null, Foreign Key (references `fields.b_id`) | Identifier of the field where the fertilizer was applied.                |
| **p_id**       | `text`                      | Not Null, Foreign Key (references `fertilizers.p_id`) | Identifier of the fertilizer instance applied.                           |
| **p_app_amount**| `numeric` (custom)         |                                              | Amount of fertilizer applied (typically kg/ha).                          |
| **p_app_method**| `applicationMethodEnum`     |                                              | Method used for application.           |
| **p_app_date** | `timestamp with time zone`  |                                              | Timestamp when the application occurred.                                 |
| **created**    | `timestamp with time zone`  | Not Null                                     | Timestamp when this record was created (default: now()).                 |
| **updated**    | `timestamp with time zone`  |                                              | Timestamp when this record was last updated.                             |

**Indexes:**

* Unique index on `p_app_id`.

##### `applicationMethodEnum`

* **Name**: `p_app_method`
* **Possible values**: `slotted coulter`, `incorporation`, `incorporation 2 tracks`, `injection`, `shallow injection`, `spraying`, `broadcasting`, `spoke wheel`, `pocket placement`, `narrowband`

#### **`fertilizerCatalogueEnabling`**

**Purpose**: Indicates which fertilizer catalogue sources are actively enabled or used by a specific farm.

| Column      | Type                        | Constraints                                                        | Description                                                        |
|-------------|-----------------------------|--------------------------------------------------------------------|--------------------------------------------------------------------|
| **b_id_farm**| `text`                     | Not Null, Foreign Key (references `farms.b_id_farm`)               | Identifier of the farm enabling the catalogue source.              |
| **p_source** | `text`                      | Not Null                                                           | Identifier of the fertilizer catalogue source being enabled.       |
| **created** | `timestamp with time zone`  | Not Null                                                           | Timestamp when this record was created (default: now()).           |
| **updated** | `timestamp with time zone`  |                                                                    | Timestamp when this record was last updated.                       |

**Constraints:**

* Primary Key on (`b_id_farm`, `p_source`).

---

### Soil

#### **`soilAnalysis`**

**Purpose**: Stores the results of a soil analysis.

| Column            | Type                        | Constraints | Description                                                         |
|-------------------|-----------------------------|-------------|---------------------------------------------------------------------|
| **a_id**          | `text`                      | Primary Key | Unique identifier for the soil analysis record.                     |
| **a_date**        | `timestamp with time zone`  |             | Timestamp indicating when the analysis was performed or reported.   |
| **a_source**      | `soilAnalysisSourceEnum`    |             | Laboratory that performed the analysis.                             |
| **a_al_ox**       | `numeric` (custom)         |             | Aluminum extracted with oxalate (mmol Al/kg).                       |
| **a_c_of**        | `numeric` (custom)         |             | Organic carbon content (g C/g).                                     |
| **a_ca_co**       | `numeric` (custom)         |             | Calcium, total soil reserve (mmol+/kg).                             |
| **a_ca_co_po**    | `numeric` (custom)         |             | Calcium saturation degree (%).                                      |
| **a_caco3_if**    | `numeric` (custom)         |             | Carbonate lime (%).                                                 |
| **a_cec_co**      | `numeric` (custom)         |             | Cation Exchange Capacity (mmol+/kg).                                |
| **a_clay_mi**     | `numeric` (custom)         |             | Clay content (%).                                                   |
| **a_cn_fr**       | `numeric` (custom)         |             | Carbon / Nitrogen ratio (-).                                        |
| **a_com_fr**      | `numeric` (custom)         |             | Carbon / Organic matter ratio (-).                                  |
| **a_cu_cc**       | `numeric` (custom)         |             | Copper, plant available (µg Cu/kg).                                 |
| **a_density_sa**  | `numeric` (custom)         |             | Bulk density (g/cm³).                                               |
| **a_fe_ox**       | `numeric` (custom)         |             | Iron extracted with oxalate (mmol Fe/kg).                           |
| **a_k_cc**        | `numeric` (custom)         |             | Potassium, plant available (mg K/kg).                               |
| **a_k_co**        | `numeric` (custom)         |             | Potassium, total soil reserve (mmol+/kg).                           |
| **a_k_co_po**     | `numeric` (custom)         |             | Potassium saturation degree (%).                                    |
| **a_mg_cc**       | `numeric` (custom)         |             | Magnesium, plant available (mg Mg/kg).                              |
| **a_mg_co**       | `numeric` (custom)         |             | Magnesium, total soil reserve (mmol+ Mg/kg).                        |
| **a_mg_co_po**    | `numeric` (custom)         |             | Magnesium saturation degree (%).                                    |
| **a_n_pmn**       | `numeric` (custom)         |             | Potentially mineralizable Nitrogen (mg N/kg).                       |
| **a_n_rt**        | `numeric` (custom)         |             | Nitrogen, total soil reserve (mg N/g).                              |
| **a_nh4_cc**      | `numeric` (custom)         |             | Ammonium (NH4-N) (mg N/l).                                          |
| **a_nmin_cc**     | `numeric` (custom)         |             | Available nitrogen reserve (kg N/ha).                               |
| **a_no3_cc**      | `numeric` (custom)         |             | Nitrate (NO3-N) (mg N/l).                                           |
| **a_p_al**        | `numeric` (custom)         |             | Total phosphate content (mg P2O5/100 g).                            |
| **a_p_cc**        | `numeric` (custom)         |             | Phosphorus, plant available (mg P/kg).                              |
| **a_p_ox**        | `numeric` (custom)         |             | Phosphorus extracted with oxalate (mmol P/kg).                      |
| **a_p_rt**        | `numeric` (custom)         |             | Phosphorus, total soil reserve (g P/kg).                            |
| **a_p_sg**        | `numeric` (custom)         |             | Phosphorus saturation degree (%).                                   |
| **a_p_wa**        | `numeric` (custom)         |             | Phosphate extracted with water (mg P2O5/l).                         |
| **a_ph_cc**       | `numeric` (custom)         |             | Acidity measured with CaCl2 extraction (-).                         |
| **a_s_rt**        | `numeric` (custom)         |             | Sulfur, total soil reserve (mg S/kg).                               |
| **a_sand_mi**     | `numeric` (custom)         |             | Sand content (%).                                                   |
| **a_silt_mi**     | `numeric` (custom)         |             | Silt content (%).                                                   |
| **a_som_loi**     | `numeric` (custom)         |             | Organic matter content determined by Loss on Ignition (%).          |
| **a_zn_cc**       | `numeric` (custom)         |             | Zinc, plant available (µg Zn/kg).                                   |
| **b_gwl_class**   | `gwlClassEnum`              |             | Groundwater level classification.                                   |
| **b_soiltype_agr**| `soiltypeEnum`              |             | Agricultural soil type.                                             |
| **created**       | `timestamp with time zone`  | Not Null    | Timestamp when this record was created (default: now()).            |
| **updated**       | `timestamp with time zone`  |             | Timestamp when this record was last updated.                        |

##### `soiltypeEnum`

* **Name**: `b_soiltype_agr`
* **Possible values**: `moerige_klei`, `rivierklei`, `dekzand`, `zeeklei`, `dalgrond`, `veen`, `loess`, `duinzand`, `maasklei`

##### `gwlClassEnum`

* **Name**: `b_gwl_class`
* **Possible values**: `I`, `Ia`, `Ic`, `II`, `IIa`, `IIb`, `IIc`, `III`, `IIIa`, `IIIb`, `IV`, `IVu`, `IVc`, `V`, `Va`, `Vao`, `Vad`, `Vb`, `Vbo`, `Vbd`, `sV`, `sVb`, `VI`, `VIo`, `VId`, `VII`, `VIIo`, `VIId`, `VIII`, `VIIIo`, `VIIId`

##### `soilAnalysisSourceEnum`

* **Name**: `a_source`
* **Possible values**: `nl-rva-l122` (Eurofins Agro Testing Wageningen B.V.), `nl-rva-l136` (Nutrilab B.V.), `nl-rva-l264` (Normec Robalab B.V.), `nl-rva-l320` (Agrarisch Laboratorium Noord-Nederland/Alnn B.V.), `nl-rva-l335` (Normec Groen Agro Control), `nl-rva-l610` (Normec Dumea B.V.), `nl-rva-l648` (Fertilab B.V.), `nl-rva-l697` (Care4Agro B.V.), `nl-other-nmi` (NMI BodemSchat), `other` (Ander laboratorium)

#### **`soilSampling`**

**Purpose**: Records the details of a soil sampling event, linking a field location to a soil analysis.

| Column                | Type                        | Constraints                                  | Description                                                              |
|-----------------------|-----------------------------|----------------------------------------------|--------------------------------------------------------------------------|
| **b_id_sampling**     | `text`                      | Primary Key                                  | Unique identifier for the soil sampling event.                           |
| **b_id**              | `text`                      | Not Null, Foreign Key (references `fields.b_id`) | Identifier of the field where the sample was taken.                      |
| **a_id**              | `text`                      | Not Null, Foreign Key (references `soilAnalysis.a_id`) | Identifier of the analysis performed on this sample.                   |
| **a_depth_upper**     | `numeric` (custom)         | Not Null, Default: 0                         | Upper depth of the soil sample (e.g., cm).                               |
| **a_depth_lower**     | `numeric` (custom)         |                                              | Lower depth of the soil sample (e.g., cm).                               |
| **b_sampling_date**   | `timestamp with time zone`  |                                              | Timestamp when the sample was collected.                                 |
| **b_sampling_geometry**| `geometry` (MultiPoint, SRID 4326) |      | MultiPoint geometry representing the location(s) where the sample(s) were taken. See Custom Types section. |
| **created**           | `timestamp with time zone`  | Not Null                                     | Timestamp when this record was created (default: now()).                 |
| **updated**           | `timestamp with time zone`  |                                              | Timestamp when this record was last updated.                             |

---

### Derogations & Certifications

#### **`derogations`**

**Purpose**: Stores information about derogations, which is special permissions by year related to legal norms for fertilizer application.

| Column | Type | Constraints | Description |
|---|---|---|---|
| **b_id_derogation** | `text` | Primary Key | Unique identifier for the derogation. |
| **b_derogation_year** | `integer` | Not Null | The year the derogation applies to. |
| **created** | `timestamp with time zone` | Not Null | Timestamp when this record was created (default: now()). |
| **updated** | `timestamp with time zone` | | Timestamp when this record was last updated. |

**Indexes:**

* Unique index on `b_id_derogation`.

#### **`derogationApplying`**

**Purpose**: Links a farm to a specific derogation, indicating that the farm is applying or making use of that derogation.

| Column | Type | Constraints | Description |
|---|---|---|---|
| **b_id_farm** | `text` | Not Null, Foreign Key (references `farms.b_id_farm`) | Identifier of the farm applying the derogation. |
| **b_id_derogation** | `text` | Not Null, Foreign Key (references `derogations.b_id_derogation`) | Identifier of the derogation being applied. |
| **created** | `timestamp with time zone` | Not Null | Timestamp when this record was created (default: now()). |
| **updated** | `timestamp with time zone` | | Timestamp when this record was last updated. |

**Constraints:**

* Primary Key on (`b_id_farm`, `b_id_derogation`).

#### **`organicCertifications`**

**Purpose**: Stores information about organic certifications for a farm.

| Column | Type | Constraints | Description |
|---|---|---|---|
| **b_id_organic** | `text` | Primary Key | Unique identifier for the organic certification. |
| **b_organic_traces** | `text` | | TRACES number of the organic certification. |
| **b_organic_skal** | `text` | | Skal number of the organic certification. |
| **b_organic_issued** | `timestamp with time zone` | | Timestamp when the certification was issued. |
| **b_organic_expires** | `timestamp with time zone` | | Timestamp when the certification expires. |
| **created** | `timestamp with time zone` | Not Null | Timestamp when this record was created (default: now()). |
| **updated** | `timestamp with time zone` | | Timestamp when this record was last updated. |

#### **`organicCertificationsHolding`**

**Purpose**: Links a farm to a specific organic certification.

| Column | Type | Constraints | Description |
|---|---|---|---|
| **b_id_farm** | `text` | Not Null, Foreign Key (references `farms.b_id_farm`) | Identifier of the farm holding the certification. |
| **b_id_organic** | `text` | Not Null, Foreign Key (references `organicCertifications.b_id_organic`) | Identifier of the organic certification. |
| **created** | `timestamp with time zone` | Not Null | Timestamp when this record was created (default: now()). |
| **updated** | `timestamp with time zone` | | Timestamp when this record was last updated. |

**Constraints:**

* Primary Key on (`b_id_farm`, `b_id_organic`).

#### **`intendingGrazing`**

**Purpose**: Stores the grazing intention for a farm for a specific year.

| Column | Type | Constraints | Description |
|---|---|---|---|
| **b_id_farm** | `text` | Not Null, Foreign Key (references `farms.b_id_farm`) | Identifier of the farm. |
| **b_grazing_intention** | `boolean` | | Whether the farm intends to graze animals. |
| **b_grazing_intention_year** | `integer` | Not Null | The year of the grazing intention. |
| **created** | `timestamp with time zone` | Not Null | Timestamp when this record was created (default: now()). |
| **updated** | `timestamp with time zone` | | Timestamp when this record was last updated. |

**Constraints:**

* Primary Key on (`b_id_farm`, `b_grazing_intention_year`).

---

## `fdm-authn` Schema (Authentication)

This schema handles user authentication, sessions, accounts, organizations, and related functionalities.

**Note:** This schema is largely defined and managed by the [`better-auth`](https://github.com/BetterStackHQ/better-auth) library. While the specific table structures are documented here for completeness, refer to the `better-auth` documentation for the most detailed information on its implementation and usage.

#### **`user`**

**Purpose**: Stores user account information.

| Column          | Type        | Constraints          | Description                                      |
|-----------------|-------------|----------------------|--------------------------------------------------|
| **id**          | `text`      | Primary Key          | Unique identifier for the user.                  |
| **name**        | `text`      | Not Null             | User's display name.                             |
| **email**       | `text`      | Not Null, Unique     | User's email address.                            |
| **emailVerified**| `boolean`  | Not Null             | Flag indicating if the email address is verified. |
| **image**       | `text`      |                      | URL to the user's profile image.                 |
| **createdAt**   | `timestamp` | Not Null             | Timestamp when the user account was created.     |
| **updatedAt**   | `timestamp` | Not Null             | Timestamp when the user account was last updated. |
| **username**    | `text`      | Unique               | User's unique username.                          |
| **displayUsername**| `text`   |                      | User's display username.                         |
| **firstname**   | `text`      |                      | User's first name.                               |
| **surname**     | `text`      |                      | User's surname.                                  |
| **lang**        | `text`      | Not Null             | User's preferred language code (e.g., 'en', 'nl'). |
| **farm_active** | `text`      |                      | Identifier of the user's currently active farm.  |

#### **`session`**

**Purpose**: Stores active user sessions.

| Column      | Type        | Constraints                               | Description                                      |
|-------------|-----------------------------|-------------------------------------------|--------------------------------------------------|
| **id**      | `text`      | Primary Key                               | Unique identifier for the session.               |
| **expiresAt**| `timestamp` | Not Null                                  | Timestamp when the session expires.              |
| **token**   | `text`      | Not Null, Unique                          | The session token.                               |
| **createdAt**| `timestamp` | Not Null                                  | Timestamp when the session was created.          |
| **updatedAt**| `timestamp` | Not Null                                  | Timestamp when the session was last updated.     |
| **ipAddress**| `text`      |                                           | IP address associated with the session.          |
| **userAgent**| `text`      |                                           | User agent string of the client.                 |
| **userId**  | `text`      | Not Null, Foreign Key (references `user.id`, onDelete: cascade) | Identifier of the user associated with the session. |
| **activeOrganizationId**| `text`|                                           | Identifier of the user's currently active organization. |

#### **`account`**

**Purpose**: Links user accounts to external authentication providers (e.g., OAuth providers) or stores credentials for password-based login.

| Column                 | Type        | Constraints                               | Description                                                                 |
|------------------------|-------------|-------------------------------------------|-----------------------------------------------------------------------------|
| **id**                 | `text`      | Primary Key                               | Unique identifier for the account link.                                     |
| **accountId**          | `text`      | Not Null                                  | The user's ID as provided by the external provider or internal system.      |
| **providerId**         | `text`      | Not Null                                  | Identifier of the authentication provider (e.g., 'google', 'credentials'). |
| **userId**             | `text`      | Not Null, Foreign Key (references `user.id`, onDelete: cascade) | Identifier of the FDM user associated with this account.                    |
| **accessToken**        | `text`      |                                           | Access token provided by the OAuth provider.                                |
| **refreshToken**       | `text`      |                                           | Refresh token provided by the OAuth provider.                               |
| **idToken**            | `text`      |                                           | ID token provided by the OAuth provider.                                    |
| **accessTokenExpiresAt**| `timestamp` |                                           | Timestamp when the access token expires.                                    |
| **refreshTokenExpiresAt**| `timestamp`|                                           | Timestamp when the refresh token expires (if applicable).                   |
| **scope**              | `text`      |                                           | Scope granted by the OAuth provider.                                        |
| **password**           | `text`      |                                           | Hashed password for credentials-based authentication.                       |
| **createdAt**          | `timestamp` | Not Null                                  | Timestamp when the account link was created.                                |
| **updatedAt**          | `timestamp` | Not Null                                  | Timestamp when the account link was last updated.                           |

#### **`verification`**

**Purpose**: Stores tokens used for verification purposes (e.g., email verification, password reset).

| Column      | Type        | Constraints | Description                                      |
|-------------|-------------|-------------|--------------------------------------------------|
| **id**      | `text`      | Primary Key | Unique identifier for the verification record.   |
| **identifier**| `text`     | Not Null    | Identifier associated with the verification (e.g., email). |
| **value**   | `text`      | Not Null    | The verification token or code.                  |
| **expiresAt**| `timestamp` | Not Null    | Timestamp when the verification token expires.   |
| **createdAt**| `timestamp` |             | Timestamp when the verification record was created. |
| **updatedAt**| `timestamp` |             | Timestamp when the verification record was last updated. |

#### **`organization`**

**Purpose**: Stores information about organizations in a multi-tenant setup.

| Column       | Type                        | Constraints | Description                                      |
|--------------|-----------------------------|-------------|--------------------------------------------------|
| **id**       | `text`                      | Primary Key | Unique identifier for the organization.          |
| **name**     | `text`                      | Not Null    | Name of the organization.                        |
| **slug**     | `text`                      | Unique      | URL-friendly unique identifier for the organization. |
| **logo**     | `text`                      |             | URL to the organization's logo.                  |
| **createdAt**| `timestamp`                 | Not Null    | Timestamp when the organization was created.     |
| **metadata** | `text`                      |             | JSON string for additional organization metadata. |

#### **`member`**

**Purpose**: Links users to organizations and defines their role within that organization.

| Column          | Type                        | Constraints                                  | Description                                      |
|-----------------|-----------------------------|----------------------------------------------|--------------------------------------------------|
| **id**          | `text`                      | Primary Key                                  | Unique identifier for the membership record.     |
| **organizationId**| `text`                    | Not Null, Foreign Key (references `organization.id`, onDelete: cascade) | Identifier of the organization.                  |
| **userId**      | `text`                      | Not Null, Foreign Key (references `user.id`, onDelete: cascade) | Identifier of the user.                          |
| **role**        | `text`                      | Not Null    | Role of the user within the organization (e.g., 'admin', 'member'). |
| **createdAt**   | `timestamp`                 | Not Null    | Timestamp when the membership was created.       |

#### **`invitation`**

**Purpose**: Stores invitations for users to join an organization.

| Column       | Type                        | Constraints                                  | Description                                      |
|--------------|-----------------------------|----------------------------------------------|--------------------------------------------------|
| **id**       | `text`                      | Primary Key                                  | Unique identifier for the invitation.            |
| **organizationId**| `text`                   | Not Null, Foreign Key (references `organization.id`, onDelete: cascade) | Identifier of the organization sending the invitation. |
| **email**    | `text`                      | Not Null    | Email address of the invited user.               |
| **role**     | `text`                      |             | Proposed role for the invited user.              |
| **status**   | `text`                      | Not Null    | Status of the invitation (e.g., 'pending', 'accepted', 'declined'). |
| **expiresAt**| `timestamp`                 | Not Null    | Timestamp when the invitation expires.           |
| **inviterId**| `text`                      | Not Null, Foreign Key (references `user.id`, onDelete: cascade) | Identifier of the user who sent the invitation.  |

#### **`rateLimit`**

**Purpose**: Used for tracking and enforcing rate limits on certain actions.

| Column       | Type    | Constraints | Description                                      |
|--------------|---------|-------------|--------------------------------------------------|
| **id**       | `text`  | Primary Key | Unique identifier for the rate limit record.     |
| **key**      | `text`  |             | Key identifying the resource being rate-limited. |
| **count**    | `integer`|            | Current count of requests for the key.           |
| **lastRequest**| `bigint`|            | Timestamp (as number/epoch) of the last request. |

---

## `fdm-authz` Schema (Authorization)

This schema manages roles, permissions, and auditing for authorization purposes.

#### **`role`**

**Purpose**: Defines roles assigned to principals (users) for specific resources.

| Column             | Type                        | Constraints | Description                                                                 |
|--------------------|-----------------------------|-------------|-----------------------------------------------------------------------------|
| **role_id**        | `text`                      | Primary Key | Unique identifier for the role assignment.                                  |
| **resource**       | `text`                      | Not Null    | Type of the resource (e.g., 'farm', 'field').                               |
| **resource_id**    | `text`                      | Not Null    | Identifier of the specific resource instance.                               |
| **principal_id**   | `text`                      | Not Null    | Identifier of the principal (user) being assigned the role.                 |
| **role**           | `text`                      | Not Null    | The role being assigned (e.g., 'admin', 'viewer').                          |
| **created**        | `timestamp with time zone`  | Not Null    | Timestamp when the role assignment was created (default: now()).            |
| **deleted**        | `timestamp with time zone`  |             | Timestamp when the role assignment was revoked (soft delete).               |

**Indexes:**

* Composite index on (`resource`, `resource_id`, `principal_id`, `role`, `deleted`).

#### **`invitation`**

**Purpose**: Stores pending and historical invitations to access a resource. A role is only granted after the recipient explicitly accepts the invitation.

| Column | Type | Constraints | Description |
|---|---|---|---|
| **invitation_id** | `text` | Primary Key | Unique identifier for the invitation. |
| **resource** | `text` | Not Null | Resource type being shared (e.g. `farm`). |
| **resource_id** | `text` | Not Null | Identifier of the specific resource instance. |
| **inviter_id** | `text` | Not Null | Principal who created the invitation. |
| **target_email** | `text` | | Email address for invitations to unregistered users. |
| **target_principal_id** | `text` | | Principal ID for invitations to existing users or organizations. |
| **role** | `text` | Not Null | Role to grant on acceptance (`owner`, `advisor`, `researcher`). |
| **status** | `text` | Not Null | Current state: `pending`, `accepted`, `declined`, or `expired`. |
| **expires** | `timestamp with time zone` | Not Null | Expiry cutoff (default: 7 days after creation). |
| **created** | `timestamp with time zone` | Not Null | Timestamp when the invitation was created. |
| **accepted_at** | `timestamp with time zone` | | Timestamp when the invitation was accepted. |

At least one of `target_email` or `target_principal_id` must be set.

**Indexes:**

* Unique partial index on (`resource`, `resource_id`, `target_email`) where `status = 'pending'` — prevents duplicate pending email invitations.
* Unique partial index on (`resource`, `resource_id`, `target_principal_id`) where `status = 'pending'` — prevents duplicate pending principal invitations.

#### **`audit`**

**Purpose**: Logs authorization checks (audit trail) to record who attempted what action on which resource.

| Column                 | Type                        | Constraints | Description                                                                 |
|------------------------|-----------------------------|-------------|-----------------------------------------------------------------------------|
| **audit_id**           | `text`                      | Primary Key | Unique identifier for the audit log entry.                                  |
| **audit_timestamp**    | `timestamp with time zone`  | Not Null    | Timestamp when the audit event occurred (default: now()).                   |
| **audit_origin**       | `text`                      | Not Null    | System or component originating the audit log (e.g., 'api', 'app').         |
| **principal_id**       | `text`                      | Not Null    | Identifier of the principal (user) performing the action.                   |
| **target_resource**    | `text`                      | Not Null    | Type of the resource being acted upon.                                      |
| **target_resource_id** | `text`                      | Not Null    | Identifier of the specific resource instance being acted upon.              |
| **granting_resource**  | `text`                      | Not Null    | Type of the resource through which access was potentially granted.          |
| **granting_resource_id**| `text`                     | Not Null    | Identifier of the specific granting resource instance.                      |
| **action**             | `text`                      | Not Null    | The action being attempted (e.g., 'read', 'update', 'delete').              |
| **allowed**            | `boolean`                   | Not Null    | Whether the action was allowed based on authorization rules.                |
| **duration**           | `integer`                   | Not Null    | Duration of the authorization check in milliseconds.                        |

---

## `fdm-calculator` Schema (Calculator)

This schema is used to cache calculation results and store errors that occur during calculations.

#### **`calculationCache`**

**Purpose**: Caches the results of calculations to improve performance.

| Column | Type | Constraints | Description |
|---|---|---|---|
| **calculation_hash** | `text` | Primary Key | A unique hash representing the calculation function and its input. |
| **calculation_function** | `text` | Not Null | The name of the calculation function that was executed. |
| **calculator_version** | `text` | | The version of the calculator that was used. |
| **input** | `jsonb` | Not Null | The input parameters for the calculation. |
| **result** | `jsonb` | Not Null | The result of the calculation. |
| **created_at** | `timestamp with time zone` | Not Null | Timestamp when the calculation was cached (default: now()). |

#### **`calculationErrors`**

**Purpose**: Logs errors that occur during calculations.

| Column | Type | Constraints | Description |
|---|---|---|---|
| **calculation_error_id** | `text` | Primary Key | Unique identifier for the calculation error. |
| **calculation_function** | `text` | | The name of the calculation function that failed. |
| **calculator_version** | `text` | | The version of the calculator that was used. |
| **input** | `jsonb` | | The input parameters for the calculation. |
| **error_message** | `text` | | The error message. |
| **stack_trace** | `text` | | The stack trace of the error. |
| **created_at** | `timestamp with time zone` | Not Null | Timestamp when the error occurred (default: now()). |

---

## Custom Types

These custom types are defined in `schema-custom-types.ts` to handle specific data representations.

#### **`numericCasted`**

* **Purpose**: A workaround for Drizzle ORM potentially returning `numeric` SQL types as strings. This custom type ensures that numeric values are correctly parsed as numbers (`float`) in the application layer.
* **SQL Type**: `numeric` or `numeric(precision, scale)`
* **Application Type**: `number`
* **Note**: Maps SQL `numeric` to TypeScript `number`. Be aware of potential precision loss for values exceeding JavaScript's `Number.MAX_SAFE_INTEGER` range, though this is rare for agricultural data.

#### **`geometry`**

* **Purpose**: Handles PostGIS `geometry` types, allowing storage and retrieval of GeoJSON-like data.
* **SQL Type**: `geometry` (optionally constrained, e.g., `geometry(Polygon, 4326)`)
* **Application Type**: GeoJSON `Geometry` object (e.g., `Polygon`, `MultiPoint`).
* **Dependencies**: Requires the PostGIS extension enabled in the PostgreSQL database.
* **Current Implementation**: The provided code in `schema-custom-types.ts` includes parsing logic primarily for `Polygon` and `MultiPoint` types when reading from the database (especially from hexewkb format). Writing uses `ST_GeomFromGeoJSON`. Support for other geometry types might be limited or require additional parsing logic.
* **SRID**: Assumes SRID 4326 (WGS 84).
* **Note**: Stored as SRID 4326 (WGS 84). Area and distance calculations should cast to `geography` to account for earth curvature.
