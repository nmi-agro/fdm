# Copilot instructions for `nmi-agro/fdm`

FDM (Farm Data Model) is a pnpm + Turborepo monorepo of TypeScript packages for standardizing, storing, and analyzing farm data. Node `>=24`, `pnpm@11.7.0` (enforced via `only-allow pnpm`), ESM-only (`"type": "module"`).

## Packages and how they depend on each other

- **`fdm-core`** – The foundation: Drizzle ORM schema + all CRUD functions against a PostgreSQL (PostGIS) database. Everything else builds on it.
- **`fdm-data`** – Standardized catalogues (fertilizers, cultivations) consumed by `fdm-core`.
- **`fdm-calculator`** – Agronomic engine (nutrient doses, nitrogen/organic matter balance). Some advices require the external `nmi-api` (NMI API key).
- **`fdm-agents`** – Agentic-AI decision support (LLM + calculator), e.g. "Gerrit" the fertilizer planner.
- **`fdm-rvo`** – Dutch RVO integration.
- **`fdm-helpdesk`** – Standalone helpdesk back-end with its own schema; can share a database with `fdm-core` but does not depend on it.
- **`fdm-api`** – REST API layer.
- **`fdm-app`** – React Router v8 (framework mode) reference app; the only end-user UI. Consumes the other packages.
- **`fdm-docs`** – Docusaurus documentation site (excluded from lint).

Cross-package imports use the built `dist` of each package (e.g. `fdm-app` imports `@nmi-agro/fdm-agents`). After editing a library's `src`, rebuild it (`pnpm build` in that package, or `pnpm turbo build`) or downstream packages won't see the change. Workspace deps use `workspace:*`/`workspace:^`.

## Architecture: the Asset–Action model

The schema separates **Assets** (entities: farms, fields, cultivations, fertilizers, soil samples) from **Actions** (events on them: sowing, fertilizing, harvesting, sampling). Rather than storing pre-aggregated metrics, record the asset + the discrete action (type, amount, date) and aggregate later. Read `fdm-docs/docs/getting-started/02-the-asset-action-model.md` and `fdm-docs/docs/core-concepts/` before changing schema or core logic.

The database uses four PostgreSQL schemas (see `fdm-core/src/db/`): `fdm` (core data), `fdm-authn` (better-auth), `fdm-authz` (roles/permissions + audit), and `fdm-calculator` (cached results). `fdm-app` runs migrations on startup via `app/lib/fdm-migrate.server.js`.

## Key conventions

- **Column naming uses domain prefixes, not camelCase**: `b_` for farm/field assets (`b_id_farm`, `b_id`, `b_lu` cultivation, `b_lu_catalogue`), `p_` for fertilizer products (`p_id`, `p_id_catalogue`, `p_app_id`), `a_` for soil analysis parameters, and `m_` for measures. Preserve these prefixes; they map directly to the documented schema.
- **`fdm-core` function signature pattern**: public functions take the FDM instance and the acting principal first: `fn(fdm: FdmType, principal_id: string, ...)`. Mutations run inside `fdm.transaction(...)`, generate IDs with `createId()` (`src/id.ts`), and enforce access via the authorization helpers (`grantRole`, `checkPermission`, …) in `src/authorization.ts`.
- **Authentication & authorization live in `fdm-core`**. Authentication uses **better-auth** (`src/authentication.ts`, `createFdmAuth`) with the drizzle adapter and plugins for organizations, username, magic link, generic OAuth, and API keys; tables live in the `fdm-authn` schema. Authorization is a custom role/permission system in `src/authorization.ts` (`fdm-authz` schema): resources (`farm`, `field`, `cultivation`, `soil_analysis`, …), roles (`owner`, `advisor`, `researcher`), and actions (`read`, `write`, `list`, `share`). Core mutations enforce access via its helpers (`grantRole`, `checkPermission`, `getRolesOfPrincipalForResource`, …) and write audit entries; pass and check the acting `principal_id` rather than rolling your own checks.
- **Error handling**: wrap thrown errors with `handleError(err, message, context)` which returns a `BaseError` (`fdm-core/src/error.ts`). Do not throw raw values.
- **File layout in `fdm-core/src`**: each domain has `<name>.ts`, `<name>.test.ts`, and `<name>.types.d.ts` colocated.
- **`fdm-app` routing**: flat file-based routes via `@react-router/fs-routes` (`app/routes.ts` → `app/routes/`). Server-only code lives in `*.server.ts`, client-only in `*.client.ts`. State uses Zustand stores in `app/store/`.
- This repo is on **React Router v8** (`react-router`, no `react-router-dom`); use `loaderData` in `useMatches`/`MetaArgs`.

## Commands (run from repo root unless noted)

- Install: `pnpm install`
- Build everything: `pnpm build` (turbo) — respects build order.
- Lint / format (oxlint + oxfmt, configured at root): `pnpm lint`, `pnpm lint:fix`, `pnpm format`.
- Type-check: `pnpm check-types` in `fdm-core`, `fdm-rvo`, etc.; in `fdm-app` use `pnpm check-types` (runs `react-router typegen && tsc`).
- Test (all): `pnpm test` (turbo `test-coverage`). Tests use Vitest and require a running PostgreSQL (PostGIS) — set `POSTGRES_HOST/PORT/DB/USER/PASSWORD`. `docker compose up -d` provides the database locally.
- Test one package: `pnpm turbo run test-coverage --filter=@nmi-agro/fdm-core`.
- Test one file/case in a package: `cd fdm-core` then `pnpm exec dotenvx run -- vitest run src/farm.test.ts` (add `-t "name"` for a single case). Tests load env via `dotenvx`.
- Run the app: `docker compose up -d` then `pnpm --filter fdm-app dev` (http://localhost:5173). Copy `fdm-app/.env.example` to `fdm-app/.env` first.

## Releases / changesets

Versioning is via Changesets on a `development` → `release/*` → `main` flow. Any PR that should bump a published package must include a changeset: run `pnpm changeset`, pick packages + bump type, and commit the generated `.changeset/*.md`. PRs target the `development` branch. Full process: `fdm-docs/docs/contributing/03-releasing-fdm.md`.

## Design context (fdm-app)

`fdm-app` is a **product**-register surface (design serves the task); its public sign-in/privacy/about pages double as marketing. Strategic context lives in `fdm-app/PRODUCT.md` and the visual system in `fdm-app/DESIGN.md` (when present) — read them before non-trivial UI work. Core design principles: raw data in / connected insight out (never ask users for derived values); lower the data-entry barrier relentlessly; make insight discoverable; earn trust through substance (transparent, auditable numbers); work on laptops/desktops while never breaking on 14-inch laptops, with graceful mobile degradation. Target WCAG AA; UI is Dutch-only today (keep copy i18n-ready). UI stack: React Router v8, Tailwind v4, shadcn/ui (new-york, slate base, CSS variables), radix-ui, next-themes (light/dark), Inter, lucide-react, recharts, maplibre-gl.
