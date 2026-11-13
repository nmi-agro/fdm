---
title: Phosphate Balance
sidebar_label: Phosphate Balance
---

This document explains how the phosphate (P₂O₅) balance is calculated within the FDM Calculator, and how the balance is linked to the phosphorus status of the soil. The balance gives the phosphate inputs and outputs per field, aggregated to the farm and the organisation. Because phosphate is stored in the soil rather than lost, the balance is shown together with its effect on the soil phosphate stock (P-AL) and on the phosphorus saturation degree (PSD).

:::caution Prototype
The phosphate balance is experimental (`@alpha`). The parameters marked as _draft_ below are provisional and still have to be reviewed (NMI, Maarten van Doorn). Results are indicative and are meant to show the direction and the order of magnitude, not exact values.
:::

## 1. Overview

Phosphorus behaves differently from nitrogen:

- There are no gaseous losses, and losses by leaching are small (roughly 0.1–3 kg P / ha / year) compared with the inputs. The field balance is therefore almost a closed mass balance: a surplus is stored in the soil and a deficit is taken from the soil stock.
- The soil stock changes slowly. The balance of a single year changes P-AL by less than what a soil analysis can detect. The value of the balance lies in its effect on the soil stock over several years.
- A negative balance is often the right choice: most Dutch agricultural soils are above the agronomic and environmental phosphorus targets, and reducing a high stock costs little yield.

The balance of a field is:

```text
P Balance (kg P₂O₅ / ha) = P Supply − P Removal
```

Where:

- **P Supply:** phosphate from fertilizers, mineralisation of soil organic matter and atmospheric deposition.
- **P Removal:** phosphate in the harvested products and in crop residues that are removed from the field.

Leaching is estimated separately from the surplus and is **not** subtracted from the balance (as for nitrate in the nitrogen balance). Surface runoff and erosion are not estimated (see [Limitations](#6-limitations)). All phosphate is counted at 100% (no working coefficients: these belong to fertilizer advice, not to a balance).

The calculations are performed for a user-defined **Time Frame**, normally one calendar year. For the effect on the soil, a **long-term average balance** is used: the average over this year and up to four earlier years that have data (Section 3.4.3), so that a crop rotation is taken into account.

## 2. Required Input Data

- **Field Information:** ID, area (ha) and whether the field is a buffer strip. Buffer strips are not calculated: their field result has `exclusion` instead of a balance, and they are left out of the farm average (Section 4).
- **Cultivation Data (per field):**
  - Crop type (`b_lu_catalogue`) and crop rotation group (`b_lu_croprotation`). A field with a cultivation in the `grass` rotation group is treated as grassland (sampling depth 0–10 cm), otherwise as arable land (0–25 cm).
  - Crop residue management (`m_cropresidue`): `false` means the residues are removed from the field.
- **Harvest Data (per field):**
  - Yield (`b_lu_yield`, kg DM / ha) and phosphate content (`b_lu_p_harvestable`, g P₂O₅ / kg DM) from the `harvestable_analyses` of the harvest. When a value is missing, the default of the cultivation catalogue is used.
- **Soil Analysis Data (per field):** all soil analyses of the field are used, not only those in the time frame; the most recent value of each parameter is taken.
  - Oxalate-extractable P, Fe and Al (`a_p_ox`, `a_fe_ox`, `a_al_ox`, mmol / kg).
  - Phosphorus saturation degree (`a_p_sg`, %), when delivered by the laboratory or the NMI API.
  - P-AL (`a_p_al`, mg P₂O₅ / 100 g) and P-CaCl₂ (`a_p_cc`, mg P / kg).
  - Agricultural soil type (`b_soiltype_agr`) and groundwater class (`b_gwl_class`).
  - Organic matter (`a_som_loi`, %), bulk density (`a_density_sa`, g / cm³) and sampling depth (`a_depth_upper`, `a_depth_lower`, cm).
  - Values estimated by NMI BodemSchat (`a_source = nl-other-nmi`) are used when no measurement is available. They are treated as estimates in the app.
- **Fertilizer Application Data (per field):** application amount (`p_app_amount`, kg / ha) and fertilizer (`p_id_catalogue`).
- **Catalogue Data:**
  - Fertilizers: phosphate content (`p_p_rt`, g P₂O₅ / kg) and type (`p_type`: mineral, manure, compost or other).
  - Cultivations: default yield (`b_lu_yield`), harvest index (`b_lu_hi`), whether the crop is harvested (`b_lu_harvestable`) and the phosphate contents of the harvested product and the residues (`b_lu_p_harvestable`, `b_lu_p_residue`, g P₂O₅ / kg DM). The phosphate contents come from the NMI API when the catalogues are synchronised with an NMI API key (see [Cultivations](../../core-concepts/04-cultivations.md)).

## 3. Calculation Components

### 3.1. Phosphate Supply (kg P₂O₅ / ha)

#### 3.1.1. Fertilizers

For each fertilizer application:

```text
P supply = p_app_amount (kg / ha) × p_p_rt (g P₂O₅ / kg) / 1000
```

The supply is reported per fertilizer type (`mineral`, `manure`, `compost`, `other`), with the applications of each type.

#### 3.1.2. Mineralisation of Soil Organic Matter

Organic phosphorus that mineralises becomes available as inorganic phosphate. Because the soil stock is tracked as P-AL and P-ox, which mainly contain inorganic phosphate, this is a supply to the modelled pool and not double counting. (If the stock were ever tracked as total soil P, this term would have to be removed.)

Two tracks are used:

- **Mineral soils** (all soil types except `veen`): the degradation of soil organic matter from the [organic matter balance](./02-organic-matter.md) is used:

  ```text
  P mineralisation = OM degradation (kg OM / ha) × f_P2O5 × 0.65
  ```

  with `f_P2O5` = 0.0046 kg P₂O₅ / kg OM on grassland and 0.0034 on arable land, and 0.65 the net / gross ratio (microbial immobilisation). Without an organic matter content (`a_som_loi`) the mineralisation is set to 0 and a note is shown. When the bulk density is missing, the default of the soil type is used.

- **Peat** (`veen`): the organic matter degradation formula strongly underestimates the oxidation of drained peat, so it is not used. Instead:

  ```text
  P mineralisation (kg P / ha / year) = 12 t OM × f_GWL × 0.774 × 1.7 kg P / t OM × 0.65
  ```

  converted to P₂O₅ (× 2.2914). 12 t OM / ha / year is the reference peat oxidation at groundwater class V, 0.774 the temperature factor at 9.3 °C, 1.7 kg P / t OM the P content of fertilised peat grassland. `f_GWL` depends on the groundwater class: I and II 0.3, III 0.75, IV 0.9, V 1.0, VI 1.2, VII and VIII 1.4 (classes such as `IIIb` or `sVb` are matched on their Roman numeral; unknown class: 1.0 with a note). This gives about 23 kg P₂O₅ / ha / year at Gt V. _Draft:_ `f_GWL` is derived from CO₂ and subsidence emission factors (± 30%).

  When the groundwater class of a peat field differs between its soil analyses, a warning is shown that iron-bound phosphate can be released on rewetting. This release is not calculated.

Both tracks are scaled to the length of the time frame (days / 365).

#### 3.1.3. Atmospheric Deposition

A fixed deposition of 0.7 kg P₂O₅ / ha / year, scaled to the length of the time frame.

#### 3.1.4. Not Included

- Biological fixation does not exist for phosphorus.
- Excreta of grazing animals are not included (out of scope for this version).

### 3.2. Phosphate Removal (kg P₂O₅ / ha)

Removal is calculated with the same rules as in the nitrogen balance and reported as negative values.

#### 3.2.1. Harvested Products

For each harvest:

```text
P removal = − b_lu_yield (kg DM / ha) × b_lu_p_harvestable (g P₂O₅ / kg DM) / 1000
```

The yield and phosphate content of the harvest analysis are used when present, otherwise the catalogue defaults. When a harvest has several analyses, their average is used. A warning is returned when the phosphate content or the yield is unknown, and when a harvestable cultivation that ended in the time frame (or is harvested several times, like grassland) has no harvest: in those cases the removal is 0.

#### 3.2.2. Crop Residues

Only when the residues are removed from the field (`m_cropresidue = false`):

```text
P removal = − yield / b_lu_hi × (1 − b_lu_hi) × b_lu_p_residue / 1000
```

where `yield` is the average yield of the harvests of the cultivation, or the catalogue default without harvests.

### 3.3. Leaching (kg P₂O₅ / ha)

Leaching of dissolved phosphate to groundwater and drains is estimated from the surplus. The structure follows nitrate leaching in the nitrogen balance, as decided in the design of this balance (FDM-305): only a surplus leads to leaching, and the leaching is not part of the balance.

```text
P leaching = − balance × fraction × groundwater factor     (only when balance > 0)
```

- `fraction` depends on the phosphorus saturation degree (PSD) relative to the field threshold (Section 3.4.2): PSD ≤ threshold 0.01, up to twice the threshold 0.03, more than twice the threshold 0.06, unknown 0.03.
- `groundwater factor` = 0.2 / C_env, with C_env the critical P concentration of the threshold (0.1 mg P / L at a mean highest groundwater level of 25 cm or less, rising to 0.3 mg P / L at 100 cm or more): 2 for shallow and 0.67 for deep groundwater.

_Draft:_ the fractions and the groundwater factor are not taken from literature: there is no published relation between the P surplus and P leaching in kg / ha. The fractions were set by hand so that the results stay within measured losses: about 0.1–0.5 kg P / ha / year on non-saturated soils and 0.8–2.1 kg P / ha / year measured via open trenches on P-saturated sandy soils with shallow groundwater (van Doorn et al., 2026). The direction of the factors (more leaching at a higher saturation and shallower groundwater) follows that study; the values themselves still have to be reviewed. See also [Limitations](#6-limitations).

### 3.4. Soil Phosphorus Status

#### 3.4.1. Phosphorus Saturation Degree (PSD)

```text
PSC (mmol / kg) = α_max × (Fe-ox + Al-ox),   α_max = 0.5
PSD (%)         = P-ox / PSC × 100
```

The PSD is taken from the first available source:

1. `a_p_ox`, `a_fe_ox` and `a_al_ox` of the most recent soil analysis that has all three (measured, or NMI estimates).
2. `a_p_sg` as delivered.

Without either, the PSD is missing (it is not estimated from P-AL), and the field status is based on P-AL only (Section 3.4.4).

When Fe-ox and Al-ox are missing, the median values of the soil type are used for the PSC. Notes are returned for soils where the PSD is less reliable: calcareous sand (`duinzand`) and calcareous marine clay, and peat, dalgrond and moerige klei (oxalate also dissolves organically bound Fe and Al, so the PSD is probably underestimated).

#### 3.4.2. Field Threshold

The threshold is the environmental PSD threshold of the topsoil (van Doorn, 2026, Eq. 5.5):

```text
K_L     = β_max × PSD / (C_P × α_max × (100 − PSD))
PSD_env = 100 × α_max × K_L × C_env / (β_max + α_max × K_L × C_env)
```

- `C_P` (mol / m³) = P-CaCl₂ (mg P / kg) × 0.1 / 31 (1:10 extraction).
- `C_env` from the groundwater class: 0.1 mg P / L at a mean highest groundwater level ≤ 25 cm, rising linearly to 0.3 mg P / L at ≥ 100 cm (converted to mol / m³). The groundwater class is translated to a mean highest groundwater level with a draft table; an unknown class uses the strictest value.
- `β_max` = 0.167, 0.125 for peat.

Without P-CaCl₂ or PSD, a threshold of 25% is used.

#### 3.4.3. Projection and Year Classes

The projection shows what happens to the soil if the long-term average balance is repeated every year. It is illustrative, not a prediction.

**Long-term average balance.** The balance is averaged over the selected year and up to four years before it, so a crop rotation (for example potatoes in one year and cereals in the next) is taken into account:

- **Years:** the selected year and every earlier year with a cultivation on the field. Registered cultivations are collected with the input (`history`; `collectInputForPhosphateBalance` collects four earlier years by default, `historyYears: 4`). For years without registered cultivations, the crop history of the field (`cultivation_history`, in the app the BRP crops from the NMI API, as on the field dashboard) is used.
- **Only years with data:** an earlier year counts only when it has registered fertilizer applications or harvests; a crop alone (e.g. from the BRP history) is not enough. Without any such year, the trend uses the balance of the selected year only, and a warning asks the user to add the fertilisation and harvests of the earlier years. The app then shows the balance of the year instead of an average.
- **Removal, mineralisation and deposition** are averaged over these years. In earlier years, a crop without a registered harvest gets the default yield and phosphate content of the cultivation catalogue (NMI API): once for a crop that is harvested once, every year for grassland. When no default is known, the app asks the user to add the harvest.
- **Fertilizer supply** is averaged over the years with registered fertilizer applications (the selected year always counts), because missing applications in earlier years usually mean "not registered" rather than "not fertilized". The app asks the user to add the fertilizer applications of those years.
- The leaching of the average balance and the average balance itself (`long_term`) are used for the projection. The earlier years use the same soil data and parameters as the selected year.

```text
effective balance (kg P₂O₅ / ha / year) = long-term balance + long-term leaching − fixation
```

`fixation` is 20 kg P₂O₅ / ha / year on mineral soils and 0 on peat (_draft_).

- **P-AL:** `ΔP-AL per year = effective balance / buffer`. The buffer (kg P₂O₅ / ha per P-AL unit, _draft_: 65 for sandy soils and dalgrond, 50 for clay, moerige klei and loess, 45 for peat, with ranges) refers to 0–25 cm and is scaled to the sampling depth. The app shows P-AL as low (< 35), medium (35–45, class Goed of the Handboek Bodem en Bemesting, all soil types) or high (> 45).
- **PSD** (van Doorn, 2026, Eq. 5.7): `ΔP-ox (mmol / kg) = effective balance / 2.2914 / (ρ × 1000 × d × 0.31)` and `ΔPSD = ΔP-ox / PSC × 100`, with ρ the bulk density (g / cm³; soil-type default when missing) and d the sampling depth (m; from the analysis, otherwise 0.10 on grassland and 0.25 on arable land).

The time until the PSD crosses the field threshold (back below it, or above it) is reported as a class: `reached`, `< 5`, `5–10`, `10–20`, `> 20` years, or `not_reached` at this balance.

#### 3.4.4. Status and Advice

`assessPhosphateStatus(balance)` judges a field from its long-term average balance: where the soil phosphorus is relative to a target zone, which way it goes and how long it takes. It is a pure function of the field result (also exported from `@nmi-agro/fdm-calculator/browser`), so the rules can be tuned without recalculating cached balances. The rules are in `PHOSPHATE_STATUS_RULES` (_draft_).

**Target zone.** The lower bound is agronomic: P-AL ≥ 35, the lower bound of class Goed and the target value (streefgetal) of the Handboek Bodem en Bemesting, for all soil types. The upper bound is environmental: the PSD at or below the field threshold (Section 3.4.2). When the PSD is missing or not reliable for the soil type (`psd_valid` is false, e.g. calcareous sand), P-AL 35–45 is the zone.

| Position                                  | Aim (`aim`)   | Bound that sets it (`binding`)  |
| ----------------------------------------- | ------------- | ------------------------------- |
| PSD above the threshold                   | `afbouwen`    | `psd`                           |
| P-AL below 35                             | `opbouwen`    | `p_al`                          |
| P-AL above 45, no usable PSD              | `afbouwen`    | `p_al`                          |
| In the zone                               | `onderhouden` | the bound crossed first, if any |
| PSD above the threshold and P-AL below 35 | `onderhouden` | `psd`, with `conflict`          |

When the PSD is above the threshold while P-AL is not high (≤ 45), the environment comes first and `conflict` is set: reducing is needed for the environment, not for the yield. `p_al_min_years` gives the years until P-AL reaches 35 at the current balance. When the PSD is above the threshold and P-AL is also below 35, no single direction is right and the zone cannot be reached. The app then does not choose a goal: it shows what the balance does to both indicators (PSD towards or away from the threshold, P-AL towards or away from 35) and the effect of a lower or a higher balance.

**Close enough.** Exact targets are not needed. Within 2 PSD percentage points of the threshold, or 3 P-AL units of a P-AL bound, counts as reached. The direction is `stable` when the effective balance (Section 3.4.3) is within ±1 kg P₂O₅ / ha / year.

**Verdict.**

- Outside the zone: `good` when the zone (with its margin) is reached within 10 years, `attention` when the direction is right but slower, `adjust` when the direction is wrong or there is no change.
- Inside the zone: `good`, unless the PSD crosses the field threshold: `attention` when that happens within 5–20 years, `adjust` within 5 years. A P-AL that declines towards 35 keeps the verdict `good`, because P-AL 35–45 is class "Goed" of the Handboek Bodem en Bemesting; the years until P-AL falls below 35 are still shown.
- `unknown` without P-AL and PSD.

`years` (with a range from the P-AL buffer) gives the time to reach the zone, or to leave it when inside. `indicative` is set when the PSD is not usable or less reliable for the soil type, the threshold is the general 25%, or the soil data are NMI estimates only.

**Needed balance.** When the verdict is not `good`, `balance_needed` gives the long-term average balance that reaches the zone edge in 10 years (outside the zone), or keeps the status in the zone for 20 years (inside the zone), as a maximum or minimum. It inverts the projection with the same buffer, PSC, bulk density, depth, fixation and the current leaching. `balance_needed.fertilizers` is the average fertilizer supply per year that gives this balance at the current removal, mineralisation and deposition. The app compares it with the phosphate application standard (fosfaatgebruiksnorm) of the field and warns when the standard is lower; the standard applies at farm level. The needed balance is a guide for the direction and size of a change, not a fertilisation advice.

**Advice text.** The app builds one diagnosis and one action sentence from the aim, verdict and needed balance. It does not advise lowering the fertilisation when no phosphate fertilizer is applied (`has_fertilizer_input` is false); then only more removal (e.g. removing crop residues, crops with a high phosphate offtake) speeds up the reduction.

## 4. Field, Farm and Organisation Level Balance

- **Field balance:** `Supply − Removal` as above, in kg P₂O₅ / ha for the time frame. Results are cached per field (`getPhosphateBalanceField`) and recalculated after a calculator release.
- **Farm balance:** the area-weighted average per ha of the balance, supply, removal, leaching and their terms over all fields that could be calculated. Buffer strips, nature and landscape elements (see below) and fields that failed are left out; a failing field is reported in `fields[].errorMessage` without failing the farm. Fields are calculated in batches of 50.
- **Excluded fields:** buffer strips, and fields whose main cultivation of the year is a landscape element (BRP codes of the landscape elements) or a nature cultivation (`b_lu_croprotation` is `nature`), are not calculated (`getPhosphateFieldExclusion`, the same rule as the mineralisation). They are not farmed for production, so a balance and a soil phosphorus aim say little about them. Their field result has `exclusion` with the reason, no `balance` and no `errorMessage`.
- **Organisation:** the app calculates the farm balance of each selected farm and the area-weighted average over all their fields. Per farm, it shows the share of the area per verdict, and judges the farm as good when at least half of the judged area is good.
- **Long-term average:** per field as in Section 3.4.3; the farm and organisation show the area-weighted average of the fields (`long_term_balance`).

## 5. Output

The farm output (`PhosphateBalance`) provides:

- `balance`, `supply`, `removal`, `leaching` and `long_term_balance` (kg P₂O₅ / ha, area-weighted), and `terms` with the supply per fertilizer type, mineralisation and deposition, and the removal by harvests and residues.
- `status_area`: the area (ha) and number of fields per verdict of `assessPhosphateStatus`, without buffer strips.
- `fields`: per field the ID, area, buffer strip flag and either the `balance` (`PhosphateBalanceField`), an `exclusion` (buffer strip, nature or landscape element; no balance) or an `errorMessage`.
- `hasErrors`, `fieldErrorMessages`, and `errorMessage` when no balance could be calculated at all (e.g. `No fields in input`).

The field output (`PhosphateBalanceField`) contains:

- `balance`, `supply` (total, fertilizers per type with their applications, mineralisation with its track and notes, deposition) and `removal` (total, harvests, residues).
- `leaching` (total, saturation class, fraction, groundwater factor and factor).
- `long_term` (average balance, fertilizer supply and leaching per year, and the years included).
- `saturation` (source, PSC, PSD, P-ox, P-AL, soil-type note and warnings) and `projection` (effective balance, fixation, depth, bulk density, P-AL track and PSD track with threshold and year class).
- `warnings`: missing data that make the removal incomplete.

Values are not rounded by the calculator.

## 6. Limitations

- **Surface runoff and erosion are not included.** Only leaching of dissolved phosphate is estimated. Phosphate that is carried over the surface with water and soil particles (particulate P) is not. In the Netherlands this is usually a small loss because most agricultural land is flat, but it can matter locally: on the sloping loess soils of South Limburg, and on fields where overland flow reaches open ditches and trenches (on sandy soils, part of the trench losses in van Doorn et al. (2026) were particulate, assumed 10% of total P on grassland and 50% on arable land). In regions with more relief or higher erosion, runoff and erosion can be a major P loss and need their own estimate (for example with a soil-erosion model and the P content of the eroded soil).
- **Leaching depends on the surplus only.** P-saturated soils keep losing phosphate when the balance is negative, because losses are driven by the phosphate intensity of the soil (P-CaCl₂, PSD) and the connection to surface water (shallow groundwater, open trenches), not by the yearly surplus (van Doorn et al., 2026). These losses are not estimated. Open ditches and trenches, soil organic matter (which increases dissolved P) and land use are not taken into account.
- **Draft parameters.** The leaching fractions, the groundwater factor, the peat mineralisation factors, the P-AL buffers and the fixation of 20 kg P₂O₅ / ha / year are provisional and have to be reviewed.
- **Estimated soil data.** Where no soil analysis is available, the NMI estimates of P-ox, Fe-ox and Al-ox are used. Their uncertainty is not shown, and the PSD may be less reliable on peat, dalgrond, moerige klei and calcareous soils.
- **Not modelled:** excreta of grazing animals, and the release of iron-bound phosphate when peat is rewetted (only flagged).
- **Average repeated.** The projection repeats the long-term average balance (up to five years); it is an illustration of the direction and the time scale, not a prediction. Changes in soil data between years are not taken into account.

## 7. References

- van Doorn, M. (2026). _Phostering sustainability._ PhD thesis, Wageningen University. https://doi.org/10.18174/681704
- van Doorn, M., et al. (2024). The phosphorus saturation degree as a universal agronomic and environmental soil P test. _Critical Reviews in Environmental Science and Technology_ 54(5), 385–404. https://doi.org/10.1080/10643389.2023.2240211
- van Doorn, M., et al. (2024). High-resolution digital soil mapping of amorphous iron- and aluminium-(hydr)oxides to guide sustainable phosphorus and carbon management. _Geoderma_ 443, 116838. https://doi.org/10.1016/j.geoderma.2024.116838
- van Doorn, M., et al. (2025). Using the phosphorus saturation degree as a guide for sustainable phosphorus management. _Journal of Environmental Management_ 384, 125617. https://doi.org/10.1016/j.jenvman.2025.125617
- van Doorn, M., et al. (2026). Phosphorus leaching and runoff risks from non-calcareous sandy soils with a low sorption capacity and high hydrological connectivity. _Journal of Environmental Quality_ 55, e70180. https://doi.org/10.1002/jeq2.70180
- van der Salm, C., van Middelkoop, J.C. & Ehlert, P.A.I. (2017). Changes in soil phosphorus pools of grasslands following 17 yrs of balanced application of manure and fertilizer. _Soil Use and Management_ 33(1), 2–12. https://doi.org/10.1111/sum.12333
- Schoumans, O.F. & Chardon, W.J. (2015). Phosphate saturation degree and accumulation of phosphate in various soil types in The Netherlands. _Geoderma_ 237–238, 325–335. https://doi.org/10.1016/j.geoderma.2014.08.015
- Handboek Bodem en Bemesting: [bodemgericht fosfaatadvies op basis van P-AL](https://www.handboekbodemenbemesting.nl/bemestingsadviezen/fosfaat/bodemgericht-advies-op-basis-van-p-al/).
