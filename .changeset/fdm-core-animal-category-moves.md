---
"@nmi-agro/fdm-core": minor
---

Only move an animal to a herd whose category it can become. `assignAnimalToHerd`, `reassignHerdAnimals` and `updateAnimalAssigning` now reject a move to another species, back to a younger age group, or to a category the animal's sex can't reach (for example a red deer stag from 974 back to 973, a water buffalo to the dairy cows, or a bull calf to the heifers). A move in the past and a corrected assignment are also checked against the herd the animal is in after it. `reassignHerdAnimals` moves all animals of a herd or none.

An animal of unknown sex gets the sex of a move or category that only one sex can make or have: a calf that moves to the heifers becomes female, and animals added to a herd of dairy cows by `addAnimal`, `addAnimalsToHerd` or `createHerdWithAnimals` are female.

New exports: `checkAnimalCategoryMove` and `getAnimalSexForCategory`, with the types `AnimalCategoryMove` and `AnimalSex`.
