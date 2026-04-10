# Nitrogen Balance Management

## Two Different N Metrics — Know the Difference

### 1. N Advice (`advice.d_n_req`) — PRIMARY agronomic target

`advice.d_n_req` is the crop's actual nitrogen requirement in **werkzame stikstof (kg N/ha)**.
This is the agronomic target: how much effective nitrogen the crop needs to achieve full yield
potential. **Closing this gap is the plan's primary job.**

Compare against: `fieldMetrics.proposedDose.p_dose_nw` (always werkzame N, not total N).

```
N gap = advice.d_n_req - proposedDose.p_dose_nw   (positive = under-supplied)
```

See the `nutrient-advice-targeting` skill for the full gap-closing workflow.

### 2. N Balance (`nBalance.balance` vs `nBalance.target`) — SECONDARY environmental goal

The nitrogen balance measures how much N is lost to the environment:
`balance = total N input - N removed by crop - N emissions (ammonia + nitrate)`

A lower balance is better for the environment. The "doelwaarde" (target) is a government
environmental goal, **not a legal limit**.

Only optimise the N balance when `keepNitrogenBalanceBelowTarget` is YES in the strategy.
Even then, first ensure the N advice gap is closed — reducing N input to improve the balance
at the expense of crop nutrition is not acceptable unless the farmer specifically requests it.

## Common Misconceptions to Avoid

- **Do not** use `p_dose_n` (total N) to compare against `advice.d_n_req`. Total N includes
  slowly available N fractions. Always use `p_dose_nw` (werkzame stikstof).
- **Do not** confuse the N balance target with the legal Workable-N norm. The norm is a hard
  legal ceiling; the balance target is an environmental monitoring value.
- Individual fields may exceed their N balance target if compensated by other fields —
  the farm total matters for the environmental goal.

## When to Act on the N Balance

- If `keepNitrogenBalanceBelowTarget` is YES: after closing all N advice gaps, check
  `farmTotals.nBalance.balance ≤ farmTotals.nBalance.target`. If over target, reduce N
  input on **lowest-value crops** first (not on high-value crops where the N gap was just closed).
- Individual field exceeds 1.5× target: flag even if farm total is OK — localised
  environmental risk worth mentioning.
- Balance improving year-over-year: acknowledge positive trend in the plan summary.

## Units

- `nBalance.balance` and `nBalance.target` are in **kg N/ha**.
- `nBalance.emission.ammonia.total` and `nBalance.emission.nitrate.total` are also in **kg N/ha**.
- Farm-level values are automatically area-weighted by the simulation tool.
