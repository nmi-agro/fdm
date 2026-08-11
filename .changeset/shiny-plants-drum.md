---
"@nmi-agro/fdm-app": minor
---

Add BLN3 measure advice UI: the Maatregelen and Indicatoren apps now show ranked, per-indicator measure recommendations (from the NMI `measure/advice` endpoint, always cross-checked against a fresh `measure/applicability` result) so a weak indicator score comes with a concrete "what to do about it" suggestion instead of just a diagnosis.

- Field measure picker (`measures/:b_id`): "Aanbevolen voor dit perceel" quick-add cards, a "Sorteer op impact" option, and relative-impact bars/tooltips in the add-measure dialog; opening the dialog from a specific indicator now biases sorting towards that indicator's impact.
- Field indicator detail (`indicators/:b_id`): each non-green indicator card gets an "Aanbevolen maatregelen" sub-section with a one-click "+ Toevoegen" action; `?indicator=<id>` deep links expand and scroll to that indicator's card.
- Farm indicators overview (`indicators`): the Knelpunten panel gains a lazily-loaded "Waar te beginnen" section ranking the best measure(s) for the selected indicator across the farm, area-weighted by field.
- Farm measures overview (`measures`): a lazily-loaded "Aanbevolen maatregelen" card below the measures table groups recommendations by measure and links the affected fields.

Impact bars use the true 0–1 `measure_impact` scale, so bars are comparable across surfaces; a failed advice fetch hides the recommendations UI entirely instead of showing a false "no measures found" state. The "Wat is BLN3?" help dialog now explains the recommendations and the relative impact scale.
Also fixes horizontal overflow in the shared `DialogContent` component by constraining its grid columns (`grid-cols-[minmax(0,1fr)]`), which affects all dialogs in the app.

Layout pass on the field measures page (`measures/:b_id`): the beta badge moved into the title row, the two indicator blocks now form one tight status cluster (`ImpactSummary` lost its heavy card chrome and fixed-height scroll area), the empty state carries its own "Toevoegen" action, long field names truncate, and the map is narrower (`xl:w-80`) so the measures list clearly leads. "Invloed op bodemindicatoren" now attributes each improved indicator to the active measure(s) causing it ("Door: BM…").
