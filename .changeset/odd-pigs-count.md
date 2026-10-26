---
"@nmi-agro/fdm-app": minor
---

Users can now only select cultivation codes that are available for the relevant year in RVO Basisregistratie Percelen. This removes unnecessary options from cultivation selection combo boxes and makes entering correct data easier. Existing cultivations stay as they are and can be part of calculations, however the user sees a warning that the cultivation code is not allowed by RVO in the given time period, naming the first unavailable year. The warning is shown on the field dashboard, the cultivation details page and when adding or editing a cultivation, and cultivation badges in the field and rotation tables show a warning triangle with a tooltip.
