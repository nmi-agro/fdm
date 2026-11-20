---
"@nmi-agro/fdm-calculator": minor
"@nmi-agro/fdm-app": minor
"@nmi-agro/fdm-docs": minor
---

The phosphate projection uses a long-term average balance: the selected year and up to four earlier years with registered fertilizer applications or harvests (`long_term` per field, `long_term_balance` for the farm), so crop rotations are taken into account. `collectInputForPhosphateBalance` and `collectInputForPhosphateBalanceForFarms` collect the earlier years in one extra query set and split them per year (`history`, option `historyYears`, default 4). The phosphate pages put the PSD first: on the field page the PSD card, with an explanation of what the PSD is and why it should stay below the environmental threshold, comes before the P-AL card; the P-AL levels are blue.
