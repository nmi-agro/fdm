# Clover (klaver) — pure stand, clover seed, and clover catch-crop

Includes:
- **Production / seed crops**: red clover (nl_799), birdsfoot trefoil / rolklaver
  (nl_800), white clover (nl_3524), Alexandrian clover (nl_3500), crimson clover
  (nl_3511), Persian clover (nl_3515).
- **Clover seed**: nl_804, nl_1570, nl_6757 (Alexandrian), nl_6759 (crimson), nl_6761
  (Persian), nl_6763 (red), nl_6765 (white), nl_6769 (other).
- **Clover as green manure / catch crop**: nl_6756 (Alexandrian), nl_6758 (crimson),
  nl_6760 (Persian), nl_6762 (red), nl_6764 (white).

For grass / clover mixtures see `grasland.md` (clover persistence is part of the
grassland liming and K considerations).

**Prefer:**
- **Inoculation** when clover is sown into a rotation without a recent clover history —
  *Rhizobium leguminosarum* bv. *trifolii* is usually present in NL soils, but on
  first-time or long-fallow fields inoculation is insurance.
- P, K, S, B per `advice.d_p_req` / `advice.d_k_req` / `advice.d_s_req` /
  `advice.d_b_req`. Clover is a heavy P and K user and B-sensitive.
- Liming on acid soils — clover is pH-sensitive (Rhizobium activity drops on low pH).
  Treat low pH-KCl as a risk flag and consult `advice.d_ca_req`.
- Molybdenum on acid soils: Mo availability is poor below pH-KCl ~5.5–6.0, and Mo is the
  cofactor for nitrogenase. Consult `advice.d_mo_req`.

**Avoid:**
- Mineral N — suppresses nodulation. Follow `advice.d_n_req` (normally zero for
  production clover and clover catch-crops).
- Slurry in spring on production clover — high N content and uneven N release. A modest
  slurry application in late autumn or before sowing is acceptable.

**Clover seed crops — extra:**
- Bee activity is essential for seed set. Avoid insecticide applications during
  flowering; this is not a fertilizer decision but should be noted in the plan when
  clover seed is on the farm.
- Lodging severely depresses seed yield; do not apply any spring N beyond what
  `advice.d_n_req` supports.

**Clover as green manure / catch crop — extra:**
- The goal is residual N for the following crop. No fertilization needed; keep
  `advice.d_n_req` near zero.
- When incorporated, include the N release in next year's N budget through the standard
  fdm-calculator workflow (rotation-level), not as an ad-hoc reduction here.
