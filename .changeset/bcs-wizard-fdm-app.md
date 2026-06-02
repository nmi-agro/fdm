---
"@nmi-agro/fdm-app": minor
---

Add BodemConditieScore (BCS) feature to the field page.

- New BCS overview page (`bcs._index.tsx`) showing total BCS score and per-indicator breakdown with image gallery
- New BCS detail page (`bcs.$a_id.tsx`) with score card, annotated image gallery and computed lab-derived pH/OM scores
- New BCS wizard (`bcs.new.tsx`) for step-by-step field assessment:
  - Step 0: sampling date picker and optional photo upload
  - Steps 1–9: per-indicator scoring with criteria-as-buttons (direction-aware colors for negative indicators: Plasvorming, Scheuren, Spoorvorming)
  - Review step: server-side BCS preview score, prominent save button
- Image gallery with pin, text and area annotation support; annotation number shown on image; hover highlights annotation in list
- Mobile-friendly photo upload: single button with Camera / Galerij dropdown on mobile, regular file picker on desktop (`capture="environment"` for direct camera access)
- Server-side BCS preview via `api.bcs-preview` route (consistent with `calculateBcs` in fdm-calculator)
- `api.bcs-image` route for image upload with `file-type` validation
- `bcs-derived.server.ts`: derives `BcsLabContext` from soil analyses and cultivation history using `deriveCropPlanFractions` from fdm-calculator
- `bcs.ts`: client-safe indicator metadata, type definitions and BCS visual key constants
- Sidebar entry "BodemConditieScore" added between Bodem and Kaart on the field page
