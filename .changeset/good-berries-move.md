---
"@nmi-agro/fdm-calculator": minor
---

Various improvements and fixes regarding the korting on the stikstofgebruiksnorm on zand/löss areas:

- Refactor Dutch Meststoffenwet Article 28d catch crop (vanggewas) and winter crop (winterteelt) classification to exact crop-code level lists (`b_lu_catalogue`). Correct false positive winter crop flags (e.g. silage maize `nl_259`), false positive catch crop flags (e.g. triticale `nl_314`), and false negative catch crop flags (`nl_3521` stubble turnips).
- Anchor Dutch Meststoffenwet Article 28d catch crop (vanggewas) and winter crop (winterteelt) reduction evaluation to the main crop of year N-1 (`hoofdteelt(N-1)`). Remove the fixed 15 July lower bound filter, fix winter crop exemption categories (Table 6 ∩ 7 with Art. 4a conditions, Table 7 only late-harvested and autumn-sown), and base the grassland winter crop route on `hoofdteelt(N-1)`.
- Cumulate Dutch Meststoffenwet Article 28d catch crop (vanggewas) reductions with grassland renewal (50 kg N/ha) and grassland destruction (65 kg N/ha) reductions. Restore grassland renewal and destruction applicability on clay and peat soils in norm year 2026.
- Implement conditional winter crop (winterteelt) evaluation in Dutch Meststoffenwet Article 28d. Sugar and fodder beet only qualify as a winter crop when harvested on or after November 1 (`b_lu_end >= Nov 1`). Grain, corncob, energy, and sugar maize variants only qualify as a winter crop when undersown with a catch crop ("met onderzaai").
