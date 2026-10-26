---
"@nmi-agro/fdm-calculator": minor
---

Add `getMeasureFamilyId`, `getBestVariantIds`, `getFieldOpportunityCandidates` and `getFarmBestVariantIds` to group BLN3 measure variants (IDs that differ only in a trailing lowercase letter) into families. `getTopOpportunitiesForField` now keeps only the best variant per family and skips variants of a family that is already active on the field; field measure recommendations in the API follow the same rule. `getTopOpportunitiesForField` accepts optional `selectableMeasureIds`, so a variant that cannot be adopted does not hide a selectable sibling; `buildMeasureOptions` passes the selectable options.
