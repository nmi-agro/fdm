---
"@nmi-agro/fdm-core": minor
---

The measures catalogue stores the full details of each measure.

- `measures_catalogue` gets the columns `m_effect_costs` (cost indication 0–2), `m_effect_type`, `m_impacts_score`, `m_applicability`, `m_effect_size` and `m_external_ids`. `getMeasuresFromCatalogue` returns them, and the `MeasureCatalogue` type has them as optional fields.
- `syncMeasuresCatalogueArray` writes the new fields.
- New function `getMeasureFromCatalogue(fdm, m_id)` returns a single entry of the measures catalogue, with `created` and `updated`, or `undefined` when the measure does not exist. The new type `MeasureCatalogueDetails` describes the result.
