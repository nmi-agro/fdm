---
"@nmi-agro/fdm-app": minor
---

Improve gebruiksruimte UI with field-level norm explanations and non-supported edge cases context:

- Display per-norm calculation descriptions and footnote breakdowns (`normSource`) on the individual field norms page (`NormCard`).
- Display application amounts with their display unit (`p_app_amount_display` and `p_app_amount_unit`) on the individual field norms page.
- Move the gebruiksruimte disclaimer and edge-cases explanation component (`NormsDisclaimer`) into `FarmTitle` with a quieter inline design and collapsible details for non-supported Meststoffenwet provisions.
