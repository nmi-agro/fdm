---
"@nmi-agro/fdm-data": patch
---

Fix incorrect `p_dm`, `p_density`, `p_ef_nh3`, `p_om`, and `p_c_of` values for liquid mineral fertilizers in the BAAT catalogue.

Five liquid fertilizers had physically incorrect values. Four had `p_dm: 5`, while BAAT004 was still marked as a solid with `p_dm: 999`; all five had `p_density: 1`. Additionally, BAAT003 had unpopulated emission and organic matter fields inconsistent with BAAT057 (same product), and BAAT059 had an incorrect N-split and concentration.

- **BAAT003** Ammoniumnitraatureanoplossing (UAN): `p_dm` 5→750 g/kg, `p_density` 1→1.3 kg/L, `p_ef_nh3` null→0.0375, `p_om` 0→32.1429, `p_c_of` 0→16.0714 — aligned with BAAT057 (same product)
- **BAAT004** Ammoniumpolyfosfaat APP 10-34-0: `p_dm` 999→560 g/kg, `p_density` 1→1.39 kg/L, application methods corrected to `spoke wheel||spraying`
- **BAAT044** NTS 27: `p_dm` 5→345 g/kg, `p_density` 1→1.32 kg/L
- **BAAT057** Urean (vloeibaar, UAN): `p_dm` 5→750 g/kg, `p_density` 1→1.3 kg/L
- **BAAT059** Ureum 20% (vloeibaar): corrected from solid urea values to a 20% pure urea solution — name updated, `p_dm` 5→429 g/kg, `p_density` 1→1.09 kg/L, `p_n_rt`/`p_n_of` 460→200 g/kg, `p_no3_rt`/`p_nh4_rt`/`p_n_if` set to 0 (all-organic N), `p_om` and `p_c_of` recalculated proportionally, `p_ef_nh3` retained at 0.075
