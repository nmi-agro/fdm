---
"@nmi-agro/fdm-app": patch
---

Redesign the "Wat is er nieuw?" page for scanning. Each change now has its own heading, and the text uses the full foreground colour at a readable line length. The latest release is expanded, and so is any release that is new since the user's previous visit. A line at the top counts these new releases and older releases are collapsed. Each release has a link anchor and its date is marked up as `<time>`. The page follows the interior type scale and uses a single column on smaller screens. The release copy has been proofread and uses formal address throughout, and one superseded statement about the 2026 grassland-renewal reductions now points to its correction. Release data moved to `app/lib/changelog.ts`.

The sidebar notification for a new release is redesigned as a compact, flat notice that sits in the sidebar menu. It shows "Nieuw in" followed by the application name, with the title of the latest release underneath. Closing it now only hides it until the next release, so the "Wat is er nieuw?" page still shows which versions are new since the last visit. New users no longer see the notification for the release that was current when they started. The close button is larger and has an accessible label.
