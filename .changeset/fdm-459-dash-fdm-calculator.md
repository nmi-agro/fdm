---
"@nmi-agro/fdm-calculator": minor
---

Add `getCultivationSuggestionResultsForFarm`, which suggests a main cultivation for several fields of a farm with the same result per field as `getCultivationSuggestionResult`. It reads the fields, the cached estimates and the default dates of the suggested crops once for the farm, and requests the estimates that are not cached yet from the NMI API with a concurrency limit (default 4).
