---
"@nmi-agro/fdm-calculator": minor
---

Added `collectInputForNitrogenBalanceForFarms` and `collectInputForOrganicMatterBalanceForFarms` to collect balance inputs for multiple farms, reducing database lookups by deduplicating catalogue queries across farms. The functions use a composable pattern: first fetch enabled catalogues for all farms in one query, then fetch catalogue items once per unique catalogue, then process each farm individually.
