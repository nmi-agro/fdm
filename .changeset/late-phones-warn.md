---
"@nmi-agro/fdm-core": minor
---

Add the livestock and dairy domain: Drizzle schema tables and enums, CRUD functions, authorization rules and tests for animals, herds, barns and housing, milking, milk tanks and deliveries, feed batches and feeding, manure pits and excretion, and grazing. The action tables are named after their asset: `herd_housing`, `herd_milking`, `animal_milking`, `herd_feeding`, `animal_feeding`, `herd_excreting` and `herd_grazing`. Every herd has an animal category (`l_id_category`), so `addHerd` and `createHerdWithAnimals` require one.

An animal takes the animal category of its herd. `assignAnimalToHerd` moves an animal to a herd that the caller chooses, optionally on a date in the past, for example when a heifer calves and joins the dairy cows. It closes the current herd assignment on that date and opens a new one, so the history is kept.

A new herd has no start date unless one is given, and then counts as running from the beginning. Adding or assigning an animal to a herd (`addAnimal`, `addAnimalsToHerd`, `createHerdWithAnimals`, `assignAnimalToHerd`, `reassignHerdAnimals`, `updateAnimalAssigning`) is rejected when that herd has not started yet or has already ended on the date of the assignment. Corrections with `updateAnimalAssigning` may not end before they start or overlap another assignment of the animal. The category of a herd can no longer change once the herd has had animals. The census (`getCensusForFarm`) counts the herds that run on its date.

An animal with a departure in the future stays in its herd until that date: `getAnimal`, `getAnimalsForHerd`, the census and the bulk moves (`reassignHerdAnimals`, `leaveHerd`) treat it as present until then, and a move keeps the departure. Moving or clearing a departure with `updateAnimal` moves or clears the end of the herd assignment, and an animal that becomes present again must have unique numbers.

Milk, feed, excretion and housing records can only link a herd or animal to a milk tank, feed batch, manure pit or barn of the same farm. All changes to the herds, animals, assignments, departures and housing of one farm run one after another. A departure cannot come before a move to another herd that is already recorded, and correcting a departure only moves the end of the animal's last assignment. A herd can only end (`updateHerd` with `l_end`) when no animal is in it on its end date; `leaveHerd` ends a herd together with its animals. A reduction only picks animals that are already in the herd on its date.

`getMilkProductionForHerd` and `getMilkingSummaryForAnimal` count milk once: when animal-level milking records exist in the timeframe, only those are summed; otherwise the herd-level records are used. Feed is summed: `getFeedingSummaryForAnimal` adds the herd-level and animal-level feedings together.

A grazing record covers the whole field, a zone within the field (`l_grazing_geometry_zone`, a Polygon or MultiPolygon clipped to the field when read), or an area without a known location (`l_grazing_area`). The grazing functions return the derived grazed area `l_grazing_area_grazed`. `getGrazingZonesForField` lists earlier zones on a field for reuse, and `getGrazedAreaForFarm` combines all zones per field into one grazed area.

A herd can be on the same field only once a day: its grazings on the same field may not share a calendar day, counting both the start and the end day, so two grazings of one day on the same field and day are rejected, also on different zones.

`addAnimal` and `updateAnimal` check the life number (`l_id_eartag`) of cattle with `parseCattleEartag` from `@nmi-agro/fdm-data`: an invalid Dutch life number is rejected, and a valid one is stored as `NL` followed by its digits. Without an explicit `l_id_worknumber`, `addAnimal` takes the work number from a Dutch life number, and otherwise numbers automatically from 10001. Work number and life number must be unique among the animals that are still on the farm, so a departed animal's numbers can be used again. `updateAnimal` now checks this too and clears the life number when it is given as an empty string or `null`.
