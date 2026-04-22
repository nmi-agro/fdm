---
name: crop-specific-fertilizer-preferences
description: Crop-specific fertilizer restrictions and preferences for Dutch agriculture
---
# Crop-Specific Fertilizer Preferences and Restrictions

Certain crops have strong agronomic preferences or quality-driven restrictions on fertilizer
types, independent of legal gebruiksruimte limits. Apply these rules when selecting and
scheduling fertilizers for each field. Always mention deviations in the plan summary so the
farmer understands why a particular product was chosen or excluded.

**Important**: `advice.d_n_req` (and the other `advice.d_*_req` fields) always remains the
primary agronomic target. The N rate indications in this skill are directional guardrails only
— they help you judge whether the advice seems reasonable for the crop type, but never override
the field-specific advice. If the advice diverges significantly from the expected range, flag
it in the plan rather than substituting your own number.

Where soil-dependent risks are noted (e.g. Mn deficiency on calcareous soils, schurft pH),
these are **caution flags** to mention in the plan. Only take action (e.g. include foliar Mn,
recommend liming) when supported by the corresponding advice field (`advice.d_mn_req`,
`advice.d_ca_req`, etc.) or confirmed soil analysis data. Do not assume soil conditions from
`b_soiltype_agr` alone.

## Using This Skill

Before planning fertilizer for any field, call `getCropFertilizerGuide` with the crop
catalogue codes for all crops present on this farm (e.g. `["nl_265", "nl_256"]`). The tool
returns only the relevant crop sections, keeping the context focused. Call it once early in
planning, before selecting fertilizers for individual fields.

***

## Crops Not Listed Above (fallback)

For crops not covered by a specific section above:
1. Follow the standard gap-closing workflow from the `fertilizer-selection` and
   `nutrient-advice-targeting` skills.
2. Apply general principles: K₂SO₄ over KCl for quality-sensitive crops (vegetables, root
   crops, fruit); KCl is acceptable for cereals and grassland.
3. Check all micro-nutrient advice fields (`advice.d_b_req`, `advice.d_mn_req`,
   `advice.d_zn_req`, `advice.d_mo_req`, `advice.d_cu_req`) and include appropriate products
   if any are flagged.
4. When in doubt about crop-specific sensitivity, note in the plan that no specific
   crop-fertilizer rule was available and standard advice was followed.

***

## Interpretation and Communication

When you apply a crop-specific rule:
1. Note it in the plan summary: e.g. *"Voor zetmeelaardappelen is KCl vermeden; K is als K₂SO₄
   toegediend vanwege het onderwatergewicht."* or *"Rijenbemesting met NP-meststof is
   opgenomen voor de maïspercelen."*
2. If the available fertilizers in the system do not include the preferred product, note the
   gap and suggest the farmer procures it, or explain which available product is the best
   alternative.
3. If an intent question has already established the farmer's preference (e.g. they specifically
   want to use a certain manure product), respect that preference unless it creates a legal
   violation or a serious quality risk — in which case, flag the conflict clearly.
4. When soil-type dependent recommendations apply (e.g. Mn on calcareous soils, schurft pH
   management on sand), verify the field's soil type before applying the rule.