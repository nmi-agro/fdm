---
title: Stikstofgebruiksnorm 2025
sidebar_label: "Stikstofgebruiksnorm"
---

This document provides a detailed explanation of the Dutch legal usage norm (`gebruiksnorm`) for nitrogen in 2025. It covers how the norm is calculated, the rules for catch crops and winter crops, and how the applied nitrogen counts towards this norm (`opvulling`).

---

## Calculating the Gebruiksnorm (Usage Norm)

### How the Norm Works

The nitrogen usage norm sets the maximum total effective nitrogen (in kg N/ha) that can be applied to a field in a calendar year. Per RVO Tabel 2, norms are determined **per hectare per teelt** and summed across all crops grown on a field in the calendar year.

#### Calculation Steps

1. **Identify Main Crop (`hoofdteelt`)**: The main crop for 2025 is determined using the Dutch regulatory reference window: the crop present for the longest duration between **15 May and 15 July**. If no crop covers that window, the field falls back to green fallow (`Groene braak, spontane opkomst`).
2. **Determine Geographical Context**: The field's location is used to check:
   - If it is in a **Nutrient-Polluted Area (`NV-gebied`)**, which results in a stricter (20% lower) norm.
   - The dominant **soil region** (`zand_nwc`, `zand_zuid`, `klei`, `veen`, or `loess`).
3. **Calculate Per-Crop Norms**: For each crop grown in the norm year:
   - **First Crop (`1e teelt`)**: The hoofdteelt receives the primary standard norm from RVO Tabel 2.
   - **Successive Crops (`Volgteelt`)**: Any crop following the main crop receives its volgteelt norm where defined in Tabel 2 (e.g. spinach, lettuce varieties, endive, meadow grass, red fescue, tall fescue).
   - **Green Manures (`Groenbemesters`)**: Non-leguminous catch crops receive the groenbemester norm (60/50/50/50/60 kg N/ha) if statutory conditions of footnote 7a are met (sown before 1 September following cereals, rapeseed, or grass seed; not destroyed before 1 February of the next year; or 50% on sand/loess after temporary grassland).
   - **Exclusion after Maize**: Per footnotes 2 and 6, no additional norm is granted for green manures, catch crops, or temporary grassland following maize.
4. **Apply Specific Rules**: The standard norm is refined with additional rules for certain crops:
   - **Grassland (`Grasland`)**: The norm depends on whether the grassland is grazed (`beweiden`) or fully mown (`volledig maaien`).
   - **Temporary Grassland (`Tijdelijk grasland`)**: The norm is adjusted based on the cultivation period.
   - **Potatoes (`Aardappelen`)**: The norm is adjusted based on the potato variety. See [RVO Tabel 2c](https://www.rvo.nl/sites/default/files/2024-12/Tabel-2c-Consumptieaardappelen%20hoge%20of%20lage%20norm-2025.pdf).
   - **Maize (`Maïs`)**: The norm depends on the farm's derogation status (160 kg N/ha derogation vs 185 kg N/ha no derogation on clay).
   - **Outdoor Flowers (`Buitenbloemen`)**: A higher norm is applied for specific varieties.
5. **Sum Cultivation Norms**: The total field nitrogen allowance is the sum of norms across all cultivations in the year.
6. **Apply Nitrogen Usage Norm Reductions (`Kortingen`)**: Reductions are subtracted from the total:
   - **Catch crop reduction (art. 28d Urm)**: Assessed on the previous calendar year (2024) on sand and loess.
   - **Grassland renewal (gras-na-gras, footnote 14)**: 50 kg N/ha reduction when grassland is renewed between **1 June and 31 August** (on sand/loess for all farms; on clay/peat only for derogation farms).
   - **Grassland destruction (gras-naar-bouwland, footnotes 15/16)**: 65 kg N/ha reduction when destroyed for maize or eligible consumption/factory potatoes within allowed spring windows (excluding previous catch-crop grass).
   - Reductions are **cumulative**. If the total norm would become negative, it is floored at 0.

A field marked as a buffer strip (`b_bufferstrip`) receives a norm of 0.

### Intentional Crop Code Mappings

- **Quinoa (`nl_1022`)**: Mapped to `Bladgewassen, Spinazie volgteelt` per official RVO gewascodes guidelines.
- **Grass-like Catch Crops (`nl_6751`, `nl_6789`, `nl_6753`)**: Mapped to their respective grass-seed norm rows (`Akkerbouwgewassen, Graszaad, ...`) per RVO classification.
- **Nature, green fallow and non-agricultural areas (`nl_332`, `nl_335`, `nl_6794`)**: Mapped to `Geen plaatsingsruimte` (0 kg N/ha). Green fallow (`nl_6794`, _groene braak, spontane opkomst_) is assigned 0 kg N/ha standard placement space by default in FDM to prevent unwarranted standard nitrogen allocation to untilled/fallow land unless actively managed as a groenbemester.

---

## Provisions Not (Yet) Implemented

The following statutory options and specialized exceptions from the _Uitvoeringsregeling Meststoffenwet_ are currently out of scope:

1. **Yield-based norm increases (`Opbrengstafhankelijke verhoging` / `Stikstofdifferentiatie`, art. 28c Urm / Bijlage A Tabel 1a)**: Higher norms for sugar beets, potatoes, cereals, and vegetables based on 3-year verified historical yield records.
2. **French-fry potatoes on clay (`Fritesaardappelen op klei`, Tabel 2a)**: Differentiated nitrogen norms requiring specific registration.
3. **Grass seed with fodder cut (`Graszaad met voedersnede`)**: Combining grass seed norm with temporary grassland norm when a fodder cut is taken in spring/autumn.
4. **Grass seed stubble destruction (`Graszaadstoppel ter vernietiging in najaar of vroege voorjaar`, footnote 7b)**: Requires specialized management verification (e.g. min 8-10 weeks standing duration, ploughing after 1 Dec) not modeled in standard crop plans.
5. **Mixed crops / Undersowing (`Mengteelt / Onderzaai`)**: Differentiated calculation for intercropped arable plants.
6. **Fixed farm-level nitrogen norm (`Vaste norm op bedrijfsniveau`, footnote 9)**: The 110 kg N/ha fixed allowance when the farm's weighted average is between 100 and 110 kg N/ha.
7. **Two-year winter crop budget split (`Winterteelt "waarvan ten hoogste na 31/12"`, footnote 5/18)**: Multi-year budget cap attribution between sowing year and harvest year.

---

## Vanggewassen en Winterteelten (Catch Crops and Winter Crops)

### How the Rules Work

On sand and loess soils, the land must be covered over winter to prevent nitrogen leaching. Under article 28d of the Uitvoeringsregeling Meststoffenwet, this obligation attaches to the crop grown **after the main crop (`na de hoofdteelt`) of the previous year**. Failing to meet it reduces the nitrogen usage norm in the **following** year.

For the 2025 norm this means the calculator looks at the **2024** growing season: was a catch crop grown after the 2024 main crop, when was it sown, and did it stand until 1 February 2025?

:::info Which year is assessed
The reduction applied to the 2025 norm is caused by what happened in autumn 2024. Cultivations from the previous year must therefore be present in the data, or the calculator cannot tell a compliant field from a non-compliant one.
:::

#### 1. Winter Crop Exception

No reduction applies if a designated **winter crop (`winterteelt`)** covered the ground instead of a catch crop. Winter crops fall into three groups, and the group determines which crop the calculator examines:

| Group                                             | Examples                                                                                                        | Which crop is checked                                                                                |
| :------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| Listed as **both** a catch crop and a winter crop | winter wheat, winter barley, rye, grasses and grass-seed crops                                                  | The **main crop of the norm year** (sown in autumn of the previous year, harvested in the norm year) |
| Winter crop only, late-harvested or perennial     | sugar and fodder beet lifted on or after 1 November, Brussels sprouts, chicory, asparagus, top fruit, grassland | The **main crop of the previous year**                                                               |
| Winter crop only, autumn-sown                     | spinach sown after 1 August, kohlrabi and pak choi planted after 1 August                                       | The crop grown **after** the previous year's main crop                                               |

For crops in the first group, the exception only applies if the crop is **not destroyed before 16 May** of the norm year — which is what makes it the main crop of that year rather than a catch crop.

#### 2. Conditional Winter Crops

Some crops qualify as a winter crop only under a condition attached to the crop code. The calculator evaluates these conditions rather than treating the crop as unconditionally exempt:

- **Sugar beet and fodder beet** (`nl_256`, `nl_257`) are a winter crop **only when lifted on or after 1 November**. Lifted earlier, the ordinary catch crop rules apply — including the full 20 kg N/ha reduction when no catch crop follows.
- **Maize** (`nl_316`, `nl_317`, `nl_1935`, `nl_2032`, `nl_814`) is a winter crop **only when undersown** (`met onderzaai`). This is how the separate catch crop obligation after maize on sand and loess is given effect. Silage maize (`nl_259`) is not on the winter crop list at all.

#### 3. Catch Crop Rules

If no winter crop applies, a **catch crop (`vanggewas`)** must be grown after the main crop. The sowing date determines the reduction:

- **No reduction**: sown on or before **1 October**.
- **5 kg N/ha**: sown between **2 October and 14 October**.
- **10 kg N/ha**: sown between **15 October and 31 October**.
- **20 kg N/ha**: sown on or after **1 November**, no catch crop grown at all, or the catch crop destroyed before **1 February**.

**Undersowing counts.** A catch crop undersown into a standing crop in May or June is a valid catch crop, sown well before 1 October, and therefore attracts no reduction. The same holds for a catch crop sown early after an early-harvested main crop, such as early ware potatoes.

**Official sources**:

- [Article 28d Uitvoeringsregeling Meststoffenwet](https://wetten.overheid.nl/BWBR0018989)
- [RVO — Vanggewassen op zand- en lössgrond](https://www.rvo.nl/sites/default/files/2023-08/230809-Vanggewassen-op-zand-en-l%C3%B6ssgrond-v1.0.pdf) (crop-code list, Annex A table 6)
- [RVO — Winterteelten op zand- en lössgrond](https://www.rvo.nl/sites/default/files/2023-11/231103-Winterteelten-op-zand-en-l%C3%B6ssgrond-v1.1.pdf) (crop-code list, Annex A table 7)

### How the FDM Calculator Implements These Rules

Membership of the catch crop and winter crop lists is evaluated **per crop code** (`b_lu_catalogue`), not per norm-table row. A single row of RVO Tabel 2 often bundles crop codes with differing status — spring-sown and winter onion, for instance — so a per-row flag cannot represent the lists correctly.

The lists and the conditional rules live in:

- **`fdm-calculator/src/norms/nl/vanggewas-winterteelt.ts`**: `isVanggewas()`, `isWinterteelt()` and `isVanggewasEnWinterteelt()`, including the harvest-date and undersowing conditions.
- **`fdm-calculator/src/norms/nl/2025/value/vanggewas-winterteelt-data.ts`**: the crop-code sets for the norm year.

Because the reduction is expressed per hectare, the calculator applies it at field level; `aggregateNormsToFarmLevel()` then multiplies by field area and sums, giving the farm total against which compliance is assessed.

---

## Grassland Renewal and Destruction Reductions

In 2025, specific nitrogen usage norm reductions (`kortingen`) apply when grassland is renewed or destroyed (scheuren). These reductions account for the nitrogen released during the decomposition of the sod.

### 1. Grassland Renewal (Gras-na-Gras)

When grassland is directly followed by new grassland, a reduction of **50 kg N/ha** applies. This is only allowed within specific periods:

- **Sand and Loess Soils**: June 1st – August 31st.
- **Clay and Peat Soils**:
  - **Derogation Farm + NV-Area**: June 1st – August 31st.
  - **Derogation Farm + Non-NV-Area**: June 1st – September 15th.
  - **Non-Derogation Farm**: February 1st – September 15th.

### 2. Grassland Destruction (Gras-naar-Bouwland)

When grassland is replaced by Maize or specific Potato types, a reduction of **65 kg N/ha** applies.

- **Eligible Crops**: Maize, Consumption Potatoes, and Factory Potatoes.
- **Excluded Crops**: **Seed Potatoes (`Pootaardappelen`)** do not trigger this reduction.
- **Allowed Periods**:
  - **Sand and Loess Soils**: February 1st – May 10th.
  - **Clay and Peat Soils**:
    - **NV-Area**: February 1st – March 15th.
    - **Non-NV-Area**: February 1st – May 31st.

### How the FDM Calculator Implements These Rules

The `fdm-calculator` automatically detects grassland renewal and destruction events by analyzing the sequence of cultivations. It verifies the soil type, location (NV-gebied), and farm derogation status to apply the correct reduction.

If a renewal or destruction action is performed **outside** the legally allowed periods, the calculator will provide a descriptive error message to ensure compliance.

:::info Reductions are cumulative
Article 28d applies alongside the grassland provisions, so a grassland reduction and a catch crop reduction can both apply to the same field and are added together. A field that was destroyed for maize without a catch crop the previous autumn therefore receives 65 + 20 = 85 kg N/ha. The `normSource` lists every reduction that was applied.
:::

---

## Calculating the Opvulling (Filling)

### How the Filling Works

The filling is based on the **effective nitrogen** (`werkzame stikstof`) applied, which is calculated using an efficiency coefficient (`werkingscoëfficiënt`).

**Official Source**: [RVO Tabel 9 Werkzame stikstof landbouwgrond 2025](https://www.rvo.nl/sites/default/files/2024-12/Tabel-9-Werkzame-stikstof-landbouwgrond-2025.pdf)

#### Calculation Formula

`Effective Nitrogen (kg N) = Applied Amount (kg or ton) × Total Nitrogen Content (%) × Efficiency Coefficient (%)`

#### Efficiency Coefficients (`Werkingscoëfficiënten`)

| Mestsoort (Manure Type) & Herkomst (Origin) | Toepassing (Application) | Werkingscoëfficiënt (%) |
| :------------------------------------------ | :----------------------- | :---------------------- |
| **Drijfmest en dunne fractie**              |                          |                         |
| Drijfmest van graasdieren (eigen bedrijf)   | Met beweiding            | 45                      |
|                                             | Zonder beweiding         | 60                      |
| Drijfmest van graasdieren (aangevoerd)      |                          | 60                      |
| Drijfmest van varkens                       | Klei en veen             | 60                      |
|                                             | Zand en löss             | 80                      |
| Overige drijfmest en dunne fractie          |                          | 80                      |
| **Vaste mest**                              |                          |                         |
| Vaste mest van graasdieren (eigen bedrijf)  | Bouwland (sep-jan)       | 30                      |
|                                             | Overig met beweiding     | 45                      |
|                                             | Overig zonder beweiding  | 60                      |
| Vaste mest van graasdieren (aangevoerd)     | Bouwland (sep-jan)       | 30                      |
|                                             | Overige                  | 40                      |
| Vaste mest van varkens, pluimvee, nertsen   |                          | 55                      |
| **Overig**                                  |                          |                         |
| Compost / Champost                          |                          | 10 / 25                 |
| Kunstmest (Mineral fertilizer)              |                          | 100                     |

### How the FDM Calculator Determines the Filling

The `calculateNitrogenFilling` function in `fdm-calculator/src/norms/nl/2025/filling/stikstofgebruiksnorm.ts` uses the fertilizer type, application method, and the coefficients from `table-9.ts` to calculate the effective nitrogen.
