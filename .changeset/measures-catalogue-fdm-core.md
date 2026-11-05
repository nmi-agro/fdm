---
"@nmi-agro/fdm-core": minor
---

The measures catalogue stores the full details of each measure.

- `measures_catalogue` gets the columns `m_effect_costs` (cost indication 0–2), `m_effect_type`, `m_impacts_score`, `m_applicability`, `m_effect_size`, `m_origin`, `m_external_ids` and `m_status`. `getMeasuresFromCatalogue` returns them, and the `MeasureCatalogue` type has them as optional fields.
- `syncMeasuresCatalogueArray` writes the new fields and sets `m_status` to `"active"`. With the new option `deactivateMissing`, entries of the same source that are no longer in the catalogue get `m_status = "inactive"` instead of staying unnoticed; they are kept because fields may still use them. The sync from the NMI API uses this option. An inactive measure that returns becomes active again.
- New function `getMeasureFromCatalogue(fdm, m_id)` returns a single entry of the measures catalogue, with `created` and `updated`, or `undefined` when the measure does not exist. The new type `MeasureCatalogueDetails` describes the result.
