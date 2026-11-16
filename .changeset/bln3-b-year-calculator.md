---
"@nmi-agro/fdm-calculator": patch
---

BLN3 now always sends `b_year` to the NMI API, also for the score, and skips years without a main cultivation. `Bln3ScoreCollectedInputs` has a required `b_year`, which `collectInputForBln3Score` fills with the year of the timeframe (without a timeframe: the latest year with a cultivation). When the field has no main cultivation in that year, both input collectors mark it as excluded, so no score, measure applicability or measure advice is requested. The new `getBln3ExclusionReason` and the `exclusionReason` of the collected inputs tell why a field is excluded (`bufferstrip`, `nature` or `no_main_cultivation`); `getFieldIndicators` and `getFieldMeasureOptions` return it as `exclusion_reason`.
