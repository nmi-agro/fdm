# Fertilizer Selection and Application

## Consistency Principle

Prefer to use the same fertilizers for fields with the same or similar cultivations to simplify farm operations.

## Full Nutrient Coverage

Beyond N, P, and K, check and fulfill advice for secondary nutrients (Ca, Mg, S) and micro-nutrients (Cu, Zn, B, Mn, Mo, Co) using appropriate fertilizers. Monitor `advice` (required) vs `proposedDose` (supplied) from `fieldMetrics` in the simulation tool.

Always compare `proposedDose.p_dose_nw` (werkzame stikstof, kg/ha) against `advice.d_n_req` for nitrogen — this is the agronomically correct workable-N value. `p_dose_n` is total N and is provided for reference only.

## Application Method

For each application, propose a valid `p_app_method`. Choose **only** from the `p_app_method_options` returned by the search tool for that specific fertilizer.

## Realistic Application Amounts (`p_app_amount` always in kg/ha)

Equipment limits determine maximum amounts per application:

| Fertilizer type | Per-application range | Unit conversion |
|---|---|---|
| Slurry / drijfmest / digestaat | 15,000–30,000 kg/ha | 1 m³ = 1,000 kg; round to nearest 1,000 |
| Solid manure / vaste mest / compost | 10,000–30,000 kg/ha | 1 t = 1,000 kg; round to nearest 1,000 |
| Mineral fertilizers | 50–450 kg/ha | already in kg/ha; round to nearest 5 or 10 |

If the total advice requires more, **split into multiple applications** on different dates.

## Realistic Application Dates

Ensure all `p_app_date` values are realistic for the crop type, cultivation season, and Dutch climate. Use `b_lu_start` (sowing/start date) as the critical reference point for each crop.

## Ammonia Reduction Strategy

If NH₃ reduction is requested, prioritize fertilizers and application methods with lower ammonia emission factors (`p_ef_nh3`). Prefer "incorporation" or "injection" over "broadcasting" where the fertilizer allows it.

## Manure Space Strategy

- **Fill Manure Space YES**: Maximize manure applications up to the farm-level legal norm, even if it exceeds agronomic advice or field-level norms (as long as farm total is compliant). Prefer regionally common manures (e.g. Rundveedrijfmest).
- **Fill Manure Space NO**: Use manure only as needed for agronomic advice and organic matter balance.

## Buffer Strips

Fields with `b_bufferstrip: true` **MUST NOT** receive any fertilizer applications. Ensure zero applications for these fields and do not include them in the plan output.

## Rotation Level (Bouwplan)

If `workOnRotationLevel` is YES, group fields by `b_lu_catalogue` value and assign identical applications (same `p_id_catalogue`, `p_app_amount`, `p_app_date`, `p_app_method`) to every field within the same group. For grassland variations (`nl_265`, `nl_266`, `nl_331`), treat them as one group.
