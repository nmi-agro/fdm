---
title: Weekly Dependency Updates
sidebar_label: Weekly Dependency Updates
---

Every Friday at 09:00 (Europe/Amsterdam), a scheduled GitHub Actions workflow (`.github/workflows/weekly-dependency-update.yml`) starts a **GitHub Copilot coding agent** task that opens a single **draft pull request** titled `Weekly dependency update — Week {week}, {year}` (ISO week number/year) against `development` with that week's dependency updates for the whole monorepo (the root workspace, the pnpm `catalog` in `pnpm-workspace.yaml`, and every package: `fdm-core`, `fdm-data`, `fdm-calculator`, `fdm-agents`, `fdm-rvo`, `fdm-helpdesk`, `fdm-api`, `fdm-app` and `fdm-docs`). The workflow pre-creates a dated branch named `agent/dependencies/{yyyymmdd}` from `development` and passes it to the Agent Tasks API's `head_ref` parameter, so the agent commits there instead of a GitHub-auto-named branch (the API only supports pointing at an *existing* branch via `head_ref`, not naming a brand-new one). No AI model is pinned for the task — the Agent Tasks API only accepts a fixed, changing set of model values, so the workflow lets GitHub auto-select a suitable model to avoid the request failing outright if a pinned value becomes unsupported.

Unlike a plain Dependabot/Renovate bot, the agent doesn't just bump version numbers: for major version upgrades it reads the changelog, attempts the necessary code or schema migration itself, runs the build/lint/tests, and adds a changeset for any package it applied a major dependency bump to (defaulting to a `patch` bump, unless the upgrade introduces new features available to `fdm` consumers — `minor` — or a breaking change in `fdm`'s own API — `major`) — following the same conventions documented in this contributing guide and in `.github/skills/`. The brief it works from lives in `.github/copilot/weekly-dependency-update.prompt.md`.

## What to expect in the PR

The PR description always follows the same structure:

- **Summary** — minor/patch updates and major updates that were applied, each with a short note of what changed.
- **Decisions Needed** — only present when a major upgrade needed a maintainer decision the agent couldn't safely make on its own (an ambiguous breaking change, a product/UX trade-off, or a migration too risky to automate). Each entry lists what's blocking, the options considered, and a recommendation. **Review and resolve these before merging** — the affected dependency will still be at its current version.
- **Suggestions & Opportunities** — new features or APIs unlocked by the updates, or follow-up cleanup suggested by the changelogs, worth considering as separate future work.
- **Validation** — a checklist of what the agent built/linted/tested.

The PR is opened as a draft; treat it like any other contribution — review the diff, resolve any "Decisions Needed" items, and mark it ready for review once satisfied. Note that only packages with an applied major dependency bump get a changeset; patch/minor-only bumps intentionally don't produce changelog entries.

## Prerequisites (repository setup)

This automation requires three things to be configured once, outside of code:

1. **GitHub Copilot coding agent must be enabled** for this repository (repository Settings → Copilot).
2. A **`COPILOT_AGENT_PAT`** repository or organization secret: a fine-grained personal access token (or GitHub App user-to-server token) belonging to a Copilot-licensed account, with read/write access to `contents`, `issues`, `pull requests`, `actions` and **`Agent tasks`** (the permission the Agent Tasks API itself requires to start a task), and read access to `metadata`. This is required because the [Copilot agent tasks API](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-via-the-api) only accepts user-to-server tokens — the workflow's default `GITHUB_TOKEN` cannot be used to start a Copilot agent task.
3. **Repository "Agents" variables** for the Postgres/PostGIS connection, so the agent's live session can actually run the `fdm-core`, `fdm-calculator`, `fdm-rvo` and `fdm-helpdesk` test suites (see [Configure secrets and variables for Copilot cloud agent](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/configure-secrets-and-variables)). Under repository Settings → Secrets and variables → **Agents** → Variables, add:

   | Name | Value |
   | --- | --- |
   | `POSTGRES_HOST` | `localhost` |
   | `POSTGRES_PORT` | `5432` |
   | `POSTGRES_USER` | `postgres` |
   | `POSTGRES_PASSWORD` | `postgres` |
   | `POSTGRES_DB` | `postgres` |

   These must match the values used by the Postgres service in `.github/workflows/copilot-setup-steps.yml`. This step is easy to miss: the `copilot-setup-steps.yml` job's own Postgres service *does* persist into the agent's live session (`services` is one of the customizable job settings), but environment variables set via a job- or step-level `env:` in that file do **not** — only Agents secrets/variables (or the Postgres service's own container `env:`) reach the live session. Without this, `fdm-core/src/global-setup.ts` throws immediately (it requires all five variables), and the agent will report it "wasn't able to test fdm-core" even though `copilot-setup-steps.yml` itself passes.

If any of these prerequisites is missing, the workflow (for #1/#2) or the agent's own test run (for #3) fails with a clear-enough error, but #3 in particular fails silently from the workflow's point of view — the task still starts and can still open a PR, it just can't run the DB-dependent test suites.

### Troubleshooting a `403 Forbidden` when starting the task

If the "Start Copilot coding agent task" step fails with `gh: forbidden (HTTP 403)` even though the earlier "Verify Copilot coding agent is available" step passed, the most common causes are:

- The `COPILOT_AGENT_PAT` fine-grained token is missing the **`Agent tasks: Read and write`** permission specifically — this is a distinct permission category from Contents/Issues/Pull requests/Actions/Metadata and is easy to miss when creating the token, since checking Copilot availability (via GraphQL) doesn't require it but starting a task does.
- The token's account doesn't have a **Copilot Business or Copilot Enterprise** subscription — this endpoint explicitly requires one of those plans (Pro/Pro+ is not sufficient).
- If the organization enforces **SAML SSO**, the token hasn't been authorized for the organization yet (GitHub Settings → Developer settings → the token → "Configure SSO").
- The token's repository access doesn't include `nmi-agro/fdm`.

### Troubleshooting "wasn't able to test fdm-core" (or `-calculator`/`-rvo`/`-helpdesk`) in the PR

If the agent reports it couldn't run one of these test suites, it almost always means the **Agents variables** from prerequisite #3 above aren't configured yet (or don't match `copilot-setup-steps.yml`'s Postgres service values) — `fdm-core/src/global-setup.ts` throws immediately if `POSTGRES_HOST`/`POSTGRES_PORT`/`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` aren't set, so the test run never even starts. This isn't a bug in the dependency update itself; add the Agents variables and re-run.

## Firewall / internet access for the agent

The Copilot cloud agent runs behind a built-in firewall. By default it can reach GitHub itself (`github.com`/`raw.githubusercontent.com`) and common package registries (npm, PyPI, etc.) for package metadata, but it **cannot** reach arbitrary third-party docs or blog sites hosted on their own domain — those requests are blocked and flagged on the PR.

This is rarely a real limitation in practice: most projects publish their release notes, blog posts, and migration guides as files committed inside their own GitHub repo (a root or per-package `CHANGELOG.md`, a `docs/`/`website/blog/` directory the public docs site is built from, `.changeset/` summaries, or a `MIGRATION.md`/`UPGRADING.md`), all of which are reachable the same way this very docs site's content is. The agent is instructed to look there first, and only treat a guide as unreachable if it genuinely only exists on an external domain that isn't on GitHub.

If a major dependency you rely on only publishes its migration guide on such an external domain, you can add that domain to the Copilot coding agent's custom allowlist under repository Settings → Copilot → Coding agent → firewall, so the agent can read it directly on future runs.

