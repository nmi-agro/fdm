# Semi-natural grassland with agricultural use — nl_331

nl_331 is "natuurlijk grasland mét landbouwactiviteiten": semi-natural grassland that is
still farmed (cutting, sometimes light grazing) but with restricted inputs, often under an
agri-environmental scheme (ANLb, beheersovereenkomst, or SNL package).

**Do not apply intensive grassland rules.** Inputs are deliberately limited to maintain
botanical diversity, ground-nesting bird habitat, or peat-area groundwater and CO₂ goals.

## Rules

**Prefer:**
- Verify the management agreement (beheerpakket / ANLb-overeenkomst) on the field first —
  many packages have explicit fertilizer restrictions (e.g. "no mineral fertilizer",
  "solid farmyard manure twice per year", rest-period dates). Respect these limits before
  applying any agronomic logic.
- Where inputs are allowed, **cattle slurry at low rates** or **solid farmyard manure
  (ruige stalmest)** is the typical input. Apply only if the package permits it and the
  field-specific `advice.d_n_req` supports it.

**Avoid:**
- Mineral N (kunstmest) — generally not permitted under botanical or meadow-bird
  management packages, and inappropriate for the extensive management goal even where not
  explicitly forbidden.
- Multiple split applications across the season.
- Late N — RVO closing dates apply as for production grassland; many management packages
  add earlier rest-periods.
- Liming unless explicitly supported by `advice.d_ca_req` and not blocked by the
  management package. Many semi-natural grass species depend on lower pH; over-liming
  damages diversity.

**Extra attention:**
- If `advice.d_n_req = 0` or no advice is returned, assume zero fertilization.
- Distinguish from nl_332 ("hoofdfunctie natuur"), which has stricter or zero inputs (see
  `natuurgrasland.md`), and from nl_265 / nl_266 (production grassland).
- Note in the plan that the recommendation is constrained by the extensive-management
  objective and the management agreement, not by agronomic potential alone.
