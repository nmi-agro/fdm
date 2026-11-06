---
"@nmi-agro/fdm-app": patch
---

The fertilizer application form now rejects an amount above 100,000 kg/ha and shows the maximum in the unit of the selected fertilizer, for example "Hoeveelheid mag niet groter zijn dan 95,23 m³/ha". The impact preview of the bulk edit shows the same limit instead of calculating with the amount. When an amount is rejected while saving, for example in the bulk edit, a warning with the maximum in the unit of that fertilizer is shown instead of a general error. Moving a fertilizer application in the timeline keeps its stored amount.
