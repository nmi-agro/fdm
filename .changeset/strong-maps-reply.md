---
"@nmi-agro/fdm-app": minor
---

Fields with no registered main cultivation ("hoofdteelt") for the active calendar year now get an NMI-estimate-based crop suggestion (sourced from the BRP). The suggestion appears on the farm dashboard's missing-cultivation banner, the field list, the field detail page, and the nutrient advice overview, and can be accepted to pre-fill the "add cultivation" form. The suggestion is silently omitted (never blocks the page) when no NMI API key is configured, no estimate is available for the year, or the NMI API call fails.

Updated all internal call sites to use `@nmi-agro/fdm-calculator`'s new cached `getSoilParameterEstimates(fdm, ...)` signature.
