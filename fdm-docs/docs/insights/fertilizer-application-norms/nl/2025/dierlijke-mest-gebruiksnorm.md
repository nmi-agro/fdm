---
title: Dierlijke Mest Gebruiksnorm 2025
sidebar_label: "Dierlijke Mest Gebruiksnorm"
---

This document explains how the FDM Calculator determines the official Dutch legal usage norm (`gebruiksnorm`) for nitrogen from animal manure and how the applied animal manure counts towards this norm (the `filling`). It also covers the derogation regulations for 2025.

---

## Calculating the Gebruiksnorm (Usage Norm)

### How the Norm Works

This norm defines the maximum nitrogen from animal manure (in kg N/ha) that can be applied. The calculation is based on the farm's derogation status and the field's location.

#### Standard Norm (No Derogation)

If the farm does **not** have a derogation permit, the standard norm is **170 kg N/ha**.

#### Derogation Norms for 2025

Derogation is a temporary exception that allows farms with at least 80% grassland to use more nitrogen from grazing animal manure. However, derogation is being phased out, and the norms for 2025 are as follows:

1. **Derogation-Free Zones**:
   - If a field is in a **derogation-free zone** (`derogatievrije zone`) around a Natura 2000 area, the standard norm of **170 kg N/ha** applies, even with a derogation permit.

2. **Nutrient-Polluted and Groundwater Protection Areas**:
   - If a field is in a **Nutrient-Polluted Area (`NV-gebied`)** or a **Groundwater Protection Area (`GWBG-gebied`)**, the derogation norm is **190 kg N/ha**.

3. **Other Areas**:
   - For all other fields, the derogation norm is **200 kg N/ha**.

### How the FDM Calculator Determines the Norm

The `fdm-calculator` uses the `calculateAnimalManureUsageNorm` function in `fdm-calculator/src/norms/nl/2025/value/dierlijke-mest-gebruiksnorm.ts`. This function takes the farm's derogation status and the field's geographical context as input to apply the correct norm.

---

## Calculating the Opvulling (Filling)

### How the Filling Works

The filling for the animal manure usage norm is based on the **total nitrogen** from all applied animal manures. Unlike the nitrogen usage norm, no efficiency coefficients are applied here; the total nitrogen content of the manure counts.

#### Calculation Formula

`Total Nitrogen (kg N) = Applied Amount (ton) × Total Nitrogen Content (kg N/ton)`

#### Forfaitair Nitrogen Content (`Forfaitaire Stikstofgehalten`)

The forfaitair nitrogen content per ton of manure is determined by the animal species, category, and manure type, as specified in RVO Tabel 11. This table provides standard values for various manure codes (`mestcodes`).

**Example from RVO Tabel 11**:

| Diersoort (Animal Species) | Omschrijving (Description) | Mestcode | Kg stikstof per ton | Kg fosfaat per ton |
| :------------------------- | :------------------------- | :------- | :------------------ | :----------------- |
| Rundvee (Cattle)           | Vaste mest (Solid manure)  | 10       | 6.4                 | 3.2                |
| Rundvee                    | Drijfmest (Slurry)         | 17       | 4.0                 | 1.3                |
| Varkens (Pigs)             | Drijfmest vleesvarkens     | 46       | 6.4                 | 2.4                |
| Kippen (Chickens)          | Mestband (Belt manure)     | 32       | 26.0                | 3.8                |

### How the FDM Calculator Determines the Filling

The `fdm-calculator` uses the `calculateAnimalManureFilling` function in `fdm-calculator/src/norms/nl/2025/filling/dierlijke-mest-gebruiksnorm.ts`. This function relies on:

- The applied amount of animal manure.
- The manure code (`mestcode`) of the applied manure.
- The forfaitair nitrogen values from `fdm-calculator/src/norms/nl/2025/filling/table-11-mestcodes.ts`, which implements RVO Tabel 11.

If a specific analysis value for the nitrogen content is known, it will be used; otherwise, the forfaitair content is applied.
