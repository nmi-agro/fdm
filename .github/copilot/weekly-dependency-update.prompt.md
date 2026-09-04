# Weekly dependency update — Copilot agent brief

You are performing the **weekly automated dependency update** for the `fdm` monorepo (pnpm + Turborepo, packages: `fdm-core`, `fdm-data`, `fdm-calculator`, `fdm-agents`, `fdm-rvo`, `fdm-helpdesk`, `fdm-api`, `fdm-app`, `fdm-docs`, plus the root workspace).

Before making changes, read `.github/copilot-instructions.md` and the relevant skills under `.github/skills/` (`fdm-schema`, `fdm-app-conventions`, `fdm-api`) for conventions you must preserve while migrating code.

## 1. Inventory

- Run `pnpm outdated -r` (and check `pnpm-workspace.yaml`'s `catalog:` block) to get the full list of outdated dependencies across the root workspace and every package in scope.
- Classify each outdated dependency as **patch/minor** or **major** (semver).

## 2. Apply safe updates directly

- For all patch/minor bumps: update the version in `pnpm-workspace.yaml`'s `catalog` (for catalog-managed deps) or the package's own `package.json` (for deps not in the catalog), then run `pnpm install`.
- These should not require code changes beyond the version bump itself, but still run the validation in step 4 and revert/pin back any bump that breaks the build or tests instead of leaving the repo broken.

## 3. Handle major upgrades

Note on internet access: your environment's firewall only allows GitHub itself (so you can read a dependency's `CHANGELOG.md`, GitHub Releases, and tags on `github.com`/`raw.githubusercontent.com`) and package registries (e.g. `registry.npmjs.org`, for package metadata/README). Third-party blog or docs sites hosted on their own domain (not on `github.com`/`githubusercontent.com`) are **not** reachable by default and requests to them will be blocked.

Before assuming a migration guide is unreachable, look for it **inside the dependency's own GitHub repository** — many projects publish their release notes, blog posts, and migration guides as files committed to the repo itself (not just as an external site), for example: `CHANGELOG.md` at the repo root or in a specific package's folder in a monorepo, a `docs/` or `website/`/`website/blog/` directory (common for docs sites built from in-repo Markdown/MDX, e.g. Docusaurus-based sites like this one), `.changeset/` release summaries, or a `MIGRATION.md`/`UPGRADING.md` file. All of these are reachable via `raw.githubusercontent.com` and GitHub's code search/browsing even though the _rendered_ docs/blog site itself may not be. Only fall back to an external docs/blog URL once you've checked the repo doesn't contain the guide, and if that external URL is also blocked, note that in "Decisions Needed" rather than guessing at the breaking changes.

For each **major** version bump:

1. Read the dependency's changelog/release notes/migration guide for the versions between current and latest.
2. Identify breaking changes actually relevant to how `fdm` uses it — pay particular attention to: Drizzle ORM/drizzle-kit (schema and migration generation), better-auth (plugin/adapter APIs, used in `fdm-core/src/authentication.ts`), React Router v8 (loaders/actions/routing in `fdm-app`), Vitest/Tailwind/build tooling config, and any TypeScript major-version breaking changes.
3. If the migration is mechanical and safe (renamed APIs, config keys, codemods available, etc.), perform it directly in this PR: update code, config, and (if needed) generate/adjust Drizzle migrations following the schema-change workflow documented in the `fdm-schema` skill.
4. If the upgrade requires a decision only a maintainer can make — an ambiguous breaking change, a product/UX trade-off, a security posture change, or a migration too risky to automate safely — **do not apply that specific upgrade**. Leave it at its current version and record it in the "Decisions Needed" section of the PR body (see template below) with your reasoning and a recommendation.

## 4. Validate

Before finishing, for every package you touched:

- Respect build order: `fdm-data` → `fdm-core` → downstream packages.
- Run `pnpm build`, `pnpm check-types` (root and/or per-package, e.g. `fdm-app`'s `pnpm check-types` runs `react-router typegen && tsc`), and `pnpm lint`.
- Run the targeted test suite for each touched package, e.g. `pnpm turbo run test-coverage --filter=@nmi-agro/fdm-core`. A PostgreSQL/PostGIS instance is available (via the `copilot-setup-steps` service) for packages that need it (`fdm-core`, `fdm-calculator`, `fdm-rvo`, `fdm-helpdesk`); connection details are provided via `POSTGRES_HOST`/`POSTGRES_PORT`/`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` environment variables. If these are unset or the tests fail immediately with a missing-env-var error (see `fdm-core/src/global-setup.ts`), that's an environment configuration issue, not something caused by the dependency updates — state clearly in the PR's Validation section which suites you could not run and why (e.g. "fdm-core tests: skipped, POSTGRES_* environment variables not available in this session") rather than silently omitting them or reporting a vague "unable to test."
- Fix any regression your changes caused. If a specific bump cannot be made to pass validation within reasonable effort, revert just that bump and move it to "Decisions Needed" instead of leaving a broken build.

## 5. Changesets

Only add a changeset (`.changeset/*.md`, matching the existing format — see `.changeset/README.md` and existing files for style) for a package when you actually **applied a major version bump** to one of its dependencies. Do **not** add a changeset for packages that only received patch/minor dependency bumps — those are not user-facing changes worth a changelog entry.

For a package that did get a major dependency bump, default to a **`patch`** changeset for it, unless the dependency upgrade itself:

- introduces new features that are now available to consumers of the `fdm` package — in that case use **`minor`**, or
- introduces a breaking change in the `fdm` package's own public API/behavior as a result of the upgrade — in that case use **`major`**.

## 6. Pull request title and description

Title the pull request exactly: `Weekly dependency update — Week {{WEEK_NUMBER}}, {{WEEK_YEAR}}` (ISO week number and year). Do not leave (or revert to) a generic auto-generated title, and do not leave a `[WIP]`-prefixed title once your work is complete — the final title must be exactly the string above.

Open the PR as a **draft**, targeting the `development` branch. **As the very last action before finishing**, replace the entire PR description with the structure below — do not leave your own running session checklist/progress notes (e.g. a plain `- [x] did X` task list) as the final description; that's for your own tracking while working, not the deliverable. Summarize the checklist items into the sections below instead (omit "Decisions Needed" entirely if there are none):

```markdown
## Summary

- **Minor/patch updates**: bullet list of `package: current → new` (group by whether it's a root/catalog dependency or package-specific).
- **Major updates applied**: bullet list of `package: current → new`, each with a one-line note on what changed and what migration was performed.

## Decisions Needed

For each major upgrade that was intentionally _not_ applied:

### `<dependency>` `<current>` → `<latest>`

- **What's blocking**: short explanation of the breaking change and why it needs a maintainer decision.
- **Options considered**: 1-3 concrete options (e.g. "adopt new config format now", "stay pinned until X is addressed", "adopt with a follow-up migration PR").
- **Recommendation**: your suggested path forward.

## Suggestions & Opportunities

Bullet list of new features/APIs unlocked by this week's updates that could be worth adopting (e.g. new Drizzle features, React Router APIs, performance improvements), or follow-up cleanup/deprecation work suggested by the changelogs you read. Keep this grounded in what you actually saw in the changelogs — do not speculate.

## Validation

- [ ] `pnpm build`
- [ ] `pnpm check-types`
- [ ] `pnpm lint`
- [ ] Targeted tests for touched packages (list which ones you ran)
- [ ] Changesets added for packages with an applied major dependency bump
```

Add the `dependencies` label to the PR if you have permission to do so.

## Branch name

Create and switch to the branch `copilot/dependencies/{{BRANCH_DATE}}` (branched from `development`), commit your changes there, and open the pull request from it against `development`. Do not use any other branch name or default auto-generated name.
