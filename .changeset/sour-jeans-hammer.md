---
"@nmi-agro/fdm-data": patch
---

Fix incorrect `p_dm` and `p_density` values for liquid mineral fertilizers in the BAAT catalogue.

Five liquid fertilizers had `p_dm: 5` (physically impossible given their nutrient content) and `p_density: 1` (incorrect for solutions denser than water):

- **BAAT003** Ammoniumnitraatureanoplossing (UAN): `p_dm` 5→750 g/kg, `p_density` 1→1.3 kg/L
- **BAAT004** Ammoniumpolyfosfaat APP 10-34-0: `p_dm` 999→560 g/kg, `p_density` 1→1.39 kg/L, application methods corrected to `spoke wheel||spraying`
- **BAAT044** NTS 27: `p_dm` 5→345 g/kg, `p_density` 1→1.32 kg/L
- **BAAT057** Urean (vloeibaar, UAN): `p_dm` 5→750 g/kg, `p_density` 1→1.3 kg/L
- **BAAT059** Ureum 30% (vloeibaar): `p_dm` 5→643 g/kg, `p_density` 1→1.12 kg/L, `p_n_rt`/`p_n_of` corrected from 460 (solid urea) to 300 g/kg, organic matter fields scaled proportionally, name updated to "Ureum 30% (vloeibaar)"
