---
title: Dierlijke mest gebruiksnorm 2026
sidebar_label: "Dierlijke mest gebruiksnorm"
---

This document explains how the FDM Calculator determines the official Dutch legal usage norm (`gebruiksnorm`) for nitrogen from animal manure in 2026, and how applied animal manure counts towards this norm (the `filling`).

---

## Calculating the Gebruiksnorm (Usage Norm)

### How the Norm Works

The norm is **170 kg N/ha** for every farm.

:::note
Derogation was phased out after 2025. For 2026 there are no derogation norms of 190 or 200 kg N/ha, and no derogation-free zones to check: the 170 kg N/ha norm applies regardless of the farm's history, the field's location, or the share of grassland.
:::

A field marked as a buffer strip (`b_bufferstrip`) receives a norm of 0.

Nitrogen from **Renure** products does not count towards this norm. Renure has its own ceiling of 80 kg N/ha on top of it — see [Renure Usage Norm](./renure-gebruiksnorm.md).

### How the FDM Calculator Determines the Norm

The `fdm-calculator` uses the `calculateNL2026DierlijkeMestGebruiksNorm` function in `fdm-calculator/src/norms/nl/2026/value/dierlijke-mest-gebruiksnorm.ts`.

---

## Calculating the Opvulling (Filling)

### How the Filling Works

The filling is based on the **total nitrogen** from all applied animal manures. Unlike the nitrogen usage norm, no efficiency coefficients are applied here; the total nitrogen content of the manure counts.

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

Manure codes **130 to 134** are Renure and are excluded from this norm.

### How the FDM Calculator Determines the Filling

The `calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm` function in `fdm-calculator/src/norms/nl/2026/filling/dierlijke-mest-gebruiksnorm.ts` relies on:

- The applied amount of animal manure.
- The manure code (`mestcode`) of the applied manure.
- The forfaitair nitrogen values from `fdm-calculator/src/norms/nl/2026/filling/table-11-mestcodes.ts`, which implements RVO Tabel 11.

If a specific analysis value for the nitrogen content is known, it will be used; otherwise, the forfaitair content is applied.
