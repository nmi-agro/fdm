---
"@nmi-agro/fdm-app": patch
---

Open the farm list and the farm dashboard faster for users with many organizations or fields. The farm list reads the user's roles and the farm groups of all organizations at once instead of once per organization. The farm dashboard reads the cultivation suggestions of all fields without a main cultivation at once for the farm, and no longer waits for them: the "Teeltassistent" shows that the BRP suggestions are being loaded until they arrive. Accepting the suggestions reads them the same way.

On the farm measures page, adding, changing or removing a measure on several fields now saves all changes together: if one change fails, none is saved.
