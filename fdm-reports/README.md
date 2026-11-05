# @nmi-agro/fdm-reports

Reports for the Farm Data Model (FDM).

## Fertilizer plan (bemestingsplan)

A yearly PDF per farm with the usage norms and their filling, the nutrient advice, the planned doses and the organic matter balance, at farm and field level.

- `establishFertilizerPlan()` collects the data, calculates the plan, renders the PDF, stores it with a `FileStorage` from `@nmi-agro/fdm-storage` and saves the plan.
- `createFertilizerPlanStatusChecker()` tells whether a saved plan still matches the current data (`fresh`) or not (`expired`).
- `collectFertilizerPlanInput()`, `computeFertilizerPlanData()` and `renderFertilizerPlanPdf()` are the separate steps.

The nutrient advice needs an NMI API key. Branding (application name, logos, cover image) is passed in as data URIs, so rendering needs no file access.
