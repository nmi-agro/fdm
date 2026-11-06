---
"@nmi-agro/fdm-calculator": minor
"@nmi-agro/fdm-app": minor
"@nmi-agro/fdm-docs": patch
---

The long-term phosphate balance covers the crop rotation of the last five years. For an earlier year with registered fertilizer applications or harvests but no registered cultivation, the BRP crop of the field from the NMI API (`cultivation_history`) is used. In earlier years, crops without a registered harvest get the default yield and phosphate content of the catalogue, and the fertilizer supply is averaged over the years with registered applications; `long_term` reports the years used and asks the user to add missing harvests or fertilizer applications.
