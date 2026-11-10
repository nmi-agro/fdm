---
"@nmi-agro/fdm-calculator": minor
---

Use the recorded origin of grazing-animal manure for the nitrogen usage norm filling (2025 and 2026).

- The working coefficient of grazing-animal slurry and solid manure now follows the `p_app_origin` of the application: `own_production` uses the "eigen bedrijf" coefficient, `supplied` the "aangevoerd" coefficient, and `mixed` the highest of the two. Before, manure was assumed to be produced on the farm only when the farm had a grazing intention.
- Results change for farms without grazing that use grazing-animal solid manure of their own: 60% instead of 40%. Set the origin to `supplied` for manure that was supplied.
- Table 9: filtrate after separating cattle manure (RVO code 11) now counts as liquid fraction (80%) and cattle separation cake (RVO code 13) as grazing-animal solid manure. Slurry codes 30, 76, 81, 91 and 92 are removed from the solid manure group, where they were never reached.
- New function `getWorkingCoefficientForOrigin` for both years.
