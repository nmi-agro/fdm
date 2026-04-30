---
name: crop-specific-fertilizer-preferences
description: Crop-specific fertilizer restrictions and preferences for Dutch agriculture
---
# Crop-Specific Fertilizer Preferences and Restrictions

Certain crops have strong agronomic preferences or quality-driven restrictions on fertilizer
types, independent of legal gebruiksruimte limits. Apply these rules when selecting and
scheduling fertilizers for each field. Always mention deviations in the plan summary so the
farmer understands why a particular product was chosen or excluded.

**Important — separation of concerns**: nutrient *rates* (kg N/P/K/S/Ca/Mg and the micro
elements per ha) are produced by `fdm-calculator` and surfaced via the `advice.d_*_req`
fields. This skill never restates or substitutes those rates. What this skill provides is the
qualitative layer the calculator does not produce:

- product preferences and avoidances (e.g. K₂SO₄ vs KCl, ureum vs KAS, type of slurry),
- distribution of the calculator-supplied total over multiple applications (split fractions),
- preferred timing windows (growth stages, weeks before sowing, soil-temperature cues, RVO
  closing dates),
- manure dose ranges (m³/ha) where these are operational rather than nutrient-rate driven,
- crop-quality / contract reference values the *farmer* must respect (brouwgerst protein band,
  pootaardappel sortering, frites drogestof, OWG, bakkleur, etc.),
- soil-type and pH-driven *risk flags* that tell the agent when to consult the relevant
  `advice.d_*_req` field or soil analysis.

Where soil-dependent risks are noted (e.g. Mn deficiency on calcareous soils, schurft pH,
knolvoet pH), these are **caution flags** to mention in the plan. Only take action (e.g.
include foliar Mn, recommend liming) when supported by the corresponding advice field
(`advice.d_mn_req`, `advice.d_ca_req`, etc.) or confirmed soil analysis data. Do not assume
soil conditions from `b_soiltype_agr` alone.

## Using This Skill

Before planning fertilizer for any field, call `getCropFertilizerGuide` with the crop
catalogue codes for all crops present on this farm (e.g. `["nl_265", "nl_256"]`). The tool
returns only the relevant crop sections, keeping the context focused. Call it once early in
planning, before selecting fertilizers for individual fields.

### Multi-segment reference files

Some reference files cover several agronomic segments under one umbrella crop. When such a
file is returned, pick the subsection whose catalogue codes match the field, *not* the first
section in the file:

**Important**: If catalogue codes are shared across multiple subsections (e.g., "consumptie" in
aardappelen.md), the agent must also match a secondary context field (such as "destination" or
"use" — e.g., frites vs tafel) before selecting a subsection. If that secondary context is
missing, either request the field from the user or fall back to not selecting that ambiguous
subsection.

- **`aardappelen.md`** — separate sections for zetmeelaardappelen, fritesaardappelen,
  tafelaardappelen and pootaardappelen. The generic "consumptie" codes are routed to
  `consumptieaardappelen.md` and the early codes to `vroegeaardappelen.md`. If subsection
  selection is ambiguous due to shared codes, use the secondary context field (destination or
  use type) to disambiguate.
- **`koolgewassen.md`** — common rules for all brassicas plus subsections for spruitkool,
  bloemkool/broccoli, and sluitkool. When catalogue codes appear in multiple subsections, match
  the secondary context before selecting.
- **`peulvruchten.md`** — common rules plus genus subsections (Vicia faba, Pisum sativum,
  Glycine max, Phaseolus vulgaris) which differ in N₂-fixation strength and starter-N need.

***

## Crops Not Covered By A Reference File (fallback)

For crops without a dedicated reference file:
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
4. When soil-type-dependent recommendations apply (e.g. Mn on calcareous soils, schurft pH
   management on sand), verify the field's soil type before applying the rule.
