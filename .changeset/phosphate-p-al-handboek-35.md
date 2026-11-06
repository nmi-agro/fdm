---
"@nmi-agro/fdm-calculator": patch
"@nmi-agro/fdm-app": patch
"@nmi-agro/fdm-docs": patch
---

Phosphate balance: the P-AL bounds of the target zone follow class "Goed" of the Handboek Bodem en Bemesting for all soil types: 35–45 mg P₂O₅/100 g, with 35 (the streefgetal) as the agronomic lower bound (`PHOSPHATE_STATUS_RULES.p_al_min`, the P-AL floor of the projection and `determinePhosphateFrame`). A P-AL in the zone keeps the verdict good, also when it declines towards 35 (the years until it falls below 35 are still shown); inside the zone only a PSD that crosses the threshold lowers the verdict. The P-AL chart shows the 35–45 band on a y axis from 10 to 65, the class bounds of the Handboek (wider when a value falls outside).
