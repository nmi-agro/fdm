---
title: Stikstofgebruiksnorm 2025
sidebar_label: "Stikstofgebruiksnorm"
---

This document provides a detailed explanation of the Dutch legal usage norm (`gebruiksnorm`) for nitrogen in 2025. It covers how the norm is calculated, the rules for catch crops and winter crops, and how the applied nitrogen counts towards this norm (`opvulling`).

---

## Calculating the Gebruiksnorm (Usage Norm)

### How the Norm Works

The nitrogen usage norm sets the maximum total effective nitrogen (in kg N/ha) that can be applied to a field. The calculation follows a step-by-step process to find the most precise norm based on various factors.

#### Calculation Steps

1. **Identify Main Crop**: The main crop for 2025 is determined from your cultivation plan.
2. **Determine Geographical Context**: The field's location is used to check:
    * If it is in a **Nutrient-Polluted Area (`NV-gebied`)**, which results in a stricter (lower) norm.
    * The dominant **soil region** (`zand_nwc`, `zand_zuid`, `klei`, `veen`, or `loess`).
3. **Find the Standard Norm**: The main crop is looked up in the official RVO Table 2 (or Tabel 2g for NV-gebieden).
4. **Apply Specific Rules**: The standard norm is refined with additional rules for certain crops:
    * **Temporary Grassland (`Tijdelijk grasland`)**: The norm is adjusted based on the cultivation end date.
    * **Potatoes (`Aardappelen`)**: The norm is adjusted based on the potato variety. See [RVO Tabel 2c](https://www.rvo.nl/sites/default/files/2024-12/Tabel-2c-Consumptieaardappelen%20hoge%20of%20lage%20norm-2025.pdf).
    * **Maize (`Maïs`)**: The norm depends on the farm's derogation status.
    * **Outdoor Flowers (`Buitenbloemen`)**: A higher norm is applied for specific varieties.
5. **Select the Final Norm**: The final value is selected based on the field's soil region and `NV-gebied` status.
6. **Apply Nitrogen Usage Norm Reduction (`Korting Stikstofgebruiksnorm`)**: The norm can be reduced (`korting`) if catch crop (`vanggewas`) or winter crop (`winterteelt`) requirements were not met in the previous year on sand and loess soils.

### How the FDM Calculator Determines the Norm

The `fdm-calculator` uses the `calculateNitrogenUsageNorm` function in `fdm-calculator/src/norms/nl/2025/value/stikstofgebruiksnorm.ts`, which relies on:

* **`stikstofgebruiksnorm-data.ts`**: Contains the data from RVO Tabel 2 and Tabel 2g.
* **`input.ts`**: Defines the required inputs, such as derogation status, location, and crop data.

---

## Vanggewassen en Winterteelten (Catch Crops and Winter Crops)

### How the Rules Work

On sand and loess soils, the land must be covered during the winter to prevent nitrogen leaching. This can be achieved with a catch crop or a designated winter crop. Failure to comply results in a reduction of the nitrogen usage norm for the following year.

#### 1. Winter Crop Exception

No reduction is applied if the main crop of the current year is a designated **winter crop (`winterteelt`)**. These crops provide sufficient ground cover and nitrogen uptake.
**Official Source**: [RVO Tabel 2F Vanggewassen en winterteelten](https://www.rvo.nl/sites/default/files/2023-11/Tabel-2F-Vanggewassen-en-winterteelten-op-zand-en-l%C3%B6ssgrond-2024.pdf)

#### 2. Catch Crop Rules

If there is no winter crop, a **catch crop (`vanggewas`)** must be sown. The sowing date determines the reduction:

* **No Reduction**: Sown by **October 1st**.
* **5 kg N/ha Reduction**: Sown between **October 2nd and October 14th**.
* **10 kg N/ha Reduction**: Sown between **October 15th and October 31st**.
* **20 kg N/ha Reduction**: No valid catch crop, sown on or after **November 1st**, or destroyed before **February 1st**.

---

## Grassland Renewal and Destruction Reductions

In 2025, specific nitrogen usage norm reductions (`kortingen`) apply when grassland is renewed or destroyed (scheuren). These reductions account for the nitrogen released during the decomposition of the sod.

### 1. Grassland Renewal (Gras-na-Gras)

When grassland is directly followed by new grassland, a reduction of **50 kg N/ha** applies. This is only allowed within specific periods:

* **Sand and Loess Soils**: June 1st – August 31st.
* **Clay and Peat Soils**:
  * **Derogation Farm + NV-Area**: June 1st – August 31st.
  * **Derogation Farm + Non-NV-Area**: June 1st – September 15th.
  * **Non-Derogation Farm**: February 1st – September 15th.

### 2. Grassland Destruction (Gras-naar-Bouwland)

When grassland is replaced by Maize or specific Potato types, a reduction of **65 kg N/ha** applies.

* **Eligible Crops**: Maize, Consumption Potatoes, and Factory Potatoes.
* **Excluded Crops**: **Seed Potatoes (`Pootaardappelen`)** do not trigger this reduction.
* **Allowed Periods**:
  * **Sand and Loess Soils**: February 1st – May 10th.
  * **Clay and Peat Soils**:
    * **NV-Area**: February 1st – March 15th.
    * **Non-NV-Area**: February 1st – May 31st.

### How the FDM Calculator Implements These Rules

The `fdm-calculator` automatically detects grassland renewal and destruction events by analyzing the sequence of cultivations. It verifies the soil type, location (NV-gebied), and farm derogation status to apply the correct reduction.

If a renewal or destruction action is performed **outside** the legally allowed periods, the calculator will provide a descriptive error message to ensure compliance.

---

## Calculating the Opvulling (Filling)

### How the Filling Works

The filling is based on the **effective nitrogen** (`werkzame stikstof`) applied, which is calculated using an efficiency coefficient (`werkingscoëfficiënt`).

**Official Source**: [RVO Tabel 9 Werkzame stikstof landbouwgrond 2025](https://www.rvo.nl/sites/default/files/2024-12/Tabel-9-Werkzame-stikstof-landbouwgrond-2025.pdf)

#### Calculation Formula

`Effective Nitrogen (kg N) = Applied Amount (kg or ton) × Total Nitrogen Content (%) × Efficiency Coefficient (%)`

#### Efficiency Coefficients (`Werkingscoëfficiënten`)

| Mestsoort (Manure Type) & Herkomst (Origin) | Toepassing (Application) | Werkingscoëfficiënt (%) |
| :--- | :--- | :--- |
| **Drijfmest en dunne fractie** | | |
| Drijfmest van graasdieren (eigen bedrijf) | Met beweiding | 45 |
| | Zonder beweiding | 60 |
| Drijfmest van graasdieren (aangevoerd) | | 60 |
| Drijfmest van varkens | Klei en veen | 60 |
| | Zand en löss | 80 |
| Overige drijfmest en dunne fractie | | 80 |
| **Vaste mest** | | |
| Vaste mest van graasdieren (eigen bedrijf) | Bouwland (sep-jan) | 30 |
| | Overig met beweiding | 45 |
| | Overig zonder beweiding | 60 |
| Vaste mest van graasdieren (aangevoerd) | Bouwland (sep-jan) | 30 |
| | Overige | 40 |
| Vaste mest van varkens, pluimvee, nertsen | | 55 |
| **Overig** | | |
| Compost / Champost | | 10 / 25 |
| Kunstmest (Mineral fertilizer) | | 100 |

### How the FDM Calculator Determines the Filling

The `calculateNitrogenFilling` function in `fdm-calculator/src/norms/nl/2025/filling/stikstofgebruiksnorm.ts` uses the fertilizer type, application method, and the coefficients from `table-9.ts` to calculate the effective nitrogen.
