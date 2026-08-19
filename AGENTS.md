# AGENTS.md / Copilot Instructions for `nmi-agro/fdm`

Farm Data Model (FDM) is an ESM-only pnpm + Turborepo monorepo (Node `>=24`, `pnpm@11.17.0` enforced).

## 1. Landmines (confidently wrong assumptions)

- **Cross-package imports use built `dist`**: Editing a library package `src` requires running `pnpm build` (or `pnpm turbo build`) before downstream packages (like `fdm-app`) or typechecks reflect the changes.
- **PostgreSQL / PostGIS environment**: Tests require a local running PostgreSQL with PostGIS (`POSTGRES_HOST/PORT/DB/USER/PASSWORD`). Do NOT assume Docker. Schemas used: `fdm`, `fdm-authn`, `fdm-authz`, `fdm-calculator`.
- **Public open-source repository**: Never commit real farm/field coordinates, identifiers, personal data, or internal error/log payloads. Use synthetic fixtures only.
- **React Router v8 framework mode in `fdm-app`**: Do not use `react-router-dom`. Use `loaderData` in `useMatches`/`MetaArgs`. Respect `.server.ts` vs `.client.ts` module boundaries.
- **Changesets**: Monorepo uses Changesets targeting the `development` branch. When revising a PR, update the existing `.changeset/*.md` in place rather than creating duplicate changelog entries.

## 2. Undiscoverable Intent & Policy

- **Asset–Action Model**: Record entities (assets: farms, fields, cultivations, soil samples) and events (actions: sowing, fertilizing, sampling) discretely rather than storing pre-aggregated metrics.
- **Domain column prefixes**: Database column naming uses domain prefixes, NOT camelCase: `b_` (farms, fields, cultivations), `p_` (fertilizer products), `a_` (soil analyses), `m_` (measures). Enforced by `pnpm check-schema`.
- **`fdm-core` function conventions**:
  - Signature: `fn(fdm: FdmType, principal_id: string, ...)`
  - Mutations must run inside `fdm.transaction(...)`, generate IDs via `createId()`, and enforce access via `src/authorization.ts` (`checkPermission`, `grantRole`).
  - Errors: Wrap exceptions with `handleError(err, message, context)` returning `BaseError`.
- **`fdm-app` UI**: Dutch-only user interface (keep copy i18n-ready).
- **Documentation, TypeDoc & Comments**: TypeDoc generates the public API reference in `fdm-docs` from TSDoc/JSDoc in library packages. Write comments and docstrings for external readers (no internal ticket numbers, internal URLs, or meetings). Update docs and docstrings in the same PR as code changes. Excluded from `pnpm lint`; verify with `pnpm build-docs`.

## 3. Discovery Shortcuts (bespoke commands)

```bash
# Build & Lint
pnpm build                                     # Turbo build in topological order
pnpm build-docs                                # Build public Docusaurus docs site
pnpm check-types                               # Typecheck packages (in fdm-app: typegen + tsc)
pnpm lint && pnpm format                       # Oxlint + oxfmt
pnpm check-schema                              # Check schema naming conventions

# Testing
pnpm test                                      # All tests with coverage (turbo)
pnpm turbo run test-coverage --filter=@nmi-agro/fdm-core  # Single package tests
cd fdm-core && pnpm exec dotenvx run -- vitest run src/farm.test.ts -t "test name"  # Single test case

# Releases
pnpm changeset                                 # Generate changeset for PR (target: development)
```

## 4. Deep Domain Skills (`.github/skills/`)

For in-depth domain rules, load the dedicated skill:

- **`fdm-schema`**: Asset–Action rules, table/column naming, migration workflow, anti-patterns.
- **`fdm-app-conventions`**: UI loaders/actions, server/client boundaries, Zustand stores, error boundaries.
- **`fdm-api`**: Hono + `@hono/zod-openapi` endpoints, injectable services, RFC 9457 errors.
- **`impeccable`**: Frontend UX, design tokens, responsive layouts, accessibility.
