# [fdm-core] Dairy domain schema & CRUD — herds, animals, milk, feed, manure, grazing

**Epic:** A — fdm-core dairy schema & CRUD · **Depends on:** none · **Milestones covered:** M1 Foundation, M2 Milk, M4 Feed, manure & grazing

## Background

`fdm-core` today has no farm-type field and no animal/herd/barn/milk/feed/manure/grazing concept at all — the only animal-adjacent concept is a per-year `intending_grazing` boolean. This single issue lands the entire dairy asset-action schema and its CRUD layer in `fdm-core`, combining what was originally scoped as three separate issues (M1 foundation, M2 milk, M4 feed/manure/grazing) because the tables are too interdependent (herds/animals underpin milk, feed, and manure) to review or merge safely in isolation. The `fdm-calculator` factor tables and nitrogen-balance extension are a **separate** issue (see the fdm-calculator epic) since that is a distinct package with its own release surface. See `research\diary\dairy-farming-implementation-plan-FINAL.md` §3, §4 (all subsections), §8.1, and §9 open questions 1, 2, 3, 7, 8, 9 before implementing.

## Scope

### Foundation — farms, herds, animals, barns (plan §4.1, §4.2)
- `farms.b_type_farm` — a multi-select array column (e.g. `{arable, dairy}`).
- `herds` (ASSET): `b_id_herd` PK, `b_name_herd`, `b_herd_category` (`animalCategoryEnum`, RVO diercategorie); `herd_acquiring`/`herd_discarding`.
- `animals` (ASSET): `b_id_animal` PK, `b_id_eartag`, `b_id_worknumber`, `b_species` (`animalSpeciesEnum`, currently `rund` only), `b_breed`, `b_coatcolor`, `b_birthdate`, `b_sex` (`animalSexEnum`).
- `animal_arriving` (mirrors `field_acquiring`, `b_arriving_method`: born/purchased/imported), `animal_leaving` (mirrors `field_discarding`, `b_leaving_method`: died/sold/slaughtered/exported), `animal_assigning` (animal↔herd over time, one table with `m_start`/`m_end`, `m_end = NULL` meaning current).
- `barns` (ASSET, `b_rav_type`/`b_floor_area`/`b_pit_area`/`b_milking_system`, all nullable for now), `barn_acquiring`/`barn_discarding`, `housing` (herd housed in barn for a period).
- Domain files `herd.ts`, `animal.ts`, `barn.ts` with CRUD following the existing `fn(fdm, principal_id, ...)` + `fdm.transaction` + `createId()` + `checkPermission`/`grantRole` + `handleError` pattern, plus two bulk helpers on `animal.ts`:
  - `addAnimalsToHerd(fdm, principal_id, b_id_herd, count, defaults?)` — inserts `count` `animals` + `animal_arriving` + `animal_assigning` rows in one transaction; reducing a count closes the newest assignments and marks the surplus animals as leaving.
  - `setAnimalCategory(fdm, principal_id, b_id_animal, new_category)` — closes the current `animal_assigning` and opens a new one into the herd of the new category, creating that herd if needed; preserves full history.
- New resources `barn`, `herd`, `animal` in `authorization.ts` (owner: read/write/list/share; advisor: read/write/list; researcher: read); resource chains via `*_acquiring.b_id_farm` / `animal_arriving.b_id_farm`.

### Milk (plan §4.3)
- `milk_tanks` (ASSET, identity only for now).
- `milking` (ACTION, herd → tank, in-flow, optional `b_milk` kg produced) and `milking_animal` (ACTION, animal → tank, in-flow; **additive**, per-animal, period-based like `animal_assigning`, PK `(b_id_animal, b_id_milktank, m_start)`) — not a replacement for `milking`; some farms use only herd-level rows, some (robot parlours) only animal-level rows, some both for different sub-groups of the same herd.
- `milk_deliveries` (ASSET), `delivering` (tank → delivery, the milk-statement number), `milk_sampling` (delivery → analysis), `milk_analyses` (`b_milk_fat`/`b_milk_protein`/`b_milk_lactose`/`b_milk_urea`/`b_milk_scc`).
- `milk.ts` domain file with CRUD for all of the above; new `milk` resource in `authorization.ts`, resolving via `milking → herd` **or** `milking_animal → animal → animal_arriving.b_id_farm`.
- A read-time aggregation helper that computes total milk production for a herd/period **without double counting** when both `milking` and `milking_animal` rows exist for overlapping periods — per §9 open question 9, prefer the animal-level sum for a period when any `milking_animal` rows exist for that herd's animals, otherwise fall back to the herd-level row; document this rule in the function's docstring since it is a judgment call, not a hard requirement from the user.

### Feed, manure & grazing (plan §4.4, §4.5, §4.6)
- `feed_batches` (ASSET, `f_batch_type`/`f_batch_origin`), `feed_sampling`/`feed_analyses` (`f_dm`/`f_cp`/`f_vem`/`f_oeb`/`f_ndf`, all optional), `feeding` (batch → herd) and `feeding_animal` (batch → animal; **additive**, supplemental, period-based like `animal_assigning`) — not a component that must sum exactly against the herd total; a farm can record both a herd-level ration and animal-specific top-ups at once.
- `manure_pits` (ASSET, identity only for now), `excreting` (herd → pit, in-flow, optional `p_amount`), `manure_discarding` (pit → delivery), `manure_deliveries`, `manure_sampling`, `manure_analyses` (`p_n_rt`/`p_p_rt`/`p_dm`/`p_om`).
- **One column on the existing `fertilizer_acquiring` table**: add optional `b_id_manurepit` FK → `manure_pits`, the only change to any existing (non-dairy) table in the whole plan — confirm with the team per §9 open question 7 before landing it. Verify with an integration test that an applied own-manure fertilizer batch's nutrient values can be populated from (or linked to) its `manure_analyses`.
- `grazing` (ACTION, herd grazes field for a period; optional `b_id` FK → `fields`, `b_graze_days`/`b_graze_hours`/`b_graze_area`/`b_graze_type`).
- Domain files `feed.ts`, `manure.ts`, `grazing.ts` with CRUD; new resources `feed`/`manure` in `authorization.ts` (feed resolves via `feeding → herd` **or** `feeding_animal → animal → animal_arriving.b_id_farm`; manure via `excreting → herd`).
- A feed self-sufficiency helper: `Σ f_amount·f_dm where f_batch_origin = own_land ÷ total roughage DM`, computable from `feeding`/`feed_analyses` reads.

### Cross-cutting
- New enums across all of the above: `animalCategoryEnum`, `animalSexEnum`, `animalSpeciesEnum`, `arrivingMethodEnum`, `leavingMethodEnum`, `feedTypeEnum`, `feedOriginEnum`, `grazeTypeEnum`; export `*Options` arrays for app dropdowns.
- `*.types.d.ts` for join shapes (derived herd/animal census, milk summary, feed summary, manure summary).
- Single schema migration (or a small ordered set) generated via `pnpm db:generate` (drizzle-kit) covering everything above.
- `src/index.ts` — export all new functions, `*Options` arrays, and inferred types.

## Acceptance criteria

- [ ] Schema migration(s) generated and applied cleanly against a fresh test database.
- [ ] `addAnimalsToHerd` creates the right number of `animals`/`animal_arriving`/`animal_assigning` rows in a single transaction; reducing a count closes the newest assignments and marks the surplus animals as leaving.
- [ ] `setAnimalCategory` closes the old `animal_assigning` row and opens a new one into the correct herd (creating it if needed), never leaving two concurrently-open assignments for the same animal.
- [ ] Herd/animal counts per RVO category are **derived** (counting active `animal_assigning` rows) — no stored census column anywhere.
- [ ] `delivering` + `milk_sampling` → `milk_analyses` works end-to-end without requiring any `milking`/`milking_animal` rows; `milking` and `milking_animal` can coexist for the same herd/period without a schema-level conflict.
- [ ] The milk aggregation helper is covered by a test with only herd-level rows, only animal-level rows, and both at once (asserting no double count). Production and delivery totals are never summed together anywhere in fdm-core.
- [ ] `feeding` and `feeding_animal` can coexist for the same herd/period with no schema-level conflict.
- [ ] Own manure flows through the **existing** `fertilizer_acquiring`/`fertilizer_applying` chain via the new optional `b_id_manurepit` FK.
- [ ] Authorization: an unauthorized principal cannot read/write herds/animals/milk/feed/manure belonging to another farm; each new resource has at least one denied-permission test.
- [ ] `*.test.ts` (Vitest, via `createFdmServer` + `addFarm`) cover CRUD happy paths, the bulk/reassignment helpers, the milk-aggregation helper, the feed-self-sufficiency helper, and at least one permission-denied case per new domain file.
- [ ] `pnpm build` succeeds for `fdm-core` so downstream packages can consume the new `dist` exports.

## Out of scope

`fdm-calculator` GVE/excretion factor tables and nitrogen-balance extension (separate epic/issue), all `fdm-app` UI, RVO ingestion.

## References

`dairy-farming-implementation-plan-FINAL.md` §3, §4.1-§4.9, §8.1, §9 (open questions 1, 2, 3, 7, 8, 9).
