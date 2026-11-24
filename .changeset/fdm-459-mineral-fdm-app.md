---
"@nmi-agro/fdm-app": patch
---

Open the mineralization overview of a farm faster on farms with many fields. The Dyna calculations of all fields now share one lookup in the calculation cache, and the weather forecast is requested once per location instead of once per field, with at most five requests to the NMI API at the same time. The default harvest date of fields without a harvest is looked up once per crop. A field that cannot be calculated still shows its own error without affecting the other fields.
