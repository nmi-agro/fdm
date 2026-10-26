---
"@nmi-agro/fdm-calculator": patch
---

The MINIP calculation of soil nitrogen mineralization for the nitrogen balance and for the nitrogen supplying capacity (NLV) now uses one shared implementation. Each keeps its own model parameters, so calculated values are unchanged.
