# Ware potatoes — generic codes (nl_2014, nl_1909, nl_1910, nl_2951, nl_3792)

These BRP codes cover **ware potatoes** (consumptieaardappelen) without distinguishing the end
market. In Dutch practice the field can be contracted for either **processing** (frites,
chips) or **fresh market** (tafel), and the fertilizer regime differs between the two.

## First step: identify the destination

Before applying segment-specific rules, ask the farmer (or look up the contract) which
market the field is grown for:

- **Processing / frites** — apply the rules in `aardappelen.md` → "Fritesaardappelen".
- **Fresh market / tafel** — apply the rules in `aardappelen.md` → "Tafelaardappelen".

Flag this disambiguation in the plan summary.

## When the destination is not known — conservative shared rules

If the destination cannot be established before planning, fall back to the rules below.
These are conservative and work for both segments without harming either; flag the
unresolved destination to the farmer.

**Avoid:**
- KCl (kali-60): both processing and fresh-market potatoes benefit from sulphate-form K.
  Use K₂SO₄ or patentkali.
- Late N (after end of July): bad for both segments — processing potatoes lose dry matter
  and frying colour; fresh-market potatoes become watery and lose dry matter and cooking
  quality.
- N applications beyond `advice.d_n_req`.

**Prefer:**
- Front-loaded split N: roughly half pre-plant, a quarter at tuber initiation, and a
  quarter during tuber bulking. Total N follows `advice.d_n_req`.
- Patentkali for combined K + Mg + S supply.
- Boron when `advice.d_b_req > 0` (skin quality matters in both segments).
- Magnesium when soil Mg is low (kieseriet or patentkali).

**Extra attention:**
- Dry matter content matters in both segments (typical contract band 19–24 % for
  processing; for fresh market it drives cooking quality). Excess N lowers dry matter.
- Common scab pH risk on sand for fresh-market destinations — see the scab note in
  `aardappelen.md`.
- Cross-cutting potato notes (Mg, B, manure timing, ammonium-N early on sand) in
  `aardappelen.md` apply to all ware potatoes.
