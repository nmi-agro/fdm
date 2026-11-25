---
"@nmi-agro/fdm-app": minor
---

Add an experimental phosphate balance ("Fosfaat" under Balans) for the farm, per field and for organisations, with a tile on the field overview.

- The farm page starts with the area per verdict (Goed, Aandacht, Bijsturen) and lists the fields most urgent first, in a sortable and filterable table that becomes a compact list on narrow screens. Buffer strips, nature and landscape elements are listed separately and not counted.
- The field page shows where the soil phosphorus is relative to the target zone, which way it goes and how long it takes: the PSD and P-AL now and over time (measured P-AL points included), the long-term average balance, possible approaches in kg P₂O₅ / ha per year, and a breakdown per fertilizer application and harvest with warnings for missing data.
- The organisation page shows the area-weighted balance of the selected farms and the verdict per farm.
- A help dialog and the user guide (chapter "Balansen" and the background page "Fosfaatbalans") explain the calculation and its limits.

The app passes the NMI API key to the phosphate calculation for the soil estimates and the crop history of the fields, and passes it to the catalogue synchronisation at startup for the phosphate contents of the crops; it warns at startup when `NMI_API_KEY` is missing.
