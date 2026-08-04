---
name: fdm-schema
description: Use when working on the FDM database schema or data model — adding or changing tables and columns in fdm-core/src/db/schema.ts, generating or reviewing Drizzle migrations, naming columns and parameters, modelling a new farm asset or farm event, registering a new authorization resource, or reviewing a schema diff for convention drift. Covers the Asset–Action model, the b_/p_/a_/m_/l_/f_ column prefix vocabulary, table naming, enum and custom-type patterns, the schema-change workflow, and schema anti-patterns. Not for fdm-app UI work, agronomic calculation logic in fdm-calculator, agent prompts in fdm-agents, or REST endpoint design in fdm-api.
version: 1.0.0
user-invocable: true
argument-hint: "[explain|add-table|add-column|review|check] [target]"
license: MIT
---

The FDM schema is the contract every other package depends on. A column added with the wrong prefix, an event modelled as a mutable attribute, or a migration that never got generated will outlive the PR that introduced it and cost far more to undo than to get right. This skill exists so that every agent making a schema change arrives at the same answer the maintainers would.

**Scope.** This skill owns the data model: what to model, what to call it, and how to land the change. It does not own how to write `fdm-core` functions beyond the authorization rules a schema change forces, nor UI, calculations, agents, or the REST API. See `.github/skills/README.md` for the sibling skills.

## Commands

| Command | Do this |
|---|---|
| `explain [topic]` | Answer from this skill first; link to `fdm-docs/` for exhaustive per-table reference. Do not paraphrase the schema file. |
| `add-table` | Work the Asset–Action decision, then Naming, then the Schema-change workflow — in that order, skipping nothing. |
| `add-column` | Naming section, then the Schema-change workflow. |
| `review [diff]` | Walk the Anti-patterns section against the diff and run the checker. |
| `check` | Run `pnpm check-schema` (add `--strict` to also flag missing unit comments). |

## Orientation

Four PostgreSQL schemas, all defined in `fdm-core/src/db/`:

| PG schema | File | Notes |
|---|---|---|
| `fdm` | `schema.ts` | The farm data model. Almost every change belongs here. |
| `fdm-authn` | `schema-authn.ts` | **Generated** by better-auth (`pnpm db:generate-authn`). camelCase by design. Never hand-edit. |
| `fdm-authz` | `schema-authz.ts` | Roles, permissions, audit trail. |
| `fdm-calculator` | `schema-calculator.ts` | Cached calculation results. Derived data lives here and nowhere else. |

Migration bookkeeping lives in `fdm-migration.migrations`. Migrations are applied by `fdm-app/app/lib/fdm-migrate.server.js` on startup.

The naming conventions below apply to the **`fdm`** schema — that is the farm data model, and it is where the domain prefix vocabulary is mandatory. `fdm-authz` and `fdm-calculator` are infrastructure schemas: their columns are plain descriptive snake_case (`principal_id`, `calculation_hash`, `created_at`) and they are exempt from the prefix and `created`/`updated` rules. Do not "fix" them, and do not copy their style into `fdm`.

Read once before your first non-trivial change: `fdm-docs/docs/getting-started/02-the-asset-action-model.md` and `fdm-docs/docs/core-concepts/01-database-schema.md`.

## The Asset–Action model

FDM separates **assets** (things that exist) from **actions** (things that happen to them). This is the single most important rule in the schema, and most modelling mistakes are a failure to apply it.

- **Asset** — a persistent entity with an identity of its own: `farms`, `fields`, `fertilizers`, `cultivations`, `harvestables`, `soil_analysis`, `measures`. Table name is a plural noun. It holds properties intrinsic to the thing.
- **Action** — a dated event involving one or more assets: `field_acquiring`, `fertilizer_applying`, `cultivation_starting`, `cultivation_harvesting`, `soil_sampling`, `measure_adopting`. Table name is `<asset>_<verb>ing`. It holds a date, the participating asset IDs, and the parameters of that event.

### Deciding which you have

Ask: *does it have a date on which it happened?* If yes, it is an action, even when it feels like a property.

A field's owning farm looks like a property of the field, but a farm can acquire and release a field, so it is the `field_acquiring` action carrying `b_start` and `b_acquiring_method`. A fertilizer's nitrogen content is intrinsic to the product, so it is a column on `fertilizers_catalogue`; the amount spread on a field on a given day is the `fertilizer_applying` action.

### Record events, never derived values

The model stores what happened, and downstream packages compute what it means. Never add a column holding a value that could be recomputed from the actions already recorded.

```ts
// WRONG — an aggregate that silently goes stale and cannot be audited
b_n_total_applied: numericCasted(), // kg N / ha this season

// RIGHT — record each application; fdm-calculator sums them
export const fertilizerApplication = fdmSchema.table("fertilizer_applying", {
  p_app_id: text().primaryKey(),
  b_id: text().notNull().references(() => fields.b_id),
  p_id: text().notNull().references(() => fertilizers.p_id),
  p_app_amount: numericCasted(), // kg / ha
  p_app_method: applicationMethodEnum(),
  p_app_date: timestamp({ withTimezone: true }),
  // ...
})
```

If a calculation is expensive enough to need caching, cache it in the `fdm-calculator` PG schema, never in `fdm`.

### Time and lifecycle, not deletion

An asset that stops being relevant is *ended*, not deleted, because the history of what happened to it stays true. Ending is itself an action, in its own table: `field_discarding` (`b_end`), `cultivation_ending` (`b_lu_end`), `fertilizer_picking` (`p_picking_date`), `organic_certifications_holding`. Start and end timestamps use the owning domain's prefix: `b_start`/`b_end`, `b_lu_start`/`b_lu_end`, `m_start`/`m_end`.

```ts
// WRONG — flags and jsonb bags lose who, when and why
b_deleted: boolean().notNull().default(false),
b_deletion_metadata: jsonb(),

// RIGHT — a dedicated, typed action table
export const fieldDiscarding = fdmSchema.table("field_discarding", {
  b_id: text().primaryKey().notNull().references(() => fields.b_id),
  b_end: timestamp({ withTimezone: true }),
  created: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated: timestamp({ withTimezone: true }),
})
```

## Naming

Column names are **not** camelCase and are **not** English sentences. They are prefixed domain codes, deliberately compact and stable, and they are identical in the database, in the Drizzle schema, in the TypeScript types, and in the API payloads. Never rename one for readability.

### Prefix vocabulary

| Prefix | Domain | Examples |
|---|---|---|
| `b_` | Farm, field and business assets (Dutch *bedrijf*) | `b_id_farm`, `b_name_farm`, `b_id`, `b_geometry`, `b_soiltype_agr`, `b_gwl_class` |
| `b_lu_` | Cultivation attributes (Dutch *landgebruik*) — a sub-namespace of `b_`, always used for anything describing a crop | `b_lu`, `b_lu_catalogue`, `b_lu_start`, `b_lu_end`, `b_lu_yield`, `b_lu_variety`, `b_lu_n_harvestable` |
| `p_` | Fertilizer products and their application | `p_id`, `p_id_catalogue`, `p_app_id`, `p_app_amount`, `p_app_method`, `p_n_rt`, `p_dm` |
| `a_` | Soil analysis parameters and soil imagery | `a_id`, `a_date`, `a_source`, `a_p_al`, `a_som_loi`, `a_image_type` |
| `m_` | Measures (agronomic practices) | `m_id`, `m_name`, `m_start`, `m_end`, `m_stage_applicability` |
| `l_` | Livestock: animals, herds, barns (in development) | `l_id_animal`, `l_id_herd`, `l_species`, `l_birthdate` |
| `f_` | Feed and feed analysis (in development) | `f_id_batch`, `f_dm`, `f_vem`, `f_cp` |

Only `created` and `updated` are unprefixed. Everything else in the `fdm` schema carries a prefix; if none of the above fits, the change likely needs a new domain and should be discussed rather than invented. The one standing exception is the `hash` column on catalogue tables, which stores a content hash used to detect `fdm-data` changes.

### Composing a name

- **Identifiers**: `<prefix>_id` for the asset's own key when unambiguous (`b_id` field, `p_id` fertilizer, `a_id` soil analysis, `m_id` measure), otherwise `<prefix>_id_<entity>` (`b_id_farm`, `b_id_harvesting`, `b_id_sampling`, `l_id_animal`). Cultivation is the exception: its key is `b_lu`.
- **Catalogue references**: `<prefix>_id_catalogue` or `<name>_catalogue` (`p_id_catalogue`, `b_lu_catalogue`).
- **Names**: `<prefix>_name[_<entity>]`, with `_nl`/`_en` suffixes when a catalogue carries both languages (`b_name_farm`, `p_name_nl`, `p_name_en`, `b_lu_name`).
- **Dates**: follow the columns already in the table you are editing rather than introducing a third variant (`p_app_date`, `p_acquiring_date`, `b_sampling_date`, `b_lu_harvest_date`).
- **Nutrient content on fertilizers** uses `p_<element>_<form>`: `_rt` total content, `_if` inorganic fraction, `_of` organic fraction, `_fr` fraction, `_wc` working coefficient. So `p_n_rt` is total nitrogen, `p_n_if` inorganic N, `p_n_wc` the N working coefficient.
- **Soil parameters** use `a_<parameter>_<method>`, because a soil value is meaningless without its extraction method: `a_p_al` (P-Al), `a_p_cc` (P-CaCl2), `a_ph_cc` (pH-CaCl2), `a_som_loi` (organic matter, loss-on-ignition), `a_n_rt` (total N), `a_k_cc`. Never add a soil parameter without its method suffix.

### Table naming

- Assets: plural noun — `farms`, `fields`, `fertilizers`, `cultivations`, `harvestables`, `measures`.
- Catalogues: `<asset>_catalogue` — `fertilizers_catalogue`, `cultivations_catalogue`, `measures_catalogue`.
- Actions: `<asset>_<verb>ing` — `field_acquiring`, `fertilizer_applying`, `cultivation_harvesting`, `soil_sampling`, `harvestable_sampling`, `measure_adopting`, `soil_image_annotating`.
- The exported Drizzle constant is camelCase of the table name: `fieldAcquiring`, `cultivationHarvesting`, `fertilizersCatalogue`.

### Table boilerplate

Every table in the `fdm` schema carries the same skeleton. Copy it exactly.

```ts
export const cultivations = fdmSchema.table(
  "cultivations",
  {
    b_lu: text().primaryKey(),
    b_lu_catalogue: text().notNull().references(() => cultivationsCatalogue.b_lu_catalogue),
    b_lu_yield: numericCasted(), // kg DM / ha
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex("b_lu_idx").on(table.b_lu)],
)

export type cultivationsTypeSelect = typeof cultivations.$inferSelect
export type cultivationsTypeInsert = typeof cultivations.$inferInsert
```

Non-negotiable per table: `created` (notNull, defaultNow) and `updated`; a `uniqueIndex("<pk>_idx")` on the primary key (or a `primaryKey({ columns: [...] })` for composite keys, as in `field_acquiring`); and the exported `<table>TypeSelect` / `<table>TypeInsert` pair, which is what the rest of the monorepo imports.

### Enums

An enum is declared as an exported `Options` array of `{ value, label }` — labels are the Dutch UI strings — plus a `fdmSchema.enum` whose **PG name equals the column name it is used for**.

```ts
export const soilAnalysisSourceOptions = [
  { value: "nl-rva-l006", label: "Eurofins Agro" },
  { value: "other", label: "Overig" },
]
export const soilAnalysisSourceEnum = fdmSchema.enum(
  "a_source",
  soilAnalysisSourceOptions.map((x) => x.value) as [string, ...string[]],
)
// used as: a_source: soilAnalysisSourceEnum().default("other"),
```

Values are stable machine codes, never user-facing text. Where a national code list exists, use it verbatim (`nl_01`, `nl_02` for acquiring methods; `HC010`, `HC020` for harvest categories). The `Options` array is exported because `fdm-app` renders it — do not inline the values.

### Types and units

- Numeric agronomic values use `numericCasted()` from `db/schema-custom-types.ts`, never `real`/`doublePrecision`. It stores the value as SQL `numeric` and parses it to a JavaScript `number`, avoiding Drizzle's default of returning numerics as strings.
- Geometry uses `geometry<"Polygon" | "MultiPolygon">(...)` and needs a GiST index: `index("b_geom_idx").using("gist", table.b_geometry)`.
- **Every numeric column gets a trailing unit comment**: `p_app_amount: numericCasted(), // kg / ha`. A number without a documented unit is a bug waiting to happen, and reviewers will ask for it.
- Timestamps are always `timestamp({ withTimezone: true })`.
- IDs are `text()` populated by `createId()` (`src/id.ts`, nanoid, 16 chars, lookalike-free alphabet). Never `serial`, never a database default, never a UUID.

## Schema-change workflow

Work these steps in order. Steps 2 and 3 are the ones agents skip, and skipping them ships a schema the database will never have.

1. **Edit the schema file** — `fdm-core/src/db/schema.ts` (or `schema-authz.ts` / `schema-calculator.ts`). Apply the naming and boilerplate rules above.
2. **Generate the migration** — `cd fdm-core && pnpm db:generate`. This runs drizzle-kit against `drizzle.config.ts` and writes SQL to `src/db/migrations/`. Never hand-write a migration file, and never edit one that is already merged.
3. **Read the generated SQL.** Confirm it does what you intended and nothing more. A `DROP COLUMN` or `ALTER COLUMN ... SET NOT NULL` you did not expect means the change is destructive: for renames and type changes, add an explicit data-migration step so existing rows survive.
4. **Update the core functions** — add or adjust the CRUD in the matching `fdm-core/src/<domain>.ts`, with its `<domain>.types.d.ts` and colocated `<domain>.test.ts`.
5. **Update the documentation** — `fdm-docs/docs/core-concepts/01-database-schema.md` and the relevant `core-concepts/` page. The docs are the published contract.
6. **Test** — `cd fdm-core && pnpm exec dotenvx run -- vitest run src/<domain>.test.ts`. Requires a PostgreSQL instance with PostGIS enabled, reachable via the `POSTGRES_*` variables in your `.env`; developers normally run one locally on the machine.
7. **Check conventions** — `pnpm check-schema` from the repository root.
8. **Add a changeset** — `pnpm changeset`, select `@nmi-agro/fdm-core` and any downstream package. Schema changes are always at least a minor bump.
9. **Rebuild before touching downstream** — consumers import the built `dist`, so run `pnpm turbo build` (or `pnpm build` in `fdm-core`) before `fdm-app`/`fdm-calculator` will see the new types.
10. **PR targets `development`.**

**Never:** hand-write or edit migrations; edit `schema-authn.ts` (regenerate it with `pnpm db:generate-authn`); rename a column without a migration path; add a table without `created`/`updated`; commit a schema change with no migration file.

## Authorization for a new resource

If your schema change introduces a resource users can be granted access to, it is not finished until it is registered in `fdm-core/src/authorization.ts` (PG schema `fdm-authz`).

- Add the resource to `resources` (currently `user`, `organization`, `farm`, `field`, `cultivation`, `fertilizer_application`, `soil_analysis`, `soil_image`, `harvesting`) and add its `permissions` entries for each of the roles `owner`, `advisor`, `researcher` across the actions `read`, `write`, `list`, `share`.
- Public `fdm-core` functions take the instance and the acting principal first: `fn(fdm: FdmType, principal_id: string, …)`.
- Mutations run inside `fdm.transaction(async (tx) => …)`, call `checkPermission(tx, resource, action, resource_id, principal_id, "fnName")` before touching data, generate IDs with `createId()`, `grantRole` on creation, and are wrapped in `try/catch` re-throwing via `handleError(err, "Exception for fnName", { …context })` — never a raw `throw`.
- Reads check permission too. A query that filters by `b_id_farm` alone is not access control.

The broader conventions for authoring core functions are the future `fdm-core-api` skill; here, do only what the schema change requires.

## Checking your work

```
pnpm check-schema            # errors fail CI
pnpm check-schema -- --strict  # also lists numeric columns missing a unit comment
```

The checker (`.github/skills/fdm-schema/scripts/check-schema-conventions.mjs`, zero dependencies, no database) enforces: column naming per PG schema, `created`/`updated` on every `fdm` table, exported `TypeSelect`/`TypeInsert`, enum PG name matching its column, and jsonb usage. It runs on every push as the `Schema Conventions` workflow (`.github/workflows/schema-conventions.yml`).

A genuine exception goes in the `ALLOWLIST` at the top of the script **with a written reason**. Adding an allowlist entry to silence a finding you have not understood defeats the purpose; the default answer to a finding is to fix the schema.

## Anti-patterns

| Anti-pattern | Instead |
|---|---|
| `metadata: jsonb()` holding structured fields | A dedicated, fully typed table or columns. jsonb is for genuinely open-ended payloads only. |
| `harvestDate`, `fieldName`, `amount` | `b_lu_harvest_date`, `b_name`, `p_app_amount` — prefixed snake_case, no exceptions. |
| A column storing a computed total or balance | Record the underlying actions; compute in `fdm-calculator`, cache in the `fdm-calculator` PG schema. |
| A soil parameter without a method suffix (`a_p`) | `a_p_al`, `a_p_cc`, `a_p_wa` — the method is part of the meaning. |
| A numeric column with no unit comment | `numericCasted(), // kg N / ha` |
| `b_deleted` flag or a hard `DELETE` | A `*_discarding` / `*_ending` action table with an end timestamp. |
| Table without `created`/`updated` | Add both; every table is auditable. |
| Missing `TypeSelect`/`TypeInsert` exports | Export both; downstream packages depend on them. |
| Enum values as Dutch display text | Machine codes as `value`, Dutch as `label` in the `Options` array. |
| `throw new Error(...)` in core | `throw handleError(err, "Exception for fnName", { context })` |
| Query scoped by farm id instead of `checkPermission` | Always `checkPermission` first, inside the transaction. |
| Schema edit with no generated migration | `pnpm db:generate` and commit the SQL. |
