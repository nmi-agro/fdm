---
"@nmi-agro/fdm-app": minor
---

Add BLN3 measure advice UI: the Maatregelen and Indicatoren apps now show ranked, per-indicator measure recommendations (from the NMI `measure/advice` endpoint, always cross-checked against a fresh `measure/applicability` result) so a weak indicator score comes with a concrete "what to do about it" suggestion instead of just a diagnosis.

- Field measure picker (`measures/:b_id`): "Aanbevolen voor dit perceel" quick-add cards, a "Sorteer op impact" option, and relative-impact bars/tooltips in the add-measure dialog; opening the dialog from a specific indicator now biases sorting towards that indicator's impact.
- Field indicator detail (`indicators/:b_id`): each non-green indicator card gets an "Aanbevolen maatregelen" sub-section with a one-click "+ Toevoegen" action.
- Farm indicators overview (`indicators`): the Knelpunten panel gains a lazily-loaded "Waar te beginnen" section ranking the best measure(s) for the selected indicator across the farm, area-weighted by field.
- Farm measures overview (`measures`): a lazily-loaded "Aanbevolen maatregelen" card ranks the top measure × field opportunities across the whole farm.
