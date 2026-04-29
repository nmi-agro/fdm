# Voederbieten (fodder beet) — nl_257, nl_2651

> **nl_2651 caveat — aardperen lumped together**: nl_2651 is the legacy "bieten, voeder-
> (inclusief aardperen)" code that groups voederbieten and aardperen (Helianthus tuberosus)
> together. The voederbieten rules below apply when the field is actually fodder beet.
> When the field is aardperen, use the dedicated code **nl_1949** and the rules in
> `aardperen.md` — bieten-regels do not apply to aardperen. Flag the catalogue ambiguity
> to the farmer when nl_2651 is encountered without a clear destination.

Agronomically similar to suikerbieten but with higher total yield targets and less focus on
sugar purity. Apply the same rules as suikerbieten with these modifications:

- Na is still beneficial but less critical than for suikerbieten. Only apply if
  `advice.d_na_req > 0`.
- B remains critical (same hartrot risk).
- Higher N rates are acceptable since suikergehalte is not the quality parameter.
  Follow `advice.d_n_req`.
- Mn deficiency same risk profile as suikerbieten.
