---
title: Organic Matter Balance Calculation
sidebar_label: Organic Matter
---

This document explains how the Soil Organic Matter (SOM) balance is calculated within the FDM Calculator. The balance provides a crucial indicator of soil health by tracking the inputs and losses of organic matter over time. It helps agronomists and farmers assess whether their management practices are maintaining, building, or depleting soil organic matter, which is vital for soil structure, water retention, and nutrient cycling.

## 1. Overview

Soil organic matter is a cornerstone of a healthy and productive agricultural system. It improves soil structure, enhances water and nutrient holding capacity, and supports a diverse community of soil organisms. An organic matter balance helps to quantify the impact of farming practices on SOM levels.

The final organic matter balance for each field is determined by the formula:

```text
OM Balance (kg OM / ha) = Effective OM Supply + OM Degradation
```

Where:

* **Effective OM Supply (EOM):** The portion of applied organic matter that is expected to remain in the soil after one year of decomposition. This includes inputs from fertilizers, cultivations, and residues.
* **OM Degradation:** The amount of existing soil organic matter that is lost through decomposition over the same period. This is a **negative** value.

A positive balance indicates that management practices are contributing to an increase in soil organic matter, while a negative balance suggests a decline. The calculations are performed for a user-defined **Time Frame**.

## 2. Required Input Data

An accurate organic matter balance requires data that captures the key management practices and soil characteristics influencing SOM dynamics.

* **Field Information:** Defines the area for which the balance is calculated.
  * Unique ID, area (ha).
* **Cultivation Data (per field):** The type of crops grown and how their residues are managed are major drivers of OM supply.
  * Crop type (via `b_lu_catalogue`).
  * Crop residue management (`m_cropresidue` flag: `true` if residues are left on the field).
  * Cultivation end date (`b_lu_end`) to determine if residue contribution falls within the timeframe.
* **Soil Analysis Data (per field):** Soil properties are essential for calculating the baseline SOM content and estimating its degradation rate.
  * The system uses the most recent available data for each required parameter.
  * Key parameters used:
    * Soil Organic Matter content (`a_som_loi`, %).
    * Bulk density (`a_density_sa`, g/cm³).
* **Fertilizer Application Data (per field):** Application of organic fertilizers is a direct input of organic matter.
  * Application amount (`p_app_amount`, kg / ha).
  * Link to fertilizer type via `p_id_catalogue`.
* **Catalogue Data:** Standardized values from catalogues provide the necessary parameters for different types of cultivations and fertilizers.
  * `FertilizerCatalogue` (`FertilizerDetail`):
    * Effective Organic Matter content (`p_eom`, g EOM / kg product).
    * Type (`p_type`: "manure", "compost", "other", or "mineral").
  * `CultivationCatalogue` (`CultivationDetail`):
    * Effective Organic Matter from the main cultivation (`b_lu_eom`, kg EOM / ha / year).
    * Effective Organic Matter from crop residues (`b_lu_eom_residue`, kg EOM / ha / year).
    * Crop rotation type (`b_lu_croprotation`) to determine land use (e.g., "grassland").

## 3. Calculation Components

### 3.1. Effective Organic Matter (EOM) Supply (kg EOM / ha)

The EOM supply represents the total amount of organic matter added to the soil that is expected to persist for more than a year. It is the sum of contributions from fertilizers, cultivations, and crop residues.

#### 3.1.1. Fertilizers

Organic fertilizers like manure and compost are significant sources of organic matter.

* **Formula per application:**
    `EOM Supplied (kg EOM / ha) = Amount Applied (kg / ha) * (EOM Content (g EOM / kg) / 1000)`
* The EOM content (`p_eom`) is specific to each fertilizer type and is sourced from the `FertilizerCatalogue`.
* Contributions are summed for each category based on the fertilizer's `p_type`:
  * **Manure**
  * **Compost**
  * **Other** (includes other organic fertilizers; mineral fertilizers typically have no `p_eom` value and are ignored).

#### 3.1.2. Cultivations

This component accounts for the organic matter supplied by the roots and root exudates of the main crops or green manures during their growth period.

* **Source:** The `b_lu_eom` value (kg EOM / ha / year) is taken directly from the `CultivationCatalogue` for each cultivation.
* The values for all cultivations within the timeframe are summed. The current model assumes the full annual value is contributed regardless of the exact duration of the cultivation.

#### 3.1.3. Crop Residues

When crop residues (stems, leaves) are incorporated into the soil after harvest, they decompose and contribute to SOM.

* **Condition:** This supply is only counted if the `m_cropresidue` flag for a cultivation is `true` AND the cultivation's end date (`b_lu_end`) falls within the calculation `Timeframe`.
* **Source:** The `b_lu_eom_residue` value (kg EOM / ha / year) is taken from the `CultivationCatalogue`.
* This represents the estimated EOM contribution from the residues of that specific crop type.

### 3.2. Organic Matter Degradation (kg OM / ha)

Organic matter degradation is the natural process of decomposition of SOM by soil microorganisms. The rate of this process is influenced by soil type, management, and climate.

* **Method:**
    1. **Land Use Determination:** The system first determines if the land is `grassland` or `arable land` based on the `b_lu_croprotation` property of the cultivations present.
    2. **Soil Depth:** A different active soil depth is used for the calculation based on land use:
        * Grassland: `0.1` meters (10 cm)
        * Arable Land: `0.3` meters (30 cm)
    3. **Temperature Correction:** A correction factor is calculated to adjust the degradation rate based on the average yearly temperature (currently a constant of 11.7°C is used).
        `TempCorrection = 2 ^ ((AvgTemp - 13) / 10)`
    4. **Annual Degradation Formula:** The annual rate of degradation is calculated using an empirical formula that incorporates soil properties and the correction factors.
        `Annual Degradation = a_som_loi * b_depth * a_density_sa * (ln(a_som_loi) * -0.008934 + 0.038228) * TempCorrection`
    5. **Capping:** The calculated annual degradation is capped at a maximum of `3500` kg OM/ha/year to prevent unrealistic values.
        6. **Total Degradation:** The annual degradation rate is multiplied by the number of years in the calculation `Timeframe` to get the total degradation for the period. The result of this calculation is then multiplied by -1 to represent a loss from the system.

    *Note: The degradation formula is based on models developed for specific regions (e.g., Flanders, Belgium). The dimensional consistency of the empirical formula should be considered within the context of its source.*

  ## 4. Field and Farm Level Balance

  * **Field Balance:** For each field, the balance is calculated as:
        `OM Balance = Total EOM Supply + Total OM Degradation`
* **Farm Balance:**
    1. The total EOM supply and OM degradation for each field are weighted by the field's area (e.g., `supply_kg_per_field = supply_kg_per_ha * area_ha`).
    2. These weighted totals are summed across all fields that were successfully calculated.
    3. The total farm supply and degradation (in kg) are then divided by the total area of the calculated fields to provide an average farm-level balance in kg/ha.

## 5. Output

The final output (`OrganicMatterBalanceNumeric`) is a numeric representation of the balance and includes:

* Overall farm-level `balance`, `supply`, and `degradation` (in kg/ha).
* A list of `fields`, where each entry (`OrganicMatterBalanceFieldResult`) contains:
  * Field ID and area.
  * The field-specific `balance` (in kg/ha).
  * A detailed breakdown of `supply` (total, and by fertilizers, cultivations, and residues).
  * A breakdown of `degradation` (total).
  * An `errorMessage` if the calculation for that field failed.

All final values are rounded to the nearest whole number.
