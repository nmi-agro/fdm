---
"@nmi-agro/fdm-app": patch
---

Redesign the "Wat is er nieuw?" page for scanning. Each change now has its own heading, and the text uses the full foreground colour at a readable line length. The latest release is expanded, and so is any release that is new since the user's previous visit. A line at the top counts these new releases and older releases are collapsed. Each release has a link anchor and its date is marked up as `<time>`. The page follows the interior type scale and uses a single column on smaller screens. The release copy has been proofread and uses formal address throughout, and one superseded statement about the 2026 grassland-renewal reductions now points to its correction. Release data moved to `app/lib/changelog.ts`. The sidebar notification for a new release gets an accessible label on its close button.
