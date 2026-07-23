---
title: Fosfaatgebruiksnorm 2025
sidebar_label: "Fosfaatgebruiksnorm"
---

This document provides a detailed explanation of the Dutch legal usage norm (`gebruiksnorm`) for phosphate in 2025. It covers how the norm is calculated and how the amount of applied phosphate counts towards this norm (`opvulling`), with a special focus on the regulations for organic-rich fertilizers as introduced in the 7th Action Programme Nitraatrichtlijn.

---

## Calculating the Gebruiksnorm (Usage Norm)

### How the Norm Works

The phosphate usage norm defines the maximum amount of phosphate (in kg P₂O₅ per hectare) that can be applied to a parcel of land. This maximum is determined by two key factors: the **land use type** and the **phosphate status of the soil**.

The process involves three steps:

1. **Determine Land Type**: First, the land is classified as either **`grasland`** (grassland) or **`bouwland`** (arable land) based on the main crop.
2. **Determine Phosphate Class**: Based on a recent soil analysis (using P-CaCl₂ and P-Al values), the soil is assigned a phosphate class. The classes range from `Arm` (Poor) to `Hoog` (High). The specific thresholds for each class differ for grassland and arable land.
3. **Look Up the Final Norm**: The combination of land type and phosphate class determines the final usage norm, as shown in the official table below.

| Klasse   | Grasland (kg P₂O₅/ha) | Bouwland (kg P₂O₅/ha) |
| :------- | :-------------------- | :-------------------- |
| Arm      | 120                   | 120                   |
| Laag     | 105                   | 80                    |
| Neutraal | 95                    | 70                    |
| Ruim     | 90                    | 60                    |
| Hoog     | 75                    | 40                    |

The result of this calculation is the maximum allowable phosphate application for the parcel.

### How the FDM Calculator Determines the Norm

The `fdm-calculator` uses the `calculatePhosphateUsageNorm` function, located in `fdm-calculator/src/norms/nl/2025/value/fosfaatgebruiksnorm.ts`.

This function requires the following inputs, defined in `input.ts`:

- **Main Crop**: To determine if the land is `grasland` or `bouwland`.
- **Soil Analysis Data**: The latest P-CaCl₂ and P-Al values.

The core logic uses `fosfaatgebruiksnorm-data.ts`, which contains the official thresholds for phosphate classes and the corresponding norm values for both grassland and arable land.

---

## Calculating the Opvulling (Filling)

### How the Filling Works

The "filling" (`opvulling`) refers to how much of the applied phosphate counts towards the usage norm. While most fertilizers count for 100% of their phosphate content, the Dutch government encourages the use of **organic-rich fertilizers** (`Organische Stofrijke meststoffen`) to improve soil quality. To stimulate their use, these fertilizers count for a lower percentage of their phosphate content.

#### Differentiated Percentages for Organic-Rich Fertilizers

The phosphate in qualifying organic-rich fertilizers counts towards the usage norm according to the following differentiated percentages:

- **25% of phosphate counts for:**
  - GFT-compost
  - Groencompost (Green compost)

- **75% of phosphate counts for:**
  - Vaste strorijke mest van rundvee (Straw-rich solid manure from cattle)
  - Vaste strorijke mest van varkens (only for organic farms) (Straw-rich solid manure)
  - Vaste strorijke mest van schapen (Straw-rich solid manure from sheep)
  - Vaste strorijke mest van geiten (Straw-rich solid manure from goats)
  - Vaste strorijke mest van paarden (Straw-rich solid manure from horses)
  - Champost

- **100% of phosphate counts for:**
  - All other fertilizers, including mineral fertilizers and other organic fertilizers not listed above.

#### Conditions for Differentiated Percentages

To use these lower percentages, two important conditions must be met:

1. **Minimum Application**: At least **20 kg P₂O₅ per hectare** of a specific organic-rich fertilizer must be applied. This ensures the application is substantial enough to contribute to soil improvement.
2. **Maximum for Differentiated Calculation**: The differentiated percentage (25% or 75%) applies only to the amount of phosphate **up to the parcel's maximum usage norm**. If you apply more phosphate from an organic-rich source than the norm allows, the excess amount counts for **100%**.

#### Calculation Examples

**Example 1: Standard Application**

- **Parcel**: Arable land, phosphate status `Ruim`.
- **Norm**: 60 kg P₂O₅/ha.
- **Application**: 10 tons/ha of straw-rich cattle manure (forfaitair: 3.2 kg P₂O₅/ton).

1. **Total Phosphate Applied**: `10 ton/ha × 3.2 kg P₂O₅/ton = 32 kg P₂O₅/ha`.
2. **Check Conditions**:
   - The applied amount (32 kg) is > 20 kg (minimum met).
   - The applied amount (32 kg) is < 60 kg (norm).
   - The 75% rule applies.
3. **Calculate Filling**: `32 kg P₂O₅/ha × 75% = 24 kg P₂O₅/ha`.
   - **Result**: Only **24 kg** counts towards the 60 kg norm, leaving **36 kg** of usage room.

**Example 2: High Application of Compost**

- **Parcel**: Grassland, phosphate status `Arm`.
- **Norm**: 120 kg P₂O₅/ha.
- **Application**: 210 kg P₂O₅/ha from green compost.

1. **Check Conditions**:
   - The applied amount (210 kg) is > 20 kg (minimum met).
   - The differentiated percentage of 25% applies up to the norm of 120 kg.
2. **Calculate Filling**:
   - **Part 1 (up to the norm)**: `120 kg P₂O₅/ha × 25% = 30 kg P₂O₅/ha`.
   - **Part 2 (above the norm)**: The remaining phosphate is `210 kg - 120 kg = 90 kg`. This amount counts for 100%.
   - **Total Filling**: `30 kg + 90 kg = 120 kg P₂O₅/ha`.
   - **Result**: The total filling is **120 kg**, which meets the 120 kg norm exactly.

### How the FDM Calculator Determines the Filling

The `fdm-calculator` uses the `calculatePhosphateFilling` function, located in `fdm-calculator/src/norms/nl/2025/filling/fosfaatgebruiksnorm.ts`.

This function processes a list of fertilizer applications and implements the following logic:

1. It identifies which fertilizers are classified as organic-rich and determines their applicable percentage (25% or 75%).
2. For each application of an organic-rich fertilizer, it checks if the **20 kg P₂O₅/ha minimum** is met.
3. It calculates the filling by applying the differentiated percentage to the phosphate amount that falls **within the usage norm**.
4. Any phosphate from an organic-rich fertilizer applied **above the usage norm** is counted at 100%.
5. All other fertilizers are always counted at 100%.

The function sums the calculated filling from all applications to provide the total phosphate filling for the parcel.
