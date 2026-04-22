---
name: legal-norms-nl
description: Dutch fertilizer law (Meststoffenwet) norms, application periods and compliance rules
---
# Dutch Fertilizer Law — Legal Norms

## Legal Framework

Dutch fertilizer law is governed by the **Meststoffenwet** (primary act) and the **Uitvoeringsbesluit Meststoffenwet** (implementing decree). Crop-specific N norms are set by the **Uitvoeringsregeling Meststoffenwet** (ministerial regulation).

## Three Legal Limits (Farm Level in kg)

Dutch law (Meststoffenwet Art. 7–8) sets three legal limits that apply to the **entire farm**, expressed in **kg** (not kg/ha):

1. **Dierlijke mest stikstof N** (Animal Manure Nitrogen): `farmTotals.normsFilling.manure ≤ farmTotals.norms.manure`
2. **Werkzame stikstof N** (Workable Nitrogen): `farmTotals.normsFilling.nitrogen ≤ farmTotals.norms.nitrogen`
3. **Fosfaat P₂O₅** (Phosphate): `farmTotals.normsFilling.phosphate ≤ farmTotals.norms.phosphate`

## Animal Manure Nitrogen Norm (Dierlijke Mest)

**Legal basis: Meststoffenwet Art. 9 lid 1**

The maximum application of animal manure N is **170 kg N/ha** of farm area. This covers all animal manure (drijfmest, stalmest, champost, digestate from animal origin, etc.). Mineral fertilizers do NOT count towards this limit.

Applies to the farm's total agricultural area on **15 May** of the calendar year (Art. 22 Uitvoeringsbesluit). Buffer strips are excluded from this area (Art. 25 Uitvoeringsbesluit).

## Crop Nitrogen Norm (Werkzame N)

**Legal basis: Meststoffenwet Art. 10; norms set by Uitvoeringsregeling**

The total effective (werkzame) nitrogen from all fertilizer types combined must stay within the crop-specific norm per hectare. Norms vary by:
- Crop type (e.g., winter wheat, silage maize, grass, potatoes)
- Soil type (clay, peat, sand/loess)
- Region (some crops have lower norms in nitrate-sensitive zones)

The effective N of animal manure counts for only a fraction (werkingscoëfficiënt), depending on manure type and application season. The simulation tool applies these coefficients automatically.

Reference date: **15 May** (Art. 23 Uitvoeringsbesluit). Late-sown crops after 15 May are added when sowing starts.

## Phosphate Norm (Fosfaat P₂O₅)

**Legal basis: Meststoffenwet Art. 11; status classes Art. 21a Uitvoeringsbesluit**

Base norms (Art. 11 lid 1):
- Grassland: **75 kg P₂O₅/ha**
- Arable land: **40 kg P₂O₅/ha**

Dutch law distinguishes five phosphate status classes (Art. 21a Uitvoeringsbesluit):
`arm` → `laag` → `neutraal` → `ruim` → `hoog`

Higher norms apply for phosphate-poor soils (arm/laag), lower norms for phosphate-rich soils (ruim/hoog). The actual norms per class are set by ministerial regulation and are already computed by the simulation tool per field based on the field's `b_soiltype_agr` and `b_p_al` / `b_p_cc` values. Use `farmTotals.norms.phosphate` as the authoritative farm limit.

Reference date: **15 May** (Art. 24 Uitvoeringsbesluit).

## Farm-Level Compliance

Each field has a norm in kg/ha; multiply by field area (ha) to get that field's kg contribution, then sum across all fields:

```
farmTotal_kg = Σ (fieldNorm_kg_per_ha × fieldArea_ha) over all fields
```

Individual fields are **ALLOWED** to exceed their specific kg/ha norm, as long as the farm total kg limit is respected. The simulation tool computes this automatically.

Always verify `farmTotals.normsFilling ≤ farmTotals.norms` for all three norms before finalizing the plan.

## Buffer Strips — Excluded from Farm Area

**Legal basis: Art. 25 Uitvoeringsbesluit Meststoffenwet**

Fields marked as buffer strips (`b_bufferstrip: true`) are **NOT** counted as agricultural land for norm calculations (norms 1, 2, and 3). The simulation tool handles this automatically. Do NOT apply fertilizer on buffer strips.

## Derogation Status (Derogatie)

**IMPORTANT: Derogation is NO LONGER available from 2026 onwards.**

The EU derogation (Art. 9 lid 2 Meststoffenwet; Art. 13 Meststoffenwet) historically allowed certain Dutch farms to apply up to 230–250 kg animal manure N/ha (instead of 170) on grassland-rich farms, provided ≥80% of farm area was grassland. This derogation expired at the end of 2025.

- **2025**: Derogation was still available for qualifying farms
- **2026 and onwards**: No derogation — all farms are limited to 170 kg N/ha from animal manure

If a strategy has `s_derogation: true`, treat this as **inactive for 2026 plans**. Do NOT plan on the higher 230/250 kg N/ha limit.

Derogation also imposed a restriction: when active, mineral fertilizers containing phosphate (`p_p_rt > 0`) were forbidden. This restriction no longer applies in 2026 since derogation is not available.

## Organic Farming

If organic farming is active (`s_organic: true`), you **MUST NOT** use any mineral fertilizers (`p_type: "mineral"`) in the plan.

## Application Period — Seasonal Restrictions

Source: RVO.nl (last verified February 2026). Storage capacity must cover production from **August through February** (Art. 28 Uitvoeringsbesluit).

### Animal manure — Drijfmest (slurry)

| Land use | Soil type | Allowed period |
|--|--|--|
| Grassland | Sand/loess | 16 February – 31 August |
| Grassland | Clay/peat | 16 February – 31 August |
| Arable | Sand/loess | 16 March – 31 July |
| Arable | Clay/peat | 16 March – 31 July |

**Exceptions for arable drijfmest:**
- Early crops (vroege teelt, registered in Mijn percelen): from **16 February**
- From 1 August to 15 September if followed by: a green manure crop sown by 15 September (stays ≥8 weeks), winter oilseed rape sown by 15 September, or autumn bulb planting

### Animal manure — Vaste mest (solid manure)

| Land use | Soil type | Allowed period |
|--|--|--|
| Grassland | Sand/loess | 1 February – 31 August (straw-rich: 1 January – 31 August) |
| Grassland | Clay/peat | 1 February – 15 September (straw-rich: 1 December – 15 September) |
| Arable | Sand/loess | 1 February – 31 August (straw-rich: 1 January – 31 August) |
| Arable | Clay/peat | Whole year |

### Mineral N fertilizer (stikstofkunstmest)

- Standard: **1 February – 15 September** on all grassland and arable land
- Longer periods: whole year for full-ground vegetables (vollegrondsgroente); until 15 October for winter oilseed rape and certain grass seed crops; from 16 January for hyacinths/tulips

### Other materials

- **Compost**: nearly unrestricted — no application period limits (only frozen/waterlogged/slope restrictions)
- **Other organic manure (overige organische mest)**: whole year
- **Lime (kalkmest) and other inorganic**: no restrictions

### General prohibitions (all manure types)

Never apply on:
- Frozen or snow-covered soil
- Waterlogged soil (bovenste laag verzadigd)
- Slopes >7% (unbowed land), >18% (any land)

When planning application timing, always verify the combination of manure type, soil type (sand/loess vs clay/peat), and land use (grassland vs arable) against the above tables.

## Compliance Violations

Exceeding legal norms results in fines under Meststoffenwet:
- Manure N overrun: €7 per kg N above norm
- Total N overrun: €7 per kg N above norm
- Phosphate overrun: €11 per kg P₂O₅ above norm

Always ensure the farm plan is compliant. Never recommend a plan that would knowingly exceed legal norms.

## Prioritization Under Norm Constraints

If legal norms (especially Nitrogen or Phosphate) limit total nutrient space, prioritize fulfilling advice for high-value crops (potatoes, onions, sugar beets, vegetables) over lower-value crops or grasslands to maximize economic return.
