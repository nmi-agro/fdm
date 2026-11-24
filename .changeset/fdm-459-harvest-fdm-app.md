---
"@nmi-agro/fdm-app": patch
---

Open and save several pages faster on farms with many fields, with the same results. The bulk harvest page reads the cultivations and harvests once for the farm instead of once per field or cultivation, both when it opens and when it saves or removes harvests. The fields steps of adding a farm or fields read the fields and their soil data once for the farm, and the RVO comparison reads the cultivations of all fields at once. The soil page, the harvest dialog and the page to change fertilizer applications check the write permission once for the field or farm instead of once per soil analysis, harvest or application. When a selected field lacks the crop on the bulk harvest page, saving now shows which field it is instead of a general error.
