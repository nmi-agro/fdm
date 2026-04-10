# Dutch Fertilizer Law — Legal Norms

## Three Legal Limits (Farm Level in kg)

Dutch law sets three legal limits that apply to the **entire farm**, expressed in **kg** (not kg/ha):

1. **Dierlijke mest stikstof N** (Animal Manure Nitrogen): `farmTotals.normsFilling.manure ≤ farmTotals.norms.manure`
2. **Werkzame stikstof N** (Workable Nitrogen): `farmTotals.normsFilling.nitrogen ≤ farmTotals.norms.nitrogen`
3. **Fosfaat P₂O₅** (Phosphate): `farmTotals.normsFilling.phosphate ≤ farmTotals.norms.phosphate`

## Farm-Level Compliance

Each field has a norm in kg/ha; multiply by field area (ha) to get that field's kg contribution, then sum across all fields. Formula:

```
farmTotal_kg = Σ (fieldNorm_kg_per_ha × fieldArea_ha) over all fields
```

Individual fields are **ALLOWED** to exceed their specific kg/ha norm, as long as the farm total kg limit is respected. The simulation tool computes this automatically.

Always verify `farmTotals.normsFilling ≤ farmTotals.norms` for all three norms before finalizing the plan.

## Derogation (Derogatie)

If derogation is active, you **MUST NOT** use any mineral fertilizers (`p_type: "mineral"`) that contain phosphate (`p_p_rt > 0`). Mineral fertilizers without phosphate (KAS, ureum, pure potassium) are still permitted.

## Organic Farming

If organic farming is active, you **MUST NOT** use any mineral fertilizers (`p_type: "mineral"`) in the plan.

## Prioritization Under Norm Constraints

If legal norms (especially Nitrogen or Phosphate) limit total nutrient space, prioritize fulfilling advice for high-value crops (potatoes, onions, sugar beets, vegetables) over lower-value crops or grasslands to maximize economic return.
