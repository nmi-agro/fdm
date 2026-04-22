---
name: organic-matter
description: Organic matter balance management and OM/N trade-off strategy
---
# Organic Matter Management

## Role in the Planning Hierarchy

Organic matter balance is the **secondary** agronomic goal, subordinate to meeting crop
nutrient advice (N, P, K). See the `nutrient-advice-targeting` skill for the full priority
hierarchy and how to handle conflicts.

**Never sacrifice N/P/K advice coverage to achieve a positive OM balance unless the farmer
has explicitly stated that OM building takes priority.**

## Goal

Aim for a **positive organic matter balance** (organische stofbalans, `omBalance ≥ 0`) on every
field where this is compatible with meeting the nutrient advice. A positive balance means organic
matter is being maintained or built up.

## Strategy

- Prioritize compost (`p_type: "compost"`) or high-EOM organic fertilizers on fields where
  the organic matter balance is at risk (negative or close to zero) — but only after
  verifying that doing so does not leave a material N gap that cannot be closed with a
  mineral top-up.
- The simulation tool returns `fieldMetrics.omBalance` in kg EOM/ha per field. Positive is better.
- After applying organic/manure products, check `fieldMetrics.proposedDose.p_dose_nw` vs
  `fieldMetrics.advice.d_n_req`. If a gap remains, add mineral N before declaring the plan complete.

## Practical Note

Compost has a long-term soil improvement effect but higher cost and low N efficiency.
Solid manure (vaste mest) offers a cost-effective alternative with moderate EOM value.
When choosing between these, consider the farm's overall organic fertilizer availability,
budget, and — critically — whether the N gap can still be closed afterwards within the
legal Workable-N norm.

## Trade-off: OM Building vs N Advice

When the Workable-N norm ceiling prevents adding a mineral N top-up after an OM-building
product, raise this as an intent question: should the farmer prioritize full crop N
nutrition (use more N-efficient slurry instead of compost) or OM building (accept a small
N shortfall this year)?
