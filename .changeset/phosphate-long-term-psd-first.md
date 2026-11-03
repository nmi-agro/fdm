---
"@nmi-agro/fdm-calculator": minor
"@nmi-agro/fdm-app": minor
"@nmi-agro/fdm-docs": minor
---

The phosphate projection now uses a long-term average balance: the selected year and up to four earlier years with fertilizer applications or harvests (`long_term` per field, `long_term_balance` for the farm), so crop rotations are taken into account. `collectInputForPhosphateBalance` and `collectInputForPhosphateBalanceForFarms` collect the earlier years in one extra query set and split them per year (`history`, option `historyYears`, default 4). A field is now on track (✓) only when the projected PSD after 20 years is at or below the field threshold, so a PSD that stays above the threshold for more than 20 years is off track. The phosphate pages put the PSD first: on the field page the PSD card (with an explanation of what the PSD is, what it adds to P-AL and why it should stay below the environmental threshold) is top left with the P-AL card below it as extra information; the balance figures (saldo, supply, removal, leaching and the long-term average) are integrated in the balance card next to the chart instead of separate cards on top, also on the farm and organisation pages. The off-track message is no longer red and the P-AL levels are blue. The separate 3-year average of the app is replaced by the long-term average.
