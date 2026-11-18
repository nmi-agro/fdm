---
"@nmi-agro/fdm-data": minor
---

Add new catalogue animal-caterogie with the first dataset being the animail categories according to Dutch RVO

Add `parseCattleEartag`, which checks a cattle life number (levensnummer) and returns its normalized form and its work number (werknummer). A Dutch life number has 9 digits or 12 digits in the 120… or 130…–133… series, with the work number in the 4 digits before the check digit. The check digit is verified for the 9-digit and the electronic 130…–133… series. Life numbers from other countries are returned as entered.
