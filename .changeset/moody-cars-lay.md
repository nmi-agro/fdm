---
"@nmi-agro/fdm-app": minor
---

Redesign how soil quality aggregations and relations are displayed under the BLN3 bodemkwaliteit framework.

- **Official API Aggregations**: Replaces the old, self-computed placeholder averages with ggregation scores calculated directly by the NMI API.
- **Drill-Down Summary Tree (`AggregationTree`)**: Introduces an interactive nested tree widget. Users can view high-level root scores (`S_BLN`), expand them into branches and subcategories, and drill all the way down to the individual contributing soil indicators.
- **BBWP Sibling Tree support**: Fully integrates the `S_BBWP` (BedrijfsBodemWaterPlan) as a sibling root card with its specific water-policy indicators whenever a field is evaluated for water and soil measures.
- **Area-Weighted Farm Rollup**: Rolls up per-field scores to farm-level using a mathematically-correct, area-weighted average (excluding fields with missing area or scores) for accurate high-level summaries.
- **Actionable "Knelpunten Analyse" (Pain Points Widget)**: Helps users manage large farms (e.g. 100 fields x 28 indicators) by instantly highlighting the weakest aspects of the farm and ranking the specific percelen causing those deficits, complete with links to field detail pages.
- **Enhanced Map Colouring**: Enables coloring the interactive satellite field maps by any main aggregation (Water, Nutriëntenkringloop, Klimaat, Productie, BBWP) or sub-aggregation in the hierarchy.
- **Collapsible Heatmap Details**: Simplifies the farm indicators page by placing the massive indicators-per-field table under a collapsible details button to reduce cognitive clutter.
