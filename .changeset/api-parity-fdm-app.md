---
"@nmi-agro/fdm-app": patch
---

The fertilizer plan, the farm nutrient advice, the NLV of the soil data, the field import from RVO and shapefiles, the lab report reading and the organization overviews now use the shared libraries that the REST API uses too, so both give the same results. A failed upload of a fertilizer plan no longer leaves a plan without a file. Generating a fertilizer plan no longer stops the server when a usage norm of a field cannot be calculated; that field is shown with an error in the plan. Saved fertilizer plans are shown as outdated once after this update, because the way their status is checked changed.
