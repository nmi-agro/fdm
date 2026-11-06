---
"@nmi-agro/fdm-app": minor
"@nmi-agro/fdm-calculator": minor
---

Add a prototype phosphate balance page ("Fosfaat") under Balans, for the farm and per field. The farm page shows the balance, supply and removal in kg P₂O₅/ha and, per field, whether the phosphorus saturation degree (PSD) is below (✓) or above (✗) its field-specific threshold. The field page adds the P-AL stock (now and change per year), the PSD (now, threshold, change per year and the years until the threshold is crossed, as a class), a breakdown per application and harvest, and warnings when harvest or phosphate content data are missing. `calculatePhosphateBalance` now takes `fdm`, is async, caches each field with `getPhosphateBalanceField` and reports failing fields in `fields[].errorMessage` (`hasErrors`, `fieldErrorMessages`) instead of failing the farm. The NMI cultivations lookup also accepts BRP codes and phosphate contents sent as numeric strings.
