---
"@nmi-agro/fdm-app": patch
---

Open and save many pages faster on farms with many fields and for users with many farms or organizations, with the same results. These pages now read their data once for the farm (or for all farms or organizations at once) instead of once per field, cultivation, farm or organization:

- The fields table, the field dashboard and the cultivation page. The fields table checks the write permission once for the farm, reads the soil data and cultivations for the soil condition score (BCS) once for the farm, and runs its reads in parallel. Its cultivation suggestions now load after the table is shown, so the "Percelen" link in the sidebar starts loading the table on hover, like "Bouwplan".
- The bulk harvest page, when it opens and when it saves or removes harvests. When a selected field lacks the crop, saving now shows which field it is instead of a general error.
- The fields steps of adding a farm or fields, and the RVO comparison.
- The soil page, the harvest dialog and the page to change fertilizer applications check the write permission once for the field or farm instead of once per soil analysis, harvest or application.
- The farm list and the organization list read the user's roles (and the farm groups) of all organizations at once.
- The farm dashboard reads the cultivation suggestions of all fields without a main cultivation at once and no longer waits for them: the "Teeltassistent" shows that the BRP suggestions are being loaded until they arrive. Accepting the suggestions reads them the same way.
- The organization overview, the indicators table and map, the nitrogen and organic matter balances and the farms table read the fields of all farms at once. The farms table reads cultivations and fertilizer applications once per farm instead of once per field.
- The mineralization overview shares one lookup in the calculation cache for the Dyna calculations of all fields, and requests the weather forecast once per location instead of once per field, with at most five requests to the NMI API at the same time. A field that cannot be calculated still shows its own error.

On the farm measures page, adding, changing or removing a measure on several fields now saves all changes together: if one change fails, none is saved.
