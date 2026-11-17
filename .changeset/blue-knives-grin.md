---
"@nmi-agro/fdm-app": minor
---

Add dairy grazing and livestock interfaces:

- **Veestapel & Animals**: Add first-koppel onboarding wizard, herd cards with optimistic debounced steppers (⊕/⊖), live GVE calculations, all-animals overview page (`/livestock/animals`), and individual animal detail & history page (`/livestock/animal/:l_id_animal`) with herd reassignment and departure logging.
- **Beweidingskalender**: Add a calendar of the grassland fields per week, or per day for the whole grazing season (1 March to 31 October), with grazing, mowing and fertilizer applications, planned grazing and a drag-to-paint popover with live stats. Grazed fields come first, then the largest fields. A click on an empty cell records one day; dragging records a longer period. Add, change and remove mowing and fertilizer applications from the calendar with the same forms as the Tijdlijn ("Maaisnede toevoegen", "Bemesting toevoegen", and the markers in a week).
- **Grazing dialog**: One dialog adds, changes and removes a grazing everywhere: from a calendar cell, "Beweiding toevoegen" on the calendar and the Atlas layer, and the field's grazing page.
- **Planner & Insights**: Add a Graslandgebruiksysteem planner for the grazing systems (including Standweiden, Modern standweiden and Nieuw Nederlands Weiden); a plan for an earlier year records grazing that already happened. Add a Weidegang KPI dashboard, field grazing subpage, and Tijdlijn grazing lanes.
- **Sidebar & Gating**: Add dynamic "Melkvee" collapsible and onboarding CTA.
- **Atlas layer "Beweiding"**: Show per day which fields are grazed, mown, resting or not yet used in the selected year, with the grazed zones, a legend with the number of fields per status and a popup per field. Pick the day with the arrows or a date picker; the layer opens on today's day and month in the selected year. Add a grazing for the shown day from the panel. The layer is greyed out until the farm has a herd.
- **Farm page**: Add a "Beweiding vandaag" action that opens the Beweiding layer for the current year, for farms with a herd.
- **Grazing zones**: Record which part of a field was grazed: the whole field, a zone drawn on the map, or a percentage without a location. While drawing, points snap to the corners and edges of the field and of recent strips, and a finished zone is clipped to the field. Reuse zones from earlier grazings on the field, or let the strip builder cut a strip of the right size for the herd (grass intake × days ÷ grass on offer) next to the previous strips. The planner can generate successive strips on the map, the field grazing page and the Beweiding layer show the zones, and the grazing platform counts all strips on a field together.
