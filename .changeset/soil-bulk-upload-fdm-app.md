---
"@nmi-agro/fdm-app": minor
---

Uploading the soil analysis PDFs of many fields at once is clearer and safer, also with 100 or more reports.

- The PDFs are read in portions of 20, so a large upload does not become one huge request. While they are read, the page counts how many have been read and how many failed, instead of showing a message per file. Reports that cannot be read stay in the list with the reason, in Dutch, and can be read again. Files with the same name are no longer merged.
- The review shows a summary that doubles as filter, starting with the analyses that need attention, and a search on file or field. Each analysis says in plain words what needs checking: missing values, no field, values outside the usual range, the same field, date and depth twice in the upload, an analysis that already exists (left out unless you include it), or a report name that points to another field. The field is chosen in a searchable list with the area, with fields that existed on the sampling date first; analyses are linked to such fields automatically.
- "Bekijken" opens a side panel with the PDF next to the values, to check and correct an analysis before saving. A sampling date that is missing in the report stays empty instead of being prefilled, and the date you fill in can be used for the other analyses from the same report that have none.
- Analyses are saved in small batches with progress. Each analysis is saved on its own: if some fail, the others are kept, the failed ones stay in the list with the reason, and saving again does not store an analysis twice. The page reports when a PDF could not be stored.
- The file chooser of drop zones can be used with the keyboard and has a Dutch name for screen readers, and a disabled drop zone stays visible.
