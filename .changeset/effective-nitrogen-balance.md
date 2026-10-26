---
"@nmi-agro/fdm-calculator": minor
"@nmi-agro/fdm-app": minor
---

Added the option `useEffectiveNitrogen` to the nitrogen balance to calculate the nitrogen supply by fertilizers with effective nitrogen (`p_n_rt * p_n_wc`) and soil mineralization with the MINIP model. Nitrate leaching is based on the surplus of the balance with total nitrogen in both modes. The default remains total nitrogen. In the app, the nitrogen balance pages let you choose between calculating with total nitrogen or with effective nitrogen; the target and status are only shown for the balance with total nitrogen.
