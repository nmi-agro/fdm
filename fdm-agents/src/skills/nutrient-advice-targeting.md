# Nutrient Advice Targeting

## Priority Hierarchy

Every fertilizer plan must respect this priority order:

1. **Legal compliance** (hard ceiling) — `farmTotals.normsFilling ≤ farmTotals.norms` for all three norms
2. **Meet crop nutrient advice** — primary agronomic goal (see below)
3. **Positive organic matter balance** — secondary goal, subordinate to #2
4. **N-balance below environmental target** — tertiary monitoring goal

**Never sacrifice #2 for #3 or #4 without explicit farmer permission.**

## Meeting Crop Nutrient Advice — Primary Goal

The simulation tool returns `fieldMetrics.advice` for each field. Always compare this against
`fieldMetrics.proposedDose` to compute the gap:

```
N gap  (kg N/ha)     = advice.d_n_req  - proposedDose.p_dose_nw    ← werkzame N, NOT total N
P gap  (kg P₂O₅/ha)  = advice.d_p_req  - proposedDose.p_dose_p
K gap  (kg K₂O/ha)   = advice.d_k_req  - proposedDose.p_dose_k
```

A **positive gap** means the crop is under-supplied. You must close the gap unless prevented by
a legal norm or the farmer's explicit instruction.

### How to Close the N Gap

1. Start with the available organic/manure products (they also contribute to OM balance).
2. After simulating, check `proposedDose.p_dose_nw` vs `advice.d_n_req`.
3. If a positive N gap remains AND the legal Workable-N norm still has headroom:
   - Add a mineral N top-up (e.g. KAS, ureum) to close the gap.
   - Exception: if `is_organic = true`, mineral fertilizers are forbidden — flag the shortfall.
4. If the legal Workable-N norm is already at the ceiling, note the shortfall in the plan.

### How to Close the P Gap

1. Most animal manure and compost already supply phosphate; check `proposedDose.p_dose_p`.
2. If a P gap remains AND the Phosphate norm still has headroom:
   - Use a phosphate-containing mineral fertilizer (e.g. Superfosfaat, TSP) to close the gap.
3. If the Phosphate norm is already at the ceiling, note the shortfall.

### How to Close the K Gap

1. Cattle manure and grassland-targeted fertilizers are often K-rich; check `proposedDose.p_dose_k`.
2. If a K gap remains: add potassium chloride (KCl) or potassium sulfate (K₂SO₄).
3. Potassium has no legal norm limit (only the three norms above apply), so the main constraint
   is agronomic sense — do not massively over-supply K.

### Secondary Nutrients (S, Mg, Ca) and Micro-nutrients

After closing N, P, K gaps, check `advice.d_s_req`, `d_mg_req`, `d_ca_req` and the
micro-nutrients. Sulfur deficiency is common on sandy soils; use sulfate-containing products
(e.g. ammonium sulfate, kieseriet). Close other gaps with appropriate specialty products if
available in the farm inventory.

## The N Advice vs Organic Matter Trade-off

Compost and solid manure (vaste mest) have high Effective Organic Matter (EOM) content —
good for `fieldMetrics.omBalance`. However, their N efficiency (werkingscoëfficiënt) is low:
much of their N is not available to the crop in year 1.

Slurry (drijfmest) has higher N efficiency but less EOM per unit applied.

**Consequence:** A plan that maximises OM-building through compost/stalmest may leave a
significant N gap on intensive crops (potatoes, maize, vegetables).

**Default rule:**
- Apply organic/manure products first (they supply OM + some N/P/K).
- Then close any remaining N gap with a mineral top-up.
- This achieves both goals simultaneously without sacrificing crop nutrition.

**Conflict case — when a conflict cannot be resolved with top-up:**
If the legal Workable-N norm is at the ceiling AND there is still an N gap (because the
available N headroom is already used by the organic products), you face a true trade-off:
either use a less N-efficient (but more EOM-rich) product or a more N-efficient (but EOM-poor)
product — not both. In this case, **ask the farmer** via an intent question (see
intent-questions skill guidance).

## Reporting Gaps in the Plan

For each field in the final plan, include in `fieldRecommendations` the gap status:
- If N gap was fully closed: note it positively
- If N gap remains due to legal norm ceiling: state the shortfall and why
- If N gap remains due to organic farming constraint: state the shortfall and why
- Never silently leave a gap — always explain it

For the farm summary, aggregate: "X out of Y fields meet the full N advice; Z fields have an
N shortfall of [total] kg N due to [reason]."
