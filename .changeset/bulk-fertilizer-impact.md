---
"@nmi-agro/fdm-app": minor
---

Redesign the page for adding one fertilizer application to several fields, from both the fields table and the rotation table. Before saving, the page now shows the farm's gebruiksruimte and filling, the area-weighted N, P₂O₅ and K₂O advice and the area-weighted nitrogen balance of the selected fields, and a per-field breakdown. All values show the effect of the application while the form is filled in, without saving. The effect is calculated in the browser from data loaded once with the page, so it updates directly while typing. Fields can be left out of the application from the field table. Exceeding a farm norm shows a warning but does not block saving. When buffer strips are selected, a warning offers to exclude them with one click.

Adding an application from the rotation table now also runs in a single transaction and ignores duplicate fields, like the fields table already did.

The fertilizer page of a single field now shows the form directly on the page instead of in a dialog, and uses the same impact blocks: the gebruiksruimte of the field (with a switch to the whole farm), the advice and the nitrogen balance of the field, before and after the application. The saved applications are shown at the top of the page in a table with the workable nitrogen, phosphate and potassium each application supplies. Changing an existing application loads it into the same form and previews the effect of the change.

The applications of a fertilizer, opened from the fields table or the rotation table, are now shown on their own page instead of in a dialog. Several applications can be selected and changed or removed together, with the effect on the farm norms, advice and nitrogen balance shown while the form is filled in. Old links to change applications from the bulk page are redirected to this page.

Near the save button, the page now gives one verdict on the same level as the norms block: per norm the room that is left or by how much it is exceeded, on a field page also the verdict for the whole farm (which is what counts legally), and neutral notes when the nitrogen balance ends above its target or a field ends above the advice. Saving is never blocked. Other improvements on these pages:

- The advice on the field page is always based on the main cultivation, shown as a coloured dot; the field table shows cultivations as badges, as in the rotation table.
- Statuses are named precisely ("Geen advies", "Geen balans") and calculation errors are shown in Dutch, with the option to try again.
- The field selection has a search field and buttons to select all fields with the crop or none.
- An application method is filled in when a fertilizer has only one, and all required fields are marked.
- Removing applications asks for confirmation with the effect on the nutrient supply.
- In the farm creation wizard, the bulk page keeps the wizard header, and the breadcrumb shows the rotation step.

