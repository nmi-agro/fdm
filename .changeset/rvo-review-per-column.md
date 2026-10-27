---
"@nmi-agro/fdm-app": minor
---

The RVO and shapefile import review table now lets you choose per column whether to use the value from RVO or from the app, or enter your own value, before importing:

- Every field follows RVO by default. New fields are added, conflicting fields take the RVO values, and fields that RVO no longer reports are closed. The table shows the date on which each field will be closed.
- The import is blocked when a field has no name, no start date, or an end date that does not lie after its start date. The server checks the same rules.
- The confirmation dialog names the fields that will be added, updated, closed or removed. It warns that removing a field also removes its cultivations, harvests, fertilizer applications, soil analyses and measures.
- After applying the changes a confirmation message is shown. Error messages are now in Dutch.
- Clearer wording in the table. The statuses are now "Alleen bij RVO", "Alleen in" the app and "Niet meer bij RVO", and their explanations say what happens by default. The column explanations now say that choosing an area also chooses the field boundary, and how the buffer strip is estimated for shapefile uploads.
- Fields without a crop now also get soil estimates when they are imported.
- A summary above the table shows how many fields there are per status, and which columns differ for the fields with differences. It also states whether the fields will match RVO after saving, or how many will differ because of your choices.
- The table lists the fields that need a decision first. Fields that match RVO are collapsed and can be shown with one click. Ignored fields are dimmed, and a field with a problem shows that problem in its row.
- The buttons to save stay visible while you scroll through a long list of fields.
- Calmer status badges. Statuses that change data by default (Verschil, Alleen bij RVO, Niet meer bij RVO) get a filled badge, and the others stay neutral. Each badge has an icon, so the meaning no longer depends on color, and "Verschil" is no longer shown in red as if it were an error.
- Better keyboard and screen reader support. Every choice and input names its column and field, for example "Gewas van Huiskavel". The status explanations are all in the header of the status column, so the badges are no longer separate tab stops. The edit buttons are larger, and the crop list only opens by itself when you ask to enter a value.
