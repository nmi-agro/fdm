---
"@nmi-agro/fdm-calculator": minor
---

Switch the nitrogen mineralization module to the NMI Dyna v2 endpoint and add the building blocks for the redesigned Mineralisatie app: `prepareMineralizationInput` builds the Dyna v2 request for one field and year (only the main cultivation and the green manure or catch crops after it, the selected year's harvests and fertilizer applications), `getDynaV2` runs the cached calculation, `getWeatherForecast` returns the weather forecast for a location, `deriveMineralizationInsights` derives the season phase, key figures, signals and improvement points, and `applyScenarioToRequest`, `diffScenario` and `getMineralizationScenarioSchema` support what-if scenarios. Also adds `getFieldExclusionReason`, which leaves out buffer strips, nature and landscape elements. The used input of a calculation lists each cultivation with its crop rotation group (`b_lu_croprotation`), so apps can show it in the usual crop colors.

**Breaking:** the N-supply integration (`getNSupply`, `requestNSupply`, `buildNSupplyRequest`, `assessDataCompleteness`, `methodRequirements`) and Dyna v1 (`getDyna`, `requestDyna`, `buildDynaRequest`, `dynaResponseDataSchema`) are removed, together with their types.

Harvests of one cultivation need to be at least 10 days apart for Dyna: `prepareMineralizationInput` leaves out a harvest that falls within 10 days after the previous one and lists it in `usedInput.omittedHarvests`, and the scenario schema rejects harvests that are closer together; the minimum is exported as `DYNA_V2_MIN_DAYS_BETWEEN_HARVESTS`.

A scenario holds all harvests of the main cultivation in the year (`harvests`, each with its `b_id_harvesting`), so the cuts of grassland can be changed, added or removed; `diffScenario` returns the harvests to add, update and remove. `usedInput.harvests` now includes `b_id_harvesting`.
