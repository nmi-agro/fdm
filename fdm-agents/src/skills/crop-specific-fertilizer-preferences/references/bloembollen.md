# Flower bulbs (bloembollen) — nl_176 + species-specific codes

Covers:
- Generic / other bulbs: nl_176, nl_1006 (other), nl_997 (dahlia), nl_1000 (iris),
  nl_1005 (zantedeschia), nl_1007 (amaryllis), nl_1012 (ornamental onion), nl_1015
  (grape hyacinth), nl_1018 (tassel hyacinth), nl_1027 (peony), nl_6795 (liatris),
  nl_6803 (snowdrop).
- **Tulip** (nl_985, nl_986, nl_1004), **lily** (nl_979, nl_980, nl_1002),
  **daffodil** (nl_982, nl_983, nl_1003), **hyacinth** (nl_970, nl_971, nl_999),
  **crocus** (nl_976, nl_977, nl_1001), **gladiolus** (nl_967, nl_968, nl_998),
  **tassel hyacinth** (nl_1016, nl_1017).

Bulb growing is a niche, contract-driven sector with very specific fertilizer advice
that varies sharply by species and soil type. This skill provides only the cross-cutting
rules; refer to the dedicated sector advisory documents for species- and soil-specific
rates, and let `advice.d_*_req` carry the rate decisions.

## Cross-cutting rules (apply to all bulb crops in NL)

**Avoid:**
- **Chloride is the primary risk**. Bulbs — especially lily and hyacinth — are highly
  Cl-sensitive: KCl, kalksalpeter (CaCl₂ contamination in some grades), basic slag with
  high Cl content, and slurry with high Cl content cause leaf-margin scorch, poor
  rooting, and growth disorders. **Always use K₂SO₄ / patentkali as the K source**, and
  check the Cl content of any compound or organic input before use.
- Excess N: bulbs are very N-efficient and over-fertilization gives loose-scaled tulips,
  disease-prone hyacinths, and weak lilies. Stay strictly within `advice.d_n_req`.
- Late N close to leaf senescence: increases disease susceptibility and blocks the
  natural translocation of reserves into the bulb.

**Prefer:**
- Split N: most bulbs need an early N application around emergence and a second
  application around flowering. A roughly half-and-half split is a common starting
  point; species-specific schemes from sector advice override this.
- Sulphur per `advice.d_s_req` — bulb crops on the typical sandy dune and zavel soils
  often show S deficiency.
- Boron per `advice.d_b_req` — lily and gladiolus in particular are B-sensitive.
- Manganese and zinc per `advice.d_mn_req` / `advice.d_zn_req` — tulip and hyacinth on
  calcareous soils often show Mn deficiency.
- Well-matured, low-Cl organic matter (compost, well-rotted farmyard manure) applied in
  the previous season, not just before planting.

**Per species — points to flag:**
- **Lily (nl_979, nl_980, nl_1002)**: extremely Cl-sensitive; never use KCl; also limit
  slurry because of Cl and salt content. Patentkali / K₂SO₄ + ammonium sulphate as the
  base.
- **Hyacinth (nl_970, nl_971, nl_999, nl_1018)**: highly Cl-sensitive; Mn on calcareous
  soils via `advice.d_mn_req`.
- **Tulip (nl_985, nl_986, nl_1004)**: moderately Cl-sensitive; N management drives
  bulb-lifting quality and skin quality.
- **Daffodil (nl_982, nl_983, nl_1003)**: relatively robust but Cl is best avoided;
  liming with care — daffodil does not tolerate high pH after long cropping history.
- **Crocus (nl_976, nl_977, nl_1001)**, **gladiolus (nl_967, nl_968, nl_998)**:
  sensitive to salt load; gladiolus needs B.
- **Dahlia (nl_997), zantedeschia (nl_1005), amaryllis (nl_1007), liatris, peony
  (nl_1027)** etc.: highly specialised; rely on `advice.d_*_req` and sector advice.

**Extra attention:**
- Crop rotation and *Pratylenchus* / nematode management partly drive fertilizer choice
  (green-manure choice; avoid Tagetes / carrot adjacency; etc.); flag this only if the
  grower asks — it is not a fertilizer decision.
- Bulb fields are often on calcareous dune soils or clay; pH is usually already high
  (pH-KCl > 7) and liming is rarely needed — always verify before recommending lime.
- Refer to the relevant sector fertilizer guidance for species- and soil-specific
  N / P / K / S / Mg / B / Mn rates; this skill provides the qualitative envelope only.
