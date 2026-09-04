---
"@nmi-agro/fdm-app": minor
---

Add dairy grazing and livestock interfaces:

- **Veestapel & Animals**: Add first-koppel onboarding wizard, herd cards with optimistic debounced steppers (⊕/⊖), live GVE calculations, all-animals overview page (`/livestock/animals`), and individual animal detail & history page (`/livestock/animal/:l_id_animal`) with herd reassignment and departure logging.
- **Beweidingskalender**: Add full-season accessible Graslandkalender grid with week/day granularity, texture cues (▨/▤/░/gepland), and drag-to-paint popover with live stats.
- **Quick Entry**: Add "Koeien naar buiten / naar binnen" stateful action.
- **Planner & Insights**: Add 7-system Graslandgebruiksysteem planner (including Standweiden and Modern standweiden with partial blocks), full-section "Vandaag op de kaart" map view, Weidegang KPI dashboard, field grazing subpage, and Tijdlijn grazing lanes.
- **Sidebar & Gating**: Add dynamic "Melkvee" collapsible and onboarding CTA.
