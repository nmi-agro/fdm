---
"@nmi-agro/fdm-app": patch
"@nmi-agro/fdm-calculator": patch
---

Switch to the new BLN3 aggregation codes returned by the NMI API (for example `S_WAT_BLN` → `S_WAT`, `S_PROD_BLN` → `S_PROD_T`, `S_GW_QUANT_BLN` → `S_WAT_GWQUANT`). The aggregation tree, atlas map selector, field overview cards and indicators page now match on the new codes. A stored map score that is no longer valid falls back to `S_BLN`. The calculator version bump invalidates cached BLN3 results that still hold the old codes.
