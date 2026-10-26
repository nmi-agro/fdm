# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Farm Data Model (FDM): ESM-only pnpm + Turborepo monorepo (Node `>=24`, pnpm enforced). Public open-source repo; PRs target `development`. Shared rules for all agents live in `AGENTS.md` (imported below); the essentials are repeated here.

@AGENTS.md

## Commands

Run from the repo root unless noted.

```bash
pnpm build                  # turbo build, topological order
pnpm check-types            # tsc per package (fdm-app: react-router typegen + tsc)
pnpm lint && pnpm format    # oxlint (type-aware) + oxfmt; lint:fix to autofix
pnpm check-schema           # enforces DB column prefix naming
pnpm build-docs             # typedoc + Docusaurus; verifies TSDoc (not covered by lint)
pnpm test                   # all packages, with coverage
pnpm changeset              # add a changeset for the PR

pnpm turbo run test-coverage --filter=@nmi-agro/fdm-core          # one package
cd fdm-core && pnpm exec dotenvx run -- vitest run src/farm.test.ts -t "test name"   # one test
cd fdm-app && pnpm dev      # runs db:migrate, then react-router dev
```

- fdm-core, fdm-calculator, fdm-helpdesk tests need a local PostgreSQL + PostGIS configured via `.env` (`POSTGRES_HOST/PORT/DB/USER/PASSWORD`, see `fdm-core/.env.example`) and run through `dotenvx run --`. Don't assume Docker. fdm-api, fdm-agents, fdm-rvo, fdm-data call `vitest run` directly.
- Tests use `isolate: false` (shared state between test files in a worker); use unique IDs and clean up.

## Architecture

Packages (workspace deps use `workspace:*`):

- **fdm-data**: static catalogues/reference data (no DB). Base of the dependency graph.
- **fdm-core**: Drizzle ORM schema + domain functions on PostgreSQL/PostGIS (`src/<domain>.ts` with colocated `.test.ts` and `.types.d.ts`). Four DB schemas: `fdm`, `fdm-authn` (better-auth), `fdm-authz`, `fdm-calculator`. Migrations in `src/db/migrations` (generate with `pnpm db:generate`; run via `migrate.ts`).
- **fdm-calculator**: nutrient balances, norms, advice, mineralization, BCS/BLN3; reads data through fdm-core and caches results in the `fdm-calculator` schema.
- **fdm-rvo**: RVO (Dutch government) field import/compare via `@nmi-agro/rvo-connector`.
- **fdm-agents**: LangChain/LangGraph agents (e.g. `gerrit`, `ticket-triage`) with tools over fdm-core/calculator.
- **fdm-helpdesk**: ticket storage (own Drizzle schema).
- **fdm-api**: Hono + `@hono/zod-openapi` REST API (routes in `src/routes`, one file per resource), Scalar docs.
- **fdm-app**: React Router v8 framework-mode web app, file-based routes (`flatRoutes()`, e.g. `farm.$b_id_farm.$calendar.*`), Tailwind/shadcn. Server-only logic lives in `app/lib/*.server.ts`; `fdm.server.tsx` creates the shared fdm instance.
- **fdm-docs**: Docusaurus site; TypeDoc API reference is generated from library TSDoc.

Design model: the **Asset–Action** model. Store entities (farms, fields, cultivations, soil samples) and events (sowing, fertilizing, sampling) as discrete records, not pre-aggregated metrics. Load the skills in `.claude/skills/` (`fdm-schema`, `fdm-app-conventions`, `fdm-api`) and the `impeccable` plugin skill for detailed rules before touching those areas.

## Gotchas and conventions

- **Cross-package imports resolve to built `dist`.** After editing a library package's `src`, run `pnpm build` before typechecking or running downstream packages (fdm-app, fdm-api, ...).
- DB column prefixes, not camelCase: `b_` (farms, fields, cultivations), `p_` (fertilizer products), `a_` (soil analyses), `m_` (measures).
- fdm-core function shape: `fn(fdm, principal_id, ...)`. Mutations run in `fdm.transaction(...)`, IDs from `createId()`, access via `checkPermission`/`grantRole` in `src/authorization.ts`, errors wrapped with `handleError(err, message, context)`.
- fdm-app: don't use `react-router-dom`; respect `.server.ts`/`.client.ts` boundaries. UI is Dutch only (keep copy i18n-ready).
- Update TSDoc/docs in the same PR; write comments for external readers (no ticket numbers or internal URLs).
- Revising a PR: edit the existing `.changeset/*.md` rather than adding a duplicate.
- Never commit real farm/field coordinates, identifiers, personal data or internal log payloads; use synthetic fixtures.
