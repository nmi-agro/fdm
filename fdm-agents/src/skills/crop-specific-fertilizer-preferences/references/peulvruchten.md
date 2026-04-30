# Peulvruchten (legumes) — nl_239, nl_241, nl_244, nl_308, nl_2650, nl_242, nl_243, nl_311, nl_665, nl_853, nl_854, nl_2779, nl_7121

Peulvruchten in this file cover several genera with different N₂-fixation strength and
therefore different N strategies. Pick the subsection that matches the field's catalogue
code; only the common rules apply unconditionally.

## Common rules

**Prefer:**
- Phosphate and potassium supply is often more important than N for these crops. Ensure P and
  K advice is met (`advice.d_p_req`, `advice.d_k_req`).
- Molybdenum (Mo): essential cofactor for nitrogenase; consult `advice.d_mo_req` (Mo is
  poorly available on acid soils).

**Avoid:**
- Slurry at sowing — risk of surface compaction and reduced emergence.

**Extra attention:**
- N-nalevering (residual N): peulvruchten leave significant residual N for the following crop.
  Note this in the plan for rotation-level N planning, especially for Vicia and Pisum.

## Pisum sativum — erwten, kapucijners, schokkers — nl_239, nl_241, nl_244, nl_308, nl_2650

Strong N₂-fixation via *Rhizobium leguminosarum*. The native NL soil population is generally
adequate; no inoculation needed in standard rotations.

**Prefer:**
- Minimal mineral N. Follow `advice.d_n_req`; if the advice supports a small starter dose at
  sowing on low-Nmin fields, use it, no further top-dressing.

**Avoid:**
- Mineral N top-dressings during the season — suppress nodulation, waste input, and increase
  nitrate leaching after harvest.

## Vicia faba — tuinbonen (nl_853, nl_854) en veldbonen (nl_243, nl_311)

Strong N₂-fixation via *Rhizobium leguminosarum* bv. *viciae*. Same rules as Pisum: minimal
mineral N, follow `advice.d_n_req`. Tuinbonen and veldbonen are both *Vicia faba* in NL
agronomy — apply identical rules regardless of whether the crop is harvested green
(nl_854) or droog (nl_853, nl_243, nl_311).

## Glycine max — sojabonen — nl_665

Soja's native rhizobia partner (*Bradyrhizobium japonicum*) is **not** native to Dutch soils.

**Prefer:**
- Bradyrhizobium **inoculation is essential** on any field without recent soja history. Flag
  this prominently in the plan.
- Minimal mineral N once inoculation is in place; follow `advice.d_n_req`.

**Avoid:**
- Skipping inoculation on first-time soja fields — without it, the crop fixes no N and the
  yield collapses.

## Phaseolus vulgaris — bruine bonen (nl_242), witte bonen (nl_7121), stamslabonen (nl_2779)

Phaseolus has **weaker N₂-fixation** under Dutch conditions than Vicia or Pisum, and the
fixation also starts later in the season. A modest starter N dose is therefore commonly part
of NL advice for these crops.

**Prefer:**
- A starter N dose at sowing as supplied by `advice.d_n_req` — do not assume zero N as for
  erwten/veldbonen.
- B and Mo per `advice.d_b_req` / `advice.d_mo_req`; Phaseolus is more B-sensitive than the
  other peulvruchten.

**Avoid:**
- Treating Phaseolus like erwten/veldbonen and skipping starter N — emergence and early
  growth suffer on cold or N-poor soils.
