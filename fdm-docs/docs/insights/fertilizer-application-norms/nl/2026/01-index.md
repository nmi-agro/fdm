---
title: 2026 Dutch Fertilizer Application Norms
sidebar_label: "Overview"
position: 1
---

This guide explains how the FDM Calculator determines the official Dutch legal usage norms (`gebruiksnormen`) for 2026. These calculations are essential for ensuring your farm management plan complies with national environmental regulations.

The FDM Calculator automates these complex calculations based on your specific farm, field, and cultivation data. For 2026 it calculates four key norms:

- **[Nitrogen Usage Norm (`Stikstofgebruiksnorm`)](./stikstofgebruiksnorm.md):** This norm sets the maximum total effective nitrogen (in kg N/ha) that can be applied to a field. The calculation takes into account the main crop, the geographical location (including `NV-gebieden`), and the soil region.
- **[Phosphate Usage Norm (`Fosfaatgebruiksnorm`)](./fosfaatgebruiksnorm.md):** This norm defines the maximum amount of phosphate (in kg P₂O₅ per hectare) that can be applied to a parcel of land. The maximum is determined by the land use type (grassland or arable land) and the phosphate status of the soil.
- **[Animal Manure Usage Norm (`Dierlijke Mest Gebruiksnorm`)](./dierlijke-mest-gebruiksnorm.md):** This norm defines the maximum nitrogen from animal manure (in kg N/ha) that can be applied.
- **[Renure Usage Norm (`Renure Gebruiksnorm`)](./renure-gebruiksnorm.md):** New in 2026. Renure products have their own ceiling on top of the animal manure norm.

For more detailed information on these norms, please refer to the specific pages for each one.

:::warning
The calculations in this document are based on the 2026 norms published by the RVO (Rijksdienst voor Ondernemend Nederland). While we strive for accuracy, this document is for informational purposes only.

Always consult your agricultural advisor for definitive guidance and values tailored to your specific situation. FDM is not liable for any discrepancies or decisions made based on this information.
:::

## What Changed Compared to 2025

Three changes matter most when moving from the 2025 to the 2026 norms.

### 1. Derogation Has Ended

Derogation was phased out after 2025. For 2026 the animal manure norm is a flat **170 kg N/ha** for every farm, and derogation status is no longer an input to any norm. As a consequence:

- The farm no longer supplies a derogation status; only the **grazing intention** (`has_grazing_intention`) is used, and only to pick the grassland norm variant.
- The grassland renewal periods on clay and peat no longer vary by derogation status.

### 2. Renure Is Recognised

**Renure** ("REcovered Nitrogen from manURE", RVO manure codes 130–134) is legally recognised from 2026. It is exempt from the 170 kg N/ha animal manure norm and has its own ceiling of **80 kg N/ha on top of it**, while still counting in full toward the nitrogen and phosphate norms. See [Renure Usage Norm](./renure-gebruiksnorm.md).

### 3. Catch Crop Rules Are Evaluated per Crop Code

The catch crop (`vanggewas`) and winter crop (`winterteelt`) rules that reduce the nitrogen norm are evaluated per crop code and anchored to the **previous** year's main crop. For the 2026 norm the calculator therefore examines the **2025** growing season. See [Nitrogen Usage Norm](./stikstofgebruiksnorm.md).

:::info
The catch crop assessed for the 2026 norm was sown in autumn 2025, under the 7th Action Programme Nitraatrichtlijn. The requirement that the catch crop stands until **1 February** therefore applies to the 2026 norm, as it did to 2025.

A shorter standing period is among the measures proposed for the 8th Action Programme, but that programme has been postponed. Until it is adopted and in force, 1 February remains the applicable date; do not change it in anticipation.
:::

## How the Calculator Works: Required Data

To calculate the norms for a specific field, the FDM Calculator requires the following information.

- **Farm Details**:
  - **Grazing Intention**: Whether the grassland is grazed or fully mown. This selects the grassland variant of the nitrogen norm. Derogation status is no longer required.

- **Field & Location**:
  - **Field Location**: The precise geographical coordinates of the field are used to determine if it falls within special regulatory zones, such as Nutrient-Polluted Areas (`NV-gebieden`), and its soil region (sand, clay, peat, loess).
  - **Buffer Strip**: A field marked as a buffer strip (`b_bufferstrip`) receives a norm of 0 for all four norms.

- **Cultivation Plan for 2026**:
  - **Main Crop (`hoofdteelt`)**: The primary crop grown on the field. The calculator identifies the main crop as the one with the longest cultivation period between May 15th and July 15th.
  - **Crop Variety**: For certain crops like potatoes and flowers, the specific variety can result in a higher or lower nitrogen norm.
  - **Cultivation Dates**: The start and end dates of cultivation are crucial for time-sensitive norms, such as those for temporary grassland.

- **Cultivation Plan for 2025 (the previous year)**:
  - **Main Crop and Catch Crops**: The nitrogen norm is reduced when the catch crop or winter crop obligation was not met after the previous year's main crop. The calculator reads cultivations from 1 January 2025 onwards.
  - **Sowing and End Dates**: The sowing date of the catch crop determines the size of the reduction, and its end date shows whether it stood until 1 February 2026. For sugar and fodder beet the harvest date decides whether the crop counts as a winter crop at all.

  Without the previous year's cultivations, a compliant field cannot be distinguished from a non-compliant one and the maximum reduction may be applied.

- **Latest Soil Analysis Data**:
  - **Phosphate Levels**: The P-CaCl₂ (or P-PAE) and P-Al values from your most recent soil test are used to classify the soil's phosphate status, which directly determines the phosphate usage norm.
