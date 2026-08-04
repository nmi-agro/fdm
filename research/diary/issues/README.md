# Dairy domain — GitHub issue breakdown

This folder contains ready-to-file GitHub issues that implement `research\diary\dairy-farming-implementation-plan-FINAL.md` and `research\diary\rvo-animal-mapping.md`. Each file is one issue: copy its content into a new GitHub issue (title = the `#` heading).

Combined down to 4 issues, one per epic, since the sub-tasks within each epic (herds/animals/milk/feed/manure in fdm-core; the four dairy entry+insight route pairs in fdm-app; the RVO client + ingestion) are too interdependent to review or merge safely as separate PRs.

## Epics and dependency order

1. **`01-fdm-core-dairy-schema.md`** — Epic A, `fdm-core`: full dairy schema + CRUD (herds, animals, barns, milk, feed, manure, grazing). No dependencies, do first.
2. **`02-fdm-calculator-dairy-factors.md`** — Epic B, `fdm-calculator`: GVE/excretion factor tables + nitrogen-balance extension. Depends on 1 (herd/animal category inputs, manure-pit provenance FK).
3. **`03-fdm-app-dairy-ui.md`** — Epic C, `fdm-app`: all Melkvee entry screens + dairy insight cards. Depends on 1 and 2.
4. **`04-rvo-animal-integration.md`** — Epic D, `fdm-rvo` + `fdm-core`: RVO "Raadplegen Dier- en Merkdetails" client + ingestion into the dairy schema. Depends on 1; can start in parallel with 2/3.

## Suggested milestones

Issue 1 covers plan milestones M1/M2/M4 (fdm-core halves); issue 2 covers M3 (fdm-calculator); issue 3 covers the app-side halves of M1-M4; issue 4 is a separate "RVO integration" milestone that can run in parallel once issue 1 lands.
