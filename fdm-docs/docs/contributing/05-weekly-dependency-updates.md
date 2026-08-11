---
title: Weekly Dependency Updates
sidebar_label: Weekly Dependency Updates
---

Every Friday at 09:00 (Europe/Amsterdam), a scheduled GitHub Actions workflow (`.github/workflows/weekly-dependency-update.yml`) starts a **GitHub Copilot coding agent** task (pinned to the `gemini-3.6-flash` model, to keep the cost of this weekly automation predictable) that opens a single **draft pull request** against `development` with that week's dependency updates for the whole monorepo (the root workspace, the pnpm `catalog` in `pnpm-workspace.yaml`, and every package: `fdm-core`, `fdm-data`, `fdm-calculator`, `fdm-agents`, `fdm-rvo`, `fdm-helpdesk`, `fdm-api`, `fdm-app` and `fdm-docs`). The agent works on a dated branch named `agent/dependencies/{yyyymmdd}`.

Unlike a plain Dependabot/Renovate bot, the agent doesn't just bump version numbers: for major version upgrades it reads the changelog, attempts the necessary code or schema migration itself, runs the build/lint/tests, and adds a changeset for any package it applied a major dependency bump to (defaulting to a `patch` bump, unless the upgrade introduces new features available to `fdm` consumers — `minor` — or a breaking change in `fdm`'s own API — `major`) — following the same conventions documented in this contributing guide and in `.github/skills/`. The brief it works from lives in `.github/copilot/weekly-dependency-update.prompt.md`.

## What to expect in the PR

The PR description always follows the same structure:

- **Summary** — minor/patch updates and major updates that were applied, each with a short note of what changed.
- **Decisions Needed** — only present when a major upgrade needed a maintainer decision the agent couldn't safely make on its own (an ambiguous breaking change, a product/UX trade-off, or a migration too risky to automate). Each entry lists what's blocking, the options considered, and a recommendation. **Review and resolve these before merging** — the affected dependency will still be at its current version.
- **Suggestions & Opportunities** — new features or APIs unlocked by the updates, or follow-up cleanup suggested by the changelogs, worth considering as separate future work.
- **Validation** — a checklist of what the agent built/linted/tested.

The PR is opened as a draft; treat it like any other contribution — review the diff, resolve any "Decisions Needed" items, and mark it ready for review once satisfied. Note that only packages with an applied major dependency bump get a changeset; patch/minor-only bumps intentionally don't produce changelog entries.

## Prerequisites (repository setup)

This automation requires two things to be configured once, outside of code:

1. **GitHub Copilot coding agent must be enabled** for this repository (repository Settings → Copilot).
2. A **`COPILOT_AGENT_PAT`** repository or organization secret: a fine-grained personal access token (or GitHub App user-to-server token) belonging to a Copilot-licensed account, with read/write access to `contents`, `issues`, `pull requests` and `actions`, and read access to `metadata`. This is required because the [Copilot agent tasks API](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-via-the-api) only accepts user-to-server tokens — the workflow's default `GITHUB_TOKEN` cannot be used to start a Copilot agent task.

If either prerequisite is missing, the workflow fails fast with a clear error message instead of silently doing nothing.

## Firewall / internet access for the agent

The Copilot cloud agent runs behind a built-in firewall. By default it can reach GitHub itself (`github.com`/`raw.githubusercontent.com`) and common package registries (npm, PyPI, etc.) for package metadata, but it **cannot** reach arbitrary third-party docs or blog sites hosted on their own domain — those requests are blocked and flagged on the PR.

This is rarely a real limitation in practice: most projects publish their release notes, blog posts, and migration guides as files committed inside their own GitHub repo (a root or per-package `CHANGELOG.md`, a `docs/`/`website/blog/` directory the public docs site is built from, `.changeset/` summaries, or a `MIGRATION.md`/`UPGRADING.md`), all of which are reachable the same way this very docs site's content is. The agent is instructed to look there first, and only treat a guide as unreachable if it genuinely only exists on an external domain that isn't on GitHub.

If a major dependency you rely on only publishes its migration guide on such an external domain, you can add that domain to the Copilot coding agent's custom allowlist under repository Settings → Copilot → Coding agent → firewall, so the agent can read it directly on future runs.

