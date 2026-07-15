---
"@nmi-agro/fdm-calculator": minor
---

Added an optional `returnNull` parameter to `findHoofdteelt`, letting callers get `null` instead of the regulatory fallback `GROENE_BRAAK` (`"nl_6794"`) when no cultivation overlaps the May 15–July 15 window. Defaults to `false`, preserving existing behaviour.
