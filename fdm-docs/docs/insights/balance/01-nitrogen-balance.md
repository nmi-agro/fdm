---
title: Nitrogen Balance
sidebar_label: Nitrogen Balance
---

This document explains how the nitrogen (N) balance is calculated within the FDM Calculator. The balance provides insights into nitrogen inputs, outputs, and potential surpluses or deficits on a per-field basis, which are then aggregated to the farm level. It serves as a critical tool for agronomists and farmers to optimize nutrient management, enhance crop productivity, and minimize environmental impacts.

## 1. Overview

Nitrogen is a macronutrient essential for plant growth, playing a vital role in photosynthesis, protein synthesis, and overall crop development. However, nitrogen is also highly dynamic in agricultural systems, subject to various inputs, outputs, and transformations. An accurate nitrogen balance helps in understanding the nitrogen cycle on a farm, identifying potential nutrient deficiencies or surpluses, and guiding sustainable fertilization practices.

The final nitrogen balance for each field is determined by the formula:

```text
N Balance (kg N / ha) = N Supply - N Removal - N-NH3 Emission
```

Where:

- **N Supply:** Nitrogen added to the field.
- **N Removal:** Nitrogen taken off the field.
- **N-NH3 Emission:** Nitrogen lost to the environment due to ammonia volatilization.

(Note: In the calculation, N Removal and N-NH3 Emission are typically treated as negative values when summing components to derive the final balance.)

The calculations are performed for a user-defined **Time Frame**.

## 2. Required Input Data

Accurate N balance calculation relies on comprehensive input data that captures the various aspects of farm management and environmental conditions influencing nitrogen dynamics.

- **Field Information:** Essential for defining the spatial and temporal boundaries of the calculation. Field area is used for scaling, and centroid coordinates are crucial for location-specific environmental data like atmospheric deposition.
  - Unique ID, area (ha), centroid coordinates (for deposition).
  - Start and end dates defining the field's existence (if different from the balance time frame).
- **Cultivation Data (per field):** Crop type significantly influences nitrogen demand, uptake patterns, and potential for biological nitrogen fixation. Residue management dictates whether nitrogen in crop residues is returned to the soil or removed from the field.
  - Crop type (via `b_lu_catalogue` linking to `CultivationCatalogue`).
  - Crop residue management (`m_cropresidue` flag: true if residues removed, false / null if incorporated).
- **Harvest Data (per field):** Harvested products represent the primary pathway of nitrogen removal from the field. Accurate yield and nitrogen content data are critical for quantifying this export.
  - Links to the specific `b_lu` (cultivation instance).
  - `harvestable_analyses` array containing:
    - Yield of harvested product (`b_lu_yield`, kg / ha).
    - N content of harvested product (`b_lu_n_harvestable`, g N / kg product).
    - (If these are not in `harvestable_analyses`, defaults from `CultivationCatalogue` are used).
- **Soil Analysis Data (per field):** Soil properties are fundamental to understanding the inherent nitrogen supply capacity of the soil (e.g., through mineralization) and its ability to retain or lose nitrogen.
  - Multiple analyses can be provided. The system uses the most recent available data for each parameter.
  - Key parameters used:
    - Agricultural soil type (`b_soiltype_agr`).
    - Total N content (`a_n_rt`, mg N / kg).
    - Organic carbon (`a_c_of`, g C / kg).
    - C / N ratio (`a_cn_fr`).
    - Bulk density (`a_density_sa`, g / cm³).
    - Soil Organic Matter (SOM) by Loss on Ignition (`a_som_loi`, %).
  - If some parameters are missing, they may be estimated (see Section 3.1.4.1).
- **Fertilizer Application Data (per field):** These represent direct, managed inputs of nitrogen to the field, crucial for meeting crop nutrient demands.
  - Application amount (`p_app_amount`, kg / ha).
  - Link to fertilizer type via `p_id_catalogue`.
- **Catalogue Data:** Standardized data from catalogues ensures consistency and provides default values for various crop and fertilizer characteristics, which are essential for modeling when specific field-level data is unavailable.
  - `FertilizerCatalogue` (`FertilizerDetail`):
    - Total N content (`p_n_rt`, g N / kg).
    - Nitrate content (`p_no3_rt`, g N / kg)
    - Ammonium content (`p_nh4_rt`, g N/ kg)
    - Sulfur content (`p_s_rt`, g SO3 / kg)
    - Type flag: `p_type` ("manure", "mineral", "compost" or `null`).
  - `CultivationCatalogue` (`CultivationDetail`):
    - Default yield (`b_lu_yield`, kg / ha).
    - Default N content of harvestable product (`b_lu_n_harvestable`, g N / kg).
    - N content of crop residue (`b_lu_n_residue`, g N / kg residue).
    - Harvest Index (`b_lu_hi`, fraction).
    - Biological N fixation rate (`b_n_fixation`, kg N / ha / year for the crop).

## 3. Calculation Components

### 3.1. Nitrogen Supply (kg N / ha)

Nitrogen supply encompasses all pathways by which nitrogen becomes available to the crop and the soil system. Understanding these inputs is crucial for optimizing nutrient management and ensuring adequate nitrogen for crop growth while minimizing environmental losses.

Total N supply is the sum of N from fertilizers, biological fixation, atmospheric deposition, and soil mineralization.

#### 3.1.1. Fertilizers

Fertilizers are a primary and often controlled source of nitrogen input in agricultural systems, applied to meet specific crop nutrient demands. Different fertilizer types have varying nitrogen forms and release characteristics.

- **Formula per application:**
  `N_supplied (kg N / ha) = Amount_applied (kg / ha) * (Total_N_content (g N / kg)  /  1000)`
- Contributions are summed for each category:
  - **Mineral Fertilizers:** Mineral fertilizers providing readily available nitrogen (e.g., urea, ammonium nitrate).
  - **Manure:** Organic fertilizers derived from animal feces, providing both readily available and slowly mineralizing nitrogen.
  - **Compost:** Stabilized organic matter, releasing nitrogen slowly over time as it decomposes.
  - **Other Fertilizers:** Any other types of fertilizers not classified as mineral, manure, or compost.

#### 3.1.2. Biological Fixation

Biological nitrogen fixation is a natural process where atmospheric nitrogen (N2) is converted into plant-available forms (e.g., ammonia) by microorganisms, primarily symbiotic bacteria associated with leguminous crops (e.g., clover, beans, peas). This process significantly contributes to the nitrogen supply in agricultural ecosystems, reducing the need for mineral nitrogen fertilizers.

- **Source:** The `b_n_fixation` value (kg N / ha for the specific crop) is taken directly from the `CultivationCatalogue` for each cultivation present. This value represents the estimated net nitrogen input from fixation for that crop type.
- These values are summed if multiple N-fixing crops are involved.

#### 3.1.3. Atmospheric Deposition

Atmospheric deposition refers to the input of nitrogen compounds from the atmosphere to the Earth's surface. This occurs through both wet deposition (e.g., nitrogen dissolved in rain, snow) and dry deposition (e.g., gaseous ammonia, nitric acid vapor, particulate matter). These deposited nitrogen forms can be utilized by plants, thus contributing to the overall nitrogen supply in the field.

- **Method:**
  1. The system uses the field's centroid coordinates to pinpoint its geographical location.
  2. It queries a GeoTIFF raster file for annual total N deposition. This raster dataset provides spatially explicit annual nitrogen deposition rates.
     - Currently uses data for the Netherlands, year 2022 (`nl/ntot_2022.tiff` from RIVM, via FDM public data URL).
  3. The annual deposition rate (kg N / ha / year) for the field's specific location is extracted.
  4. This annual rate is pro-rated for the balance `Time Frame` to reflect the actual period of calculation:
     `Deposition_period (kg N / ha) = Annual_Deposition (kg N / ha / year) * (Days_in_TimeFrame + 1)  /  365`

#### 3.1.4. Soil Mineralization

Soil mineralization is a crucial biological process where organic nitrogen (N) compounds in soil organic matter (SOM) are converted by microorganisms into inorganic, plant-available forms, primarily ammonium (NH4+). This process can be a source of nitrogen for crops. The calculation of nitrogen mineralization is based on default values that depend on the soil type and land use (grassland or arable land).

- **Method:**
  1. The calculation is performed for each year within the specified `TimeFrame`.
  2. For each year, the system determines if the field is considered "grassland" or "arable land". A field is considered "grassland" for a given year if it has a cultivation with a crop rotation code corresponding to grassland (e.g., BRP code 265) that is active between May 15th and July 15th of that year. Otherwise, it is considered "arable land".
  3. Based on the soil type (`b_soiltype_agr`) and whether the field is grassland, a default annual N mineralization rate (kg N / ha / year) is assigned:

| Soil Type (`b_soiltype_agr`) | Land Use            | Annual N Mineralization (kg N / ha / year) |
| :--------------------------- | :------------------ | :----------------------------------------- |
| `dalgrond`                   | Arable or Grassland | 20                                         |
| `veen`                       | Grassland           | 160                                        |
| `veen`                       | Arable Land         | 20                                         |
| Other                        | Arable or Grassland | 0                                          |

    4.  The annual mineralization rate is then pro-rated for the number of days the field is active within the `TimeFrame` for that year:
        `Mineralization_period (kg N / ha) = Annual_N_Min (kg N / ha / year) * Days_in_TimeFrame_for_the_year / 365`

### 3.2. Nitrogen Removal (kg N / ha)

Nitrogen removal accounts for the nitrogen that leaves the field system, primarily through the harvest of crops and the removal of crop residues. Quantifying these outputs is essential for understanding the net nitrogen balance and assessing nutrient cycling efficiency. These are calculated as negative values in the balance equation.

#### 3.2.1. Harvested Products

The harvest of crops is typically the largest pathway for nitrogen removal from agricultural fields. Nitrogen is assimilated by plants during growth and stored in various plant parts, including the economically valuable harvested portion (e.g., grain, tubers, forage).

- **Formula per harvest:**
  `N_removed (kg N / ha) = Yield (kg / ha) * N_Content_Harvestable (g N / kg) / 1000 * -1`
- Yield and N content are taken from `HarvestableAnalysis` if available, otherwise from `CultivationCatalogue` defaults. Using actual analysis data provides a more precise estimate of N removal.
- If a harvest event has multiple analyses (e.g., for different components of the harvested product), their N removal values are averaged.

#### 3.2.2. Crop Residues

Crop residues (e.g., straw, stover, roots) contain significant amounts of nitrogen. Their management is crucial for the field's nitrogen balance. If residues are removed from the field (e.g., for animal feed, bedding, or bioenergy), the nitrogen contained within them is considered a removal from the field system. If residues are left on the field and incorporated into the soil, their nitrogen contributes to the soil organic matter pool and will be subject to mineralization.

- **Nitrogen Removal Condition:** Nitrogen is considered removed by crop residues only if the `m_cropresidue` flag is true for the cultivation, indicating that residues are indeed taken off the field.
- **Residue Mass Estimation:** 1. Average yield for the cultivation is determined (from actual harvests or catalogue default). 2. Harvest Index (`b_lu_hi`) is from `CultivationCatalogue`. The Harvest Index is the ratio of harvested biomass to total above-ground biomass. 3. Residue Proportion = `1 - b_lu_hi`. This represents the fraction of total above-ground biomass that remains as residue. 4. `Residue_Mass (kg / ha) = Average_Yield (kg / ha) * Residue_Proportion`.
- **N Content of Residue:** `b_lu_n_residue` (g N / kg residue) from `CultivationCatalogue`. This value represents the typical nitrogen concentration in the crop residues for a given crop type.
- **Formula per cultivation:**
  `N_removed_residue (kg N / ha) = Residue_Mass (kg / ha) * N_Content_Residue (g N / kg) / 1000 * -1`

### 3.3. Nitrogen Emission (kg N / ha)

Nitrogen emission refers to the loss of nitrogen from the agricultural system to the wider environment. This includes losses to the atmosphere, such as ammonia (NH₃) volatilization, and losses to water, such as nitrate (NO₃⁻) leaching. Accurately quantifying these emissions is crucial for improving nitrogen use efficiency and minimizing environmental impacts like air and water pollution.

The total N emission is the sum of all calculated emission pathways. This includes ammonia emissions from fertilizers and crop residues, and nitrate leaching to groundwater.

The calculations for ammonia emissions are derived from the **NEMA model (Nutrient Emission Model for Agriculture)**, a Dutch model used to estimate nutrient losses from agricultural sources.

#### 3.3.1. Nitrate Leaching

Nitrate leaching represents the loss of nitrogen to water bodies (groundwater). In the FDM Calculator, this is calculated as a fraction of the **Nitrogen Surplus**. The surplus is defined as `N Supply - N Removal - Ammonia Emission`. This approach acknowledges that leaching is primarily driven by the excess nitrogen that remains in the soil.

- **Formula:**
  `NO3 Leaching (kg N / ha) = Nitrogen Surplus (kg N / ha) * Leaching Factor * -1`
  - _Note: Leaching is only calculated if the Nitrogen Surplus is positive. If the surplus is negative or zero, leaching is 0._

- **Leaching Factor:**
  The leaching factor is determined based on the **Land Use** (Grassland vs. Cropland), **Agricultural Soil Type** (`b_soiltype_agr`), and for sandy soils, the **Groundwater Level Class (Gt)** (`b_gwl_class`).
  1. **Land Use Determination:**
     - **Grassland:** If the field has a cultivation with a grassland crop rotation code (and is not a "bare soil" type).
     - **Cropland:** If the field has a cultivation with a cropland crop rotation code (and is not a "bare soil" type) and no grassland cultivation.
     - **Bare Soil:** If neither of the above, or if the crop code is specifically for bare soil/fallow.

  2. **Factor Determination:**

  | Soil Type                                                         | Land Use  | Gt (Groundwater Level)                 | Leaching Factor (Fraction) |
  | :---------------------------------------------------------------- | :-------- | :------------------------------------- | :------------------------- |
  | **Peat** (veen)                                                   | Grassland | All                                    | 0.06                       |
  |                                                                   | Cropland  | All                                    | 0.17                       |
  | **Clay** (klei, e.g. moerige_klei, rivierklei, zeeklei, maasklei) | Grassland | All                                    | 0.11                       |
  |                                                                   | Cropland  | All                                    | 0.33                       |
  | **Loess** (loess)                                                 | Grassland | All                                    | 0.14                       |
  |                                                                   | Cropland  | All                                    | 0.74                       |
  | **Sand** (zand, e.g. dekzand, dalgrond, duinzand)                 | Grassland | I, Ia, Ic, II, IIa, IIb, IIc           | 0.02                       |
  |                                                                   |           | III, IIIa                              | 0.03                       |
  |                                                                   |           | IIIb                                   | 0.10                       |
  |                                                                   |           | IV, IVu, IVc                           | 0.14                       |
  |                                                                   |           | V, Va, Vao, Vad, Vb, Vbo, Vbd, sV, sVb | 0.16                       |
  |                                                                   |           | VI, VIo, VId                           | 0.21                       |
  |                                                                   |           | VII, VIIo, VIId                        | 0.27                       |
  |                                                                   |           | VIII, VIIIo, VIIId                     | 0.32                       |
  | **Sand** (zand)                                                   | Cropland  | I, Ia, Ic, II, IIa, IIb, IIc           | 0.04                       |
  |                                                                   |           | III, IIIa                              | 0.07                       |
  |                                                                   |           | IIIb                                   | 0.28                       |
  |                                                                   |           | IV, IVu, IVc                           | 0.38                       |
  |                                                                   |           | V, Va, Vao, Vad, Vb, Vbo, Vbd, sV, sVb | 0.44                       |
  |                                                                   |           | VI, VIo, VId                           | 0.58                       |
  |                                                                   |           | VII, VIIo, VIId                        | 0.74                       |
  |                                                                   |           | VIII, VIIIo, VIIId                     | 0.89                       |

#### 3.3.2. Ammonia from Fertilizers

Ammonia emissions from fertilizers are calculated differently depending on the fertilizer type.

- **Manure, Compost, and Other Organic Fertilizers:**
  For these organic fertilizers, the emission is calculated based on the Total Ammoniacal Nitrogen (TAN) content, as this is the amount of nitrogen that is readily available for volatilization.
  - **Formula:**
    `NH3 Emission (kg N / ha) = Application Amount (kg / ha) * TAN Content (g N / kg) / 1000 * Emission Factor (fraction)`
    Where:
    - `Application Amount`: `p_app_amount` (kg / ha) - The total amount of fertilizer applied.
    - `TAN Content`: `p_nh4_rt` (g N / kg) - The amount of total nitrogen that is in ammoniacal form.
    - `Emission Factor`: A dimensionless factor representing the proportion of TAN that is volatilized as ammonia. This factor is determined by the application method and the type of land (grassland, cropland, or bare soil) at the time of application.

  - **Emission Factors for Manure and Compost:**

        | Application Method    | Grassland | Cropland | Bare Soil |
        | :-------------------- | :-------- | :------- | :-------- |
        | Broadcasting          | 0.68      | N/A      | 0.69      |
        | Narrowband            | 0.264     | 0.36     | 0.36      |
        | Slotted Coulters      | 0.217     | N/A      | 0.30      |
        | Shallow Injection     | 0.17      | 0.24     | 0.25      |
        | Incorporation         | N/A       | N/A      | 0.22      |
        | Incorporation 2 Tracks| N/A       | N/A      | 0.46      |

        *Note: "N/A" indicates that the method is not typically used or supported for that land type in the calculation model, and will result in an error if attempted.*

- **Mineral Fertilizers:**
  For mineral fertilizers, the emission is calculated based on the **total nitrogen content (`p_n_rt`)** of the fertilizer and the **emission factor**.
  - **Formula:**
    `NH3 Emission (kg N / ha) = Application Amount (kg / ha) * Total N Content (g N / kg) * Emission Factor (fraction)`
    Where:
    - `Application Amount`: `p_app_amount` (kg / ha).
    - `Total N Content`: `p_n_rt` (g N / kg).
    - `Emission Factor`: `p_ef_nh3` (fraction). This factor can be directly provided in the `FertilizerDetail`. If it is not provided, it is calculated using an empirical formula based on the fertilizer's composition:

      `Emission Factor = p_n_org^2 * K_1 + p_no3_rt * p_s_rt * K_2 + p_nh4_rt^2 * K_3`

      Where:

    - `p_n_org`: Organic nitrogen content (calculated as `p_n_rt - p_no3_rt - p_nh4_rt`).
    - `p_no3_rt`: Nitrate content.
    - `p_nh4_rt`: Ammonium content (TAN).
    - `p_s_rt`: Sulfur content.
    - `K_1`, `K_2`, `K_3`: Empirical constants.
      - If an inhibitor is present: `K_1 = 3.166 * 10^-5`
      - If no inhibitor: `K_1 = 7.021 * 10^-5`
      - `K_2 = -4.308 * 10^-5`
      - `K_3 = 2.498 * 10^-4`
        _Note: Currently, the presence of an inhibitor (`p_inhibitor`) is hardcoded to `false` in the calculation._

#### 3.3.3. Ammonia from Crop Residues

Ammonia emissions from crop residues occur when residues are left on the field and decompose, releasing nitrogen compounds that can volatilize. The calculation of these emissions is based on the amount of nitrogen in the crop residues and a specific emission factor.

- **Formula per cultivation:**
  `NH3 Emission (kg N / ha) = Residue N Content (kg N / ha) * Emission Factor (fraction)`
  Where:
  - `Residue N Content`: The amount of nitrogen contained in the crop residues left on the field. This is derived from the `Residue_Mass` (calculated in Section 3.2.2) and the `N_Content_Residue` (`b_lu_n_residue` from `CultivationCatalogue`).
  - `Emission Factor`: This factor is calculated based on the nitrogen content of the crop residue in g/kg dry matter (`b_lu_n_residue`).

  - **Emission Factor Formula:**
    `Emission Factor = (0.41 * b_lu_n_residue (g/kg dry matter)) - 5.42`
    Where:
    - `b_lu_n_residue`: Nitrogen content of the crop residue in grams per kilogram of dry matter (`b_lu_n_residue` from `CultivationCatalogue`).

_Note: Ammonia emissions from crop residues are only calculated if the `m_cropresidue` flag is `false` or `null`, indicating that residues are incorporated into the soil rather than removed._

#### 3.3.4. Ammonia from Grazing

Ammonia emissions from grazing are currently not calculated in the FDM Calculator and are set to `0`.

## 4. Field and Farm Level Balance

- **Field Surplus (Field Balance):** For each field, the **N Surplus** is calculated as `N Supply - N Removal - Ammonia Emission`. This value is reported as the `balance` for each field in the output.
- **Farm Balance:**
  1. The total N supplied, removed, and total emitted (including ammonia and nitrate) for each field (kg N / ha \* field area (ha) = kg N per field) are summed across all fields.
  2. These total farm-level amounts (in kg N) are then divided by the total farm area (ha) to provide an average farm-level balance (`N Supply - N Removal -  Ammonia Emission`) in kg N / ha.

## 5. Output

The final output (`NitrogenBalanceNumeric`) provides:

- Overall farm balance, supply, removal, and total emission (kg N / ha).
- A list of balances for each field (`NitrogenBalanceFieldNumeric`), which includes:
  - Field ID.
  - Field-specific **N Surplus** (reported as `balance`, in kg N / ha). This is calculated as `N Supply - N Removal - Ammonia Emission`.
  - Supply breakdown (total, fertilizers by type, fixation, deposition, mineralization).
  - Removal breakdown (total, harvests, residues).
  - Emission breakdown (total, plus sub-components for ammonia and nitrate).

All values are rounded numbers.
