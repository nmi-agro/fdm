---
"@nmi-agro/fdm-app": minor
---

Add dairy grazing and livestock interfaces:

- **Veestapel & Animals**: Add first-koppel onboarding wizard, herd cards with optimistic debounced steppers (⊕/⊖), live GVE calculations, all-animals overview page (`/livestock/animals`), and individual animal detail & history page (`/livestock/animal/:l_id_animal`) with herd reassignment and departure logging.
- **Beweidingskalender**: Add full-season accessible Graslandkalender grid with week/day granularity, texture cues (▨/▤/░/gepland), and drag-to-paint popover with live stats.
- **Quick Entry**: Add "Koeien naar buiten / naar binnen" stateful action.
- **Planner & Insights**: Add 7-system Graslandgebruiksysteem planner (including Standweiden and Modern standweiden with partial blocks), full-section "Vandaag op de kaart" map view, Weidegang KPI dashboard, field grazing subpage, and Tijdlijn grazing lanes.
- **Sidebar & Gating**: Add dynamic "Melkvee" collapsible and onboarding CTA.
- **Grazing zones**: Record which part of a field was grazed: the whole field, a zone drawn on the map, or a percentage without a location. Reuse zones from earlier grazings on the field, or let the strip builder cut a strip of the right size for the herd (grass intake × days ÷ grass on offer) next to the previous strips. The planner can generate successive strips on the map, the field grazing page and today's map show the zones, and the grazing platform counts all strips on a field together.
