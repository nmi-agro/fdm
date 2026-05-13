---
"@nmi-agro/fdm-calculator": minor
---

Add BLN3 score calculation module. Exports `requestBln3Score` (raw NMI API call to `POST /maatwerk/bln3/score/field`), `getBln3Score` (cached wrapper via `withCalculationCache`), and `collectInputForBln3Score` (assembles field inputs from fdm-core: lat/lon from field centroid, soil analysis parameters, cultivations mapped from BRP catalogue codes, and adopted BLN measures). Types exported: `Bln3Score`, `Bln3ScoreInputs`, `Bln3ScoreCollectedInputs`, `Bln3IndicatorResult`, `Bln3AggregationResult`.
