---
"@nmi-agro/fdm-app": minor
---

Added the Atlas map layer "Bemestingsadvies". It colours every field of a farm by the nutrient advice for the selected nutrient (in kg/ha): still to apply, percentage of the advice, or the advice itself. Hovering a field shows the advice, the amount already applied and the amount still to apply; clicking a field opens its fertilization advice page. The per-field advice calculation is now shared with the Bemestingsadvies overview. The Bemestingsadvies overview has a "Kaartweergave" button to open the layer, and the layer has a "Tabelweergave" button back to the overview.

In "Nog te geven" the fields are shaded from light (nothing left to apply, also when more than the advice was applied) to dark (the largest amount still to apply on the farm). In "% van advies" the fields are shaded on a continuous scale of the percentage of the advice applied, from orange (too little) through green (around 100 %) to red (too much), so small differences between fields stay visible. Fields with an advice of 0 and nothing applied are shown as "Geen behoefte" instead of "advice met". The legend shows the number of fields under, on and over the advice, the progress while the advice is calculated and a message when no field has advice. The tooltip also shows the percentage of the advice applied. On phones the controls span the width and the legend starts collapsed; on touch screens the controls are larger.

The advice now appears per field as soon as it is calculated, on the map and in the Bemestingsadvies overview, with the progress shown ("Advies berekend voor X van N percelen"). The next field starts as soon as any running calculation finishes, instead of waiting for the slowest field of a batch.

The farm row in the Bemestingsadvies overview now states whether it shows the area-weighted average per hectare ("Bedrijfsgemiddelde") or the total for the farm ("Bedrijfstotaal"), with a tooltip that explains the calculation.

The map, the overview table, the progress bars and the summary cards now use the same status colours for nutrient advice: orange below 90 % of the advice, green within 90–110 %, red above 110 %. EOC is never flagged as too much, so it is only orange or green. Previously the overview table used a 105 % threshold with red for a deficit and amber for excess, and the summary cards showed a deficit in red and excess in orange.
