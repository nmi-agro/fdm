---
"@nmi-agro/fdm-app": minor
"@nmi-agro/fdm-calculator": minor
---

Add a prototype phosphate balance page ("Fosfaat") under Balans, for the farm and per field. It shows the Opbouwen / Onderhouden / Afbouwen frame first (with icon and label, so a deficit on a high-P field reads as good), supply and removal in kg P₂O₅/ha, the soil P stock (P-AL change per year and time to the lower bound as a class), the phosphorus saturation degree against the field-specific threshold, a breakdown per application and harvest, and a help dialog with references. `calculatePhosphateBalance` now takes `fdm`, is async, caches each field with `getPhosphateBalanceField` and reports failing fields in `fields[].errorMessage` (`hasErrors`, `fieldErrorMessages`) instead of failing the farm.
