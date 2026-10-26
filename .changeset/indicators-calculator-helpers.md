---
"@nmi-agro/fdm-calculator": minor
---

Add `getFieldIndicators`, `getFarmIndicators` and `getFieldMeasureOptions` for indicator scores and field measure options, together with the pure post-processing helpers `aggregateFarmScores`, `buildMeasureOptions`, `buildPredictedImpacts`, `getTopOpportunitiesForField`, `computeAreaWeightedAggregation`, `getFieldAggregationScore`, `getScoreTier`, `scoreToDisplay`, `isExcludedFromBln3` and the `IndicatorsUnavailableError` error class. The pure helpers are also available from the browser-safe subpath `@nmi-agro/fdm-calculator/browser`, which does not depend on `fdm-core`, so client-side code can use them.
