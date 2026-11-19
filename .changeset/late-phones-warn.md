---
"@nmi-agro/fdm-core": minor
---

Add the livestock and dairy domain: Drizzle schema tables and enums, CRUD functions, authorization rules and tests for animals, herds, barns and housing, milking, milk tanks and deliveries, feed batches and feeding, manure pits and excretion, and grazing. The action tables are named after their asset: `herd_housing`, `herd_milking`, `animal_milking`, `herd_feeding`, `animal_feeding`, `herd_excreting` and `herd_grazing`. Every herd has an animal category (`l_id_category`), so `addHerd` and `createHerdWithAnimals` require one.

`setAnimalCategory` moves an animal into the herd of another animal category, for example when a heifer becomes a dairy cow. It closes the current herd assignment, opens a new one in the active herd of that category, and creates that herd when the farm has none.

`getMilkProductionForHerd` and `getMilkingSummaryForAnimal` count milk once: when animal-level milking records exist in the timeframe, only those are summed; otherwise the herd-level records are used. Feed is summed: `getFeedingSummaryForAnimal` adds the herd-level and animal-level feedings together.

A grazing record covers the whole field, a zone within the field (`l_grazing_geometry_zone`, a Polygon or MultiPolygon clipped to the field when read), or an area without a known location (`l_grazing_area`). The grazing functions return the derived grazed area `l_grazing_area_grazed`. `getGrazingZonesForField` lists earlier zones on a field for reuse, and `getGrazedAreaForFarm` combines all zones per field into one grazed area.

A herd can be on the same field only once a day: its grazings on the same field may not share a calendar day, counting both the start and the end day, so two grazings of one day on the same field and day are rejected, also on different zones.

`addAnimal` and `updateAnimal` check the life number (`l_id_eartag`) of cattle with `parseCattleEartag` from `@nmi-agro/fdm-data`: an invalid Dutch life number is rejected, and a valid one is stored as `NL` followed by its digits. Without an explicit `l_id_worknumber`, `addAnimal` takes the work number from a Dutch life number, and otherwise numbers automatically from 10001. Work number and life number must be unique among the animals that are still on the farm, so a departed animal's numbers can be used again. `updateAnimal` now checks this too and clears the life number when it is given as an empty string or `null`.
