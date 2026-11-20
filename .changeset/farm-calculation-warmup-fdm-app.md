---
"@nmi-agro/fdm-app": minor
---

The calculation pages of a farm open faster after the farm dashboard has been visited. Once the dashboard has rendered, the app fills the calculation cache of the farm and the selected year in the background, through the new route `POST /api/farm/:b_id_farm/warm`. By the time the user opens "Indicatoren", "Maatregelen", "Bemestingsadvies" or "Gebruiksruimte", their results are usually already calculated, also right after creating a farm.

- The warm-up uses the same inputs and helpers as these pages, so the pages find its results in the cache. The calculations run one group at a time, so a farm never has more NMI API requests open at once than the pages themselves.
- Nobody waits for the warm-up and a failure is only reported, never shown. The route checks the session and read permission on the farm.
- A browser warms a farm and year at most once every 5 minutes (recorded in `localStorage`; a failed request is tried again on the next visit), and a warm-up that is already running on a server instance is joined instead of started again. The request stays open when the user leaves the page.
- `getMeasureAdviceForFields` now takes the inputs from `collectFarmMeasureInputs`, like `getMeasureApplicabilityForFields`.
- The duration of each warm-up is recorded in PostHog as `farm_calculations_warmup`.

The "Bemestingsadvies" overview no longer shows "Geen gewas" for fields whose advice is still being calculated. It shows the main cultivation right away, or a placeholder when the field has none, until the advice of the field arrives.
