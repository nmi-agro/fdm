---
"@nmi-agro/fdm-app": minor
---

Add advanced cultivation history view to atlas field details

Introduces a spatial cultivation history flow diagram that visualises how a field's parcel boundaries changed over time (splits, merges, expansions, shrinkage). Users can toggle between the existing simple timeline ("Eenvoudig") and the new advanced view ("Uitgebreid") via a tab control. The selected tab is persisted in session storage via a Zustand store.
