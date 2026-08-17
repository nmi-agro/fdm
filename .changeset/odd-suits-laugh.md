---
"@nmi-agro/fdm-calculator": minor
---

Implement per-teelt nitrogen usage norm (`stikstofgebruiksnorm`) accumulation and full Meststoffenwet compliance for norm years 2025 and 2026:

- Per-teelt accumulation: Iterate over all crops grown in a calendar year and sum their nitrogen usage norms per RVO Tabel 2, instead of calculating exclusively for the hoofdteelt.
- Volgteelt differentiation: Select volgteelt sub-types and standard rows for successor crops (e.g. spinach, lettuce varieties, endive, and grass seed volgteelt rows).
- Green manure conditions (footnote 7a & 7b): Enforce statutory sowing (strictly before 1 September) and standing duration (until at least 1 February of the following year), valid preceding crops (granen, koolzaad, graszaad for 100% norm; 50% on sand/loess after temporary grassland), and graszaadstoppel conditions.
- Exclusion after maize (footnotes 2 & 6): Automatically suppress norms (0 kg N/ha) for green manures, temporary grassland, and catch crops immediately following maize.
- Grassland renewal korting (footnote 14): Align renewal window to 1 June – 31 August (on clay/peat in 2025: only for derogation permit holders; on all soil types in 2026).
- Grassland destruction korting (footnotes 15 & 16): Gate 2025 destruction korting on clay/peat to derogation permit holders, backport catch-crop-grass exclusion to 2025, and withhold korting instead of throwing errors when destruction occurs outside allowed statutory windows.
- Data corrections: Correct Veldbeemdgras standard norms on sand (100 kg N/ha on zand_nwc, 80 kg N/ha on zand_zuid), fix typos, and map nature/non-agricultural codes (`nl_332`, `nl_335`) to `Geen plaatsingsruimte` (0 kg N/ha).
- Detailed norm source: Output informative `normSource` string detailing per-teelt breakdowns and explicit reasons when footnote conditions or exemptions apply.
