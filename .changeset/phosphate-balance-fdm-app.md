---
"@nmi-agro/fdm-app": minor
---

Add an experimental phosphate balance ("Fosfaat" under Balans) for the farm, per field and for organisations, with a tile on the field overview.

- The farm page starts with the area per verdict (Goed, Aandacht, Bijsturen) and lists the fields most urgent first, in a sortable and filterable table that becomes a compact list on narrow screens. The filter and sorting are kept in the URL, so they stay when you open a field and go back, and the sorted column shows its direction. Buffer strips, nature and landscape elements are listed separately and not counted.
- The field page shows where the soil phosphorus is relative to the target zone, which way it goes and how long it takes: the PSD and P-AL now and over time (measured P-AL points included), the long-term average balance, possible approaches in kg P₂O₅ / ha per year, and a breakdown per fertilizer application and harvest with warnings for missing data.
- The organisation page shows the area-weighted balance of the selected farms and the verdict per farm.
- A help dialog and the user guide (chapter "Balansen" and the background page "Fosfaatbalans") explain the calculation and its limits.

On the field overview the three balance tiles sit side by side on wide screens, and the tiles of a row are equally tall with their links aligned. The "Bekijk details" footer of a tile is more compact and links over its full width. The verdict badge of the phosphate tile explains itself on hover, keyboard focus and tap. The status badges of the nitrogen and organic matter tiles show an icon in both states, so they no longer rely on colour alone. The nitrogen, organic matter and phosphate balance charts show the supply and the removal (or degradation) as two labelled rows, "+ Aanvoer" and "− Afvoer", so it is clear which bar adds and which removes. Their bar tooltips share one compact layout: the term with its colour, the item details and the value with its unit (the organic matter chart now shows the hovered bar with its unit, like the other two).

The app passes the NMI API key to the phosphate calculation for the soil estimates and the crop history of the fields, and passes it to the catalogue synchronisation at startup for the phosphate contents of the crops; it warns at startup when `NMI_API_KEY` is missing.
