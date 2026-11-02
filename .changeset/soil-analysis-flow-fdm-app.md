---
"@nmi-agro/fdm-app": minor
---

Adding and viewing a soil analysis is clearer and safer.

- Uploading a PDF report now happens in two steps: the PDF is read first, then the values are shown next to the PDF to check and complete before anything is saved. Values that were not found are listed, values outside the usual range are marked without blocking the save, and when a PDF cannot be read the page links to manual entry. The page to add a soil analysis puts the upload first, with a clear link to upload the reports of several fields at once, and the manual forms next to it on wide screens. The form with all parameters, and from crop year 2026 on also the form for derogation, is behind "Meer opties".
- Every manual form, including the one with all parameters, now starts with the sampling details (laboratory, date and depth), so it can always be saved. Fields are grouped by topic, as many per row as the width allows, required fields are marked, the save button stays in view at the bottom of the screen with a clear label and whether there are unsaved changes, the date picker defaults to a date in the selected year, and when saving fails a summary lists every field to check. Validation messages use Dutch number formatting.
- The page of a soil analysis shows the values read-only by default, with the groups side by side on wide screens, with the sampling date and laboratory in the title, next to a compact map; "Bewerken" switches to the form. Values of 0 are no longer hidden, and BodemConditieScore assessments no longer open in the soil analysis form.
- The soil cards of a field use the same groups and order as the form. Maps of soil sampling only zoom with Ctrl (or ⌘) and scroll, so scrolling the page over a map no longer zooms it.
- On phones and touch screens the soil pages are easier to use: soil cards show two per row on a phone, form fields and buttons are taller with 16px text (so phones do not zoom in on focus), and buttons stack full width. When checking an uploaded PDF on a phone, the page explains that the PDF opens in a separate tab.
- The soil analysis pages no longer repeat a title block under the field name: the description under the field name says which page you are on (for example the sampling date, laboratory and depth of an analysis). Pages in the field layout can set this description through their route `handle`.
