---
"@nmi-agro/fdm-calculator": minor
"@nmi-agro/fdm-app": minor
"@nmi-agro/fdm-docs": patch
---

The long-term phosphate balance now covers the crop rotation of the last five years: earlier years count when they have a cultivation, including the BRP crop history of the field from the NMI API (`cultivation_history`) for years without registered cultivations. In earlier years, crops without a registered harvest get the default yield and phosphate content of the catalogue, and the fertilizer supply is averaged over the years with registered applications; `long_term` reports the years used and asks the user to add missing harvests or fertilizer applications. The phosphate pages are simpler: on the farm and organisation pages the balance is on the left and the fields or farms on the right, as in the other balances; the balance card shows only the saldo, the leaching and the chart; the PSD explanation and the long-term average are under "Meer details".
