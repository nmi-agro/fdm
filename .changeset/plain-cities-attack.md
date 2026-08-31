---
"@nmi-agro/fdm-calculator": minor
---

Add BLN3 measure advice integration: `requestBln3MeasureAdvice` / `getBln3MeasureAdvice` call the NMI `POST /maatwerk/bln3/measure/advice` endpoint to rank candidate measures by predicted impact per indicator, reusing the existing `measure/applicability` input collector and calculation cache.
