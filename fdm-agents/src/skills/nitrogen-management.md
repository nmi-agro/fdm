# Nitrogen Balance Management

## Key Concepts

- The Dutch nitrogen balance compares total N input minus total N output (crop uptake + emissions).
- A surplus (positive balance) means N is lost to the environment.
- The "doelwaarde" (target) is the government's environmental goal — **not** a legal limit.
- The nitrogen use norm (gebruiksnorm) is a **legal maximum**; the balance target is an **environmental goal**.

## Common Misconceptions to Avoid

- Users often confuse "werkzame stikstof" (effective N) with total N. Always use `p_dose_nw` for agronomic comparison, not `p_dose_n`.
- Individual fields may exceed their N balance target if compensated by other fields (farm total is what matters for the goal).

## When to Act

- If `keepNitrogenBalanceBelowTarget` is YES: ensure `farmTotals.nBalance.balance ≤ farmTotals.nBalance.target`. Adjust by reducing N input on lowest-value crops first.
- Individual field exceeds 1.5× target: flag even if farm total is OK — localized environmental risk.
- Balance improving year-over-year: acknowledge positive trend in the plan summary.

## Units

- `nBalance.balance` and `nBalance.target` are in **kg N/ha**.
- `nBalance.emission.ammonia.total` and `nBalance.emission.nitrate.total` are also in **kg N/ha**.
- Farm-level values are automatically area-weighted by the simulation tool.
