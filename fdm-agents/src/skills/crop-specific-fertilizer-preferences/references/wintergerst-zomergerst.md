# Wintergerst / Zomergerst (winter barley / spring barley) — nl_235, nl_236

In Dutch practice, **brouwgerst is almost exclusively zomergerst** (nl_236); wintergerst
(nl_235) is grown for voer. The brouwgerst rules below therefore apply primarily to
zomergerst contracted with a maltster.

**Prefer:**
- Same split N approach as wheat but with **lower total N rates** (per `advice.d_n_req`).
- Sulphur: similar sensitivity to wheat; include S at stem extension if `advice.d_s_req > 0`.

## Zomergerst, brouwkwaliteit

For **brouwgerst** (malting barley), the eiwitgehalte must typically fall within
9.5–11.5 % (the exact band is set by the maltster's contract — Heineken, Holland Malt,
Soufflet, etc.). Excess N raises protein above the contract band; too low N gives lege
korrels and kiemproblemen.

**Avoid:**
- Exceeding `advice.d_n_req` on brouwgerst — contracts often have N-ceiling clauses with
  financial penalties. Flag an intent question if the field-specific advice itself looks
  high enough to push protein out of the contract band.
- Chloride sources for K when soil K is already adequate.

## Wintergerst (and zomergerst voer)

- No protein ceiling — standard N advice applies per `advice.d_n_req`.
- Brouwgerst-grade wintergerst contracts exist but are uncommon; treat the field as voer
  unless the farmer states otherwise.

**Extra attention:**
- Manganese: same risk profile as wintertarwe on calcareous and high-pH soils. Treat as a
  risk flag and consult `advice.d_mn_req`.
