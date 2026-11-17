---
"@nmi-agro/fdm-data": minor
---

The BLN measures catalogue now includes the cost indication (`m_effect_costs`), the effect type (`m_effect_type`), the affected score variables (`m_impacts_score`), the applicability conditions (`m_applicability`), the effect sizes (`m_effect_size`), the origin of the measure (`m_origin`, from the `m_source` of the NMI API) and its IDs in related schemes (`m_external_ids`, from the `m_id_*` fields). New types `CatalogueMeasureCondition`, `CatalogueMeasureEffectSize` and `CatalogueMeasureImpact` describe the nested fields. Changes in these fields change the hash of a measure, so they are picked up by the next sync.
