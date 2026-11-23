---
"@nmi-agro/fdm-calculator": minor
"@nmi-agro/fdm-app": minor
"@nmi-agro/fdm-docs": patch
---

The long-term phosphate balance covers the crop rotation of the last five years. For an earlier year with registered fertilizer applications or harvests but no registered cultivation, the BRP crop of the field from the NMI API (`cultivation_history`) is used, and when there is no BRP crop either, the main cultivation of the selected year. In earlier years, crops without a registered harvest get the default yield and phosphate content of the catalogue (a crop without catalogue details is reported instead of giving no removal), and the fertilizer supply is averaged over the years with registered applications; `long_term` reports the years used and asks the user to add missing harvests or fertilizer applications. When an earlier year has no crop or no fertilizer applications, `long_term.warnings` says that the long-term balance is only indicative.
