---
"@nmi-agro/fdm-app": minor
---

Improved the UI/UX and code quality of the fertilizers pages with the following:

- **Fertilizer Table:** Added all nutrient columns (DS, OS, MgO, CaO, Na₂O, SO₃, trace elements, and N-efficiency). Columns are hidden by default and manageable via a new "Kolommen" dropdown.
- **Searchable Catalogue:** Replaced the card grid with a searchable catalogue picker. It distinguishes between standard and custom fertilizers with subtle tagging and uses color-coded RVO category badges. The search index now includes RVO category names.
- **Modernized Form:** Migrated the fertilizer form to the latest `Field` component system. Implemented a 3-column grid for numeric fields and optimized the application method section.
- **Improved Sidebar ("Samenvatting"):** Added a professional summary sidebar that calculates "Werkzame N" live and displays key analytics in a clean monochromatic format.
- **Mobile Optimizations:** Added a smart floating action bar on mobile that hides when the main save button is visible. Reduced excessive padding across all fertilizer pages.
- **Better Navigation:** Entire table rows are now clickable. Fixed the "Make a copy" feature (now "Gebruik als sjabloon") with reliable pathing and friendly guidance.
- **Refactoring:** Extracted shared logic for defaults and payload building into `utils.ts`.
- **Component Consolidation:** Merged duplicate form pages into a single reusable `FarmNewFertilizerBlock`.
- **Server/Client Safety:** Correctly separated server-side action logic from client-side utility helpers to prevent build errors.
- **Consistency:** Aligned typography, card styling, and badge usage with the rest of the application.
