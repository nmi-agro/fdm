---
"@nmi-agro/fdm-rvo": minor
---

Fixed the case when a Shapefile does not have an ending date for a field, yet it defines a start date. Before this change, if a matched FDM field had an end date that is before the Shapefile start date, for example, this would cause `updateField` thus the whole import to fail.
