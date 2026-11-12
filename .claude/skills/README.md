# Project skills

This directory holds the project-level skills that Claude Code discovers automatically when working in this repository; other agents reach them through the list in `AGENTS.md`. A skill encodes durable, repository-specific knowledge so that every agent applies the same conventions instead of re-deriving them from the source each session.

## The `fdm-*` skill family

FDM knowledge is split into narrowly-scoped skills, each owning exactly one domain. Narrow scope is deliberate: it keeps every `SKILL.md` short enough to actually be read, and it makes ownership of a convention unambiguous.

| Skill | Owns | Status |
|---|---|---|
| `fdm-schema` | Database schema and data model: the Asset–Action model, column/table naming, schema-change workflow, schema-level authorization, schema anti-patterns | available |
| `fdm-api` | The REST layer in `fdm-api`: Hono + zod-openapi route definitions, the injectable services pattern, RFC 9457 problem details, pagination, API-key auth, API tests | available |
| `fdm-app-conventions` | `fdm-app` mechanics: React Router v8 framework mode, flat file routing, loaders and actions, the `.server.ts`/`.client.ts` boundary, error helpers, Zustand stores, component placement, and the app-wide UI consistency rules | available |
| `fdm-user-guide-sync` | Keeping the fdm-app user guide (`/manual`) in step with code changes: affected chapters from the drift script, label updates, the weekly sync routine, preparing the background-page review for a release | available |
| `fdm-issue-workflow` | Drafting issues and PR descriptions in `.drafts/`, starting work on an `FDM-NNN` issue, branch and base choice (feature, `release/*`, `hotfix/*`), PR size and stacked PRs | available |
| `fdm-core-api` | `fdm-core` function patterns: `fn(fdm, principal_id, …)` signatures, transactions, `handleError`, colocated types and tests (the essentials are in `AGENTS.md` for now) | not available yet |
| `fdm-norms` | Year-versioned Dutch fertilizer application norms in `fdm-calculator/src/norms/`: copy-forward per year, the `filling`/`value` split, legal sourcing | not available yet |
| `fdm-calculator` | Agronomic calculation conventions, nutrient balances, `nmi-api` usage | not available yet |

Skills marked "not available yet" don't exist; don't look for them.

`impeccable` is a third-party design skill and not part of the family. It is installed as the `impeccable` Claude Code plugin (not vendored in this repo); `.claude/settings.json` offers it to everyone who opens the repo. Together with `fdm-app/PRODUCT.md` and `fdm-app/DESIGN.md` it covers how `fdm-app` should look and feel, while `fdm-app-conventions` covers how it is wired.

The `shadcn` skill (component docs for shadcn/ui) is not vendored either. Install it at user level if you work on `components/ui/`; see the shadcn/ui documentation for the current install command.

## Layout

Every family member uses the same structure:

```
.claude/skills/<name>/
  SKILL.md          # required, self-contained, the entry point
  scripts/          # optional, zero-dependency Node scripts the agent may run
  reference/        # optional, only when SKILL.md would exceed ~400 lines
```

Prefer a single `SKILL.md`. Split into `reference/*.md` only when the skill genuinely covers several independent workflows, and have `SKILL.md` route to them.

## Frontmatter

```yaml
---
name: fdm-schema
description: <routing sentence: what the skill owns, when to use it, and what it explicitly does not cover>
version: 1.0.0
user-invocable: true
argument-hint: "[explain|add-table|add-column|review|check] [target]"
license: MIT
---
```

Rules:

- `name` matches the directory name and starts with `fdm-` for family members.
- `description` is the routing signal. It must state what the skill owns **and** explicitly disclaim neighbouring domains, so that two skills are never plausible answers to the same request.
- `version` uses semver and is bumped when the guidance changes materially. It is for human readers only: Claude Code doesn't read it.
- `user-invocable` and `argument-hint` are Claude Code fields: the skill can be called as `/<name>`, and the hint is shown after the command.
- Prose is not hard-wrapped: one continuous line per paragraph or bullet.

## Writing guidance

- Teach rules and process; link to `fdm-docs/` for exhaustive reference material rather than copying it, since a copy is itself a source of drift.
- Prefer tables and wrong/right code pairs over prose.
- If a convention can be checked mechanically, ship a script under `scripts/` and wire it into CI — documentation that nothing enforces drifts silently.
