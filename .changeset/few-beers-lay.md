---
"@nmi-agro/fdm-data": minor
---

Add the animal category catalogue `getAnimalCategoriesCatalogue`, with the Dutch RVO animal categories as its first dataset (`rvo`), and the feed catalogue `getFeedCatalogue`, with a first dataset (`nmi`) of example feeds derived from the RVO feed types plus some additions. Each feed has a fixed catalogue ID. RVO categories that include animals of both sexes (122, 600, 971 and 981) allow both.

Add `parseCattleEartag`, which checks a cattle life number (levensnummer) and returns its normalized form and its work number (werknummer). A Dutch life number has 9 digits or 12 digits in the 120… or 130…–133… series, with the work number in the 4 digits before the check digit. The check digit is verified for the 9-digit and the electronic 130…–133… series. Life numbers from other countries are returned as entered.
