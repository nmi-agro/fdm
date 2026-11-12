# AGENTS.md — Agent Instructions for `nmi-agro/fdm`

Farm Data Model (FDM) is an ESM-only pnpm + Turborepo monorepo (Node `>=24`, `pnpm@12.8.1` enforced). It is a public open-source repository; PRs target `development`, except `release/*` and `hotfix/*` branches, which target `main` (see [Branches, PRs and issues](#5-branches-prs-and-issues)).

## 0. Working agreements

- **This codebase is yours.** You'll keep building on it, so leave it better than you found it: fix duplicate code and nearby bugs when they are small and inside the task's scope. Anything larger goes in your final reply as a suggestion instead of widening the change. Prefer the simplest change that solves the problem; don't add backward compatibility, abstraction layers or raw SQL that nobody asked for.
- **The code wins over stale instructions.** When this file or a skill conflicts with the code, follow the code's conventions and name each mismatch in your final reply, so a maintainer can decide which side to fix. The landmines below and the enforced checks (`pnpm check-schema`, lint, hooks, deny rules) always apply.
- **Keep the instructions current.** The agent instructions (`AGENTS.md`, `CLAUDE.md`, `.claude/skills/`, `.claude/commands/`) are part of the code. When your change alters a package, command, path, convention or workflow they describe, update that text in the same PR. When you find a mismatch, or the user corrects the same thing twice, propose the fix to the instructions in your final reply. Put it in the right place: `AGENTS.md` for rules every agent needs, a skill for domain detail, and `CLAUDE.md` only for what is specific to Claude Code. Keep entries short, and remove rules that no longer hold instead of adding exceptions.
- **Prove it is done.** Run the checks in [Definition of done](#4-definition-of-done) that apply to your change and show their output. If a check could not run (for example, no database), say so and why.

## 1. Landmines (confidently wrong assumptions)

- **Cross-package imports use built `dist`**: Editing a library package `src` requires running `pnpm build` before downstream packages (like `fdm-app`) or typechecks reflect the changes.
- **PostgreSQL / PostGIS environment**: The fdm-core, fdm-calculator and fdm-helpdesk tests need a local PostgreSQL with PostGIS, configured via `.env` (`POSTGRES_HOST/PORT/DB/USER/PASSWORD`, see `fdm-core/.env.example`) and run through `dotenvx run --`. Do not assume Docker.
- **Public open-source repository**: Never commit real farm/field coordinates, identifiers, personal data, or internal error/log payloads. Use synthetic fixtures. The one exception: the manual's demo farm may use public BRP parcel outlines from PDOK (open data, with a source note); everything else about that farm stays synthetic.
- **No internal sources in public text**: Don't name internal systems, lab software or spreadsheets in code comments, TSDoc, docs, changesets or PR descriptions. Describe the formula and its parameters only.
- **React Router v8 framework mode in `fdm-app`**: Do not use `react-router-dom`. Use `loaderData` in `useMatches`/`MetaArgs`. Respect `.server.ts` vs `.client.ts` module boundaries.
- **Production runs in Europe/Amsterdam.** Review findings that assume a UTC host (for example around `getFullYear()` on a local-midnight year start) don't apply; don't "fix" local-time date handling unless asked.

## 2. Packages

Workspace dependencies use `workspace:*`.

| Package          | What it is                                                                                                                                                                                                                                                                               | Tests need a DB?                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `fdm-data`       | Static catalogues and reference data. Base of the dependency graph.                                                                                                                                                                                                                      | no                                                                                                                                         |
| `fdm-core`       | Drizzle ORM schema and domain functions on PostgreSQL/PostGIS (`src/<domain>.ts` with colocated `.test.ts` and `.types.d.ts`). PG schemas `fdm`, `fdm-authn` (better-auth), `fdm-authz`, `fdm-calculator`. Migrations in `src/db/migrations` (`pnpm db:generate`, run via `migrate.ts`). | yes                                                                                                                                        |
| `fdm-calculator` | Nutrient balances, norms, advice, mineralization, BCS/BLN3. Reads through fdm-core and caches results in the `fdm-calculator` schema.                                                                                                                                                    | yes                                                                                                                                        |
| `fdm-helpdesk`   | Ticket storage with its own Drizzle schema (`fdm-helpdesk`).                                                                                                                                                                                                                             | yes                                                                                                                                        |
| `fdm-rvo`        | RVO (Dutch government) field import/compare via `@nmi-agro/rvo-connector`.                                                                                                                                                                                                               | no (mocks fdm-core)                                                                                                                        |
| `fdm-agents`     | LangChain/LangGraph agents (e.g. `gerrit`, `ticket-triage`) with tools over fdm-core/calculator.                                                                                                                                                                                         | no                                                                                                                                         |
| `fdm-storage`    | File storage interface with a Google Cloud Storage implementation and upload validation.                                                                                                                                                                                                 | no                                                                                                                                         |
| `fdm-reports`    | Reports such as the yearly bemestingsplan PDF; uses fdm-storage.                                                                                                                                                                                                                         | no                                                                                                                                         |
| `fdm-api`        | Hono + `@hono/zod-openapi` REST API (routes in `src/routes`), Scalar docs.                                                                                                                                                                                                               | no                                                                                                                                         |
| `fdm-app`        | React Router v8 framework-mode web app, file-based routes (`flatRoutes()`, e.g. `farm.$b_id_farm.$calendar.*`), Tailwind/shadcn. Server-only logic in `app/lib/*.server.ts`; `fdm.server.tsx` creates the shared fdm instance.                                                           | unit: no; integration: `fdm-app/.env.test` (separate test DB, create it per `fdm-app/README.md`); e2e: `.env.e2e`, a build and an empty DB |
| `fdm-docs`       | Docusaurus site; the TypeDoc API reference is generated from library TSDoc.                                                                                                                                                                                                              | –                                                                                                                                          |

Test isolation: `fdm-core` and the fdm-app integration project run with `isolate: false` (shared state between test files in a worker), so use unique IDs and clean up.

## 3. Undiscoverable intent & policy

- **Asset–Action model**: Record entities (assets: farms, fields, cultivations, soil samples) and events (actions: sowing, fertilizing, sampling) as discrete records rather than pre-aggregated metrics.
- **Domain column prefixes** in the `fdm` PG schema, not camelCase: `b_` (farms, fields, cultivations), `p_` (fertilizer products), `a_` (soil analyses), `m_` (measures), `l_` (livestock), `f_` (feed). Enforced by `pnpm check-schema`; details and exceptions in the `fdm-schema` skill. Generated schemas (`fdm-authn`) are exempt.
- **`fdm-core` function conventions**:
  - Signature: `fn(fdm: FdmType, principal_id: string, ...)`.
  - Mutations run inside `fdm.transaction(...)`, generate IDs via `createId()`, and enforce access via `src/authorization.ts` (`checkPermission`, `grantRole`).
  - Errors: wrap exceptions with `handleError(err, message, context)`, which returns a `BaseError`.
- **Feature logic in its own package**: put a new feature area in its own workspace package (like `fdm-rvo` or `fdm-reports`), not in `fdm-core`; only touch `fdm-core` for small, unavoidable changes.
- **`fdm-app` UI**: Dutch-only user interface (keep copy i18n-ready).
- **User manual stays in step with the app**: The public manual lives in `fdm-app/app/content/manual` (Markdown, one file per chapter). A PR that changes a user-visible label, flow or page also updates the chapter whose `routes`/`watch` globs list the changed files, in the same PR. **Bold** text in the manual must be an existing UI label: `pnpm --filter @nmi-agro/fdm-app test:unit` fails otherwise. CI also warns when a PR changes a described route without its chapter. Link screens to the manual with `handle.help` (see the `fdm-app-conventions` skill), never with a hard-coded `/manual/...` URL.
- **Documentation, TypeDoc & comments**: TypeDoc generates the public API reference in `fdm-docs` from TSDoc in library packages. Write comments and docstrings for external readers (no internal ticket numbers, internal URLs, or meetings). Update docs and docstrings in the same PR as code changes. TSDoc is not covered by `pnpm lint`; verify with `pnpm build-docs`.
- **Language**: GitHub issues, PR descriptions, changesets, commits and code comments are in English, also when the conversation is in Dutch. Dutch UI labels may be quoted.

## 4. Definition of done

Run what applies to your change, from the repository root unless noted, and show the result:

```bash
pnpm build                                     # after changing a library package's src
pnpm check-types                               # all packages (fdm-app: react-router typegen + tsc)
pnpm lint                                      # oxlint, type-aware (lint:fix to autofix)
pnpm exec oxfmt <changed files>                # format only what you changed
pnpm turbo run test-coverage --filter=@nmi-agro/fdm-core  # tests of one package
cd fdm-core && pnpm exec dotenvx run -- vitest run src/farm.test.ts -t "test name"  # one test
pnpm check-schema                              # after a schema change
pnpm --filter @nmi-agro/fdm-app test:unit      # fdm-app unit tests incl. manual labels (no DB)
pnpm --filter @nmi-agro/fdm-app test:integration  # fdm-app loader/action tests (.env.test)
pnpm build-docs                                # after TSDoc or fdm-docs changes
```

- `pnpm test` runs every package with coverage, but for fdm-app only the unit project.
- UI changes in `fdm-app`: a design review with the `impeccable` skill (critique, then adapt, then polish).
- Agent instructions: if the change affects anything `AGENTS.md`, `CLAUDE.md`, a skill or a command describes, that text is updated in the same PR (bump the skill's `version` when its guidance changes materially).
- Add a changeset (`pnpm changeset`): one `.changeset/*.md` per affected package, each with text that fits that package's changelog. When revising a PR, edit the existing changesets in place instead of adding new ones.

## 5. Branches, PRs and issues

- Branching follows `development` → `release/*` → `main` (see `fdm-docs/docs/contributing/03-releasing-fdm.md`):
  - **Feature and fix branches** are named after the issue (`fdm-NNN`), branch from `development` and target `development`.
  - **`release/*` branches** (e.g. `release/YYYY-MM`) branch from `development` for release chores and are merged into `main`; versioning runs manually from the Actions tab on that branch.
  - **`hotfix/*` branches** (`hotfix/fdm-NNN`) branch from `main` for urgent production fixes and target `main`.
  - After a release or hotfix lands on `main`, `main` is merged back into `development`.
  - Never push directly to `development` or `main`.
- Keep a PR under about 100 changed files, because larger PRs can't be reviewed automatically. Estimate the size while planning; if it is larger, propose a stack of at most 5 PRs with branch names before writing code.
- Draft issues, PR descriptions and other notes in the gitignored `.drafts/` folder, never in a tracked location (see the `fdm-issue-workflow` skill).

## 6. Working in this checkout

- Edit files with your editor tools, not with Python, `sed -i` or heredoc rewrite scripts. Those scripts change line endings and break on quoting.
- Format only the files you changed (`pnpm exec oxfmt <files>`). A repository-wide `pnpm format` touches files outside your change.
- To work on another branch of a PR stack while the main checkout is in use, use a git worktree. Checking out a lower branch removes files that a running `pnpm dev` watches and crashes it.
- If `git status` suddenly shows many deleted (` D`) files, for example after a GUI merge with autostash, stop and tell the user. Recover with `git restore -- <package>` per package and repair `node_modules` with `pnpm install --frozen-lockfile --force`; don't pop the whole stash.

## 7. Deep domain skills (`.claude/skills/`)

For in-depth domain rules, load the dedicated skill:

- **`fdm-schema`**: Asset–Action rules, table/column naming, migration workflow, anti-patterns.
- **`fdm-app-conventions`**: UI loaders/actions, server/client boundaries, Zustand stores, error boundaries, fdm-app UI rules.
- **`fdm-user-guide-sync`**: Bring the user guide (`fdm-app/app/content/manual`) in line with code changes; also used by the weekly sync routine.
- **`fdm-api`**: Hono + `@hono/zod-openapi` endpoints, injectable services, RFC 9457 errors.
- **`fdm-issue-workflow`**: Draft a GitHub issue, start work on an `FDM-NNN` issue, plan the branch and PR size.
- **`impeccable`** (Claude Code plugin, installed separately): Frontend UX, design tokens, responsive layouts, accessibility.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
