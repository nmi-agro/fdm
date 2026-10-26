---
"@nmi-agro/fdm-core": patch
"@nmi-agro/fdm-app": patch
"@nmi-agro/fdm-calculator": patch
"@nmi-agro/fdm-docs": patch
---

Corrected the displayed units and names of several soil parameters to match the NMI parameter definitions: `a_c_of` is now shown in g C/kg and `a_n_rt` in mg N/kg, `a_mg_co` uses the same "mmol+/kg" notation as `a_ca_co` and `a_k_co`, and these three exchangeable cations are now labelled "uitwisselbaar" instead of "totale bodemvoorraad". The input range for `a_ca_co_po` is limited to 1–100 %. Bulk density is documented in g/cm³ throughout the calculator.
