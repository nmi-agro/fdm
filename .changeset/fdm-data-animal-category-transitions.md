---
"@nmi-agro/fdm-data": minor
---

Add the moves an animal can make between animal categories. Every animal-category catalogue provides its moves next to its list of categories (the RVO catalogue in `catalogues/rvo/`), returned by `getAnimalCategoryTransitionsCatalogue`. `getAnimalCategoryTransitions` combines the moves of all catalogues and lists, per category, the next life stages of the same species and the sexes that can reach them, and `getAnimalCategoryTransitionSexes` returns the sexes for which a move from one category to another is possible. New types: `AnimalCategoryTransition` and `CatalogueAnimalCategoryTransitions`. A move to the same category is always possible; a move back to a younger age group or to another species is not.

Categories 401 (Fokzeugen incl. biggen tot ca. 25 kg) and 751 (Fokteven, nertsen) now allow both sexes, because they include the piglets of the sows and the males and young of the mink.
