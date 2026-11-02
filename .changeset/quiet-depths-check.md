---
"@nmi-agro/fdm-app": minor
---

Fix the bulk soil analysis upload failing for the whole batch when one analysis has no sampling depth. The review step now shows "Diepte ontbreekt" with depth inputs for such rows and skips them until a valid depth is entered. Both bulk save routes validate all analyses before inserting anything and return a 400, naming the affected files, so a rejected batch no longer leaves partial saves behind.
