# Project skills

This directory holds the project-level skills that Copilot (and other agents) discover automatically when working in this repository. A skill encodes durable, repository-specific knowledge so that every agent applies the same conventions instead of re-deriving them from the source each session.

## The `fdm-*` skill family

FDM knowledge is split into narrowly-scoped skills, each owning exactly one domain. Narrow scope is deliberate: it keeps every `SKILL.md` short enough to actually be read, and it makes ownership of a convention unambiguous.

| Skill | Owns | Status |
|---|---|---|
| `fdm-schema` | Database schema and data model: the Asset–Action model, column/table naming, schema-change workflow, schema-level authorization, schema anti-patterns | available |
| `fdm-api` | The REST layer in `fdm-api`: Hono + zod-openapi route definitions, the injectable services pattern, RFC 9457 problem details, pagination, API-key auth, API tests | available |
| `fdm-app-conventions` | `fdm-app` mechanics: React Router v8 framework mode, flat file routing, loaders and actions, the `.server.ts`/`.client.ts` boundary, error helpers, Zustand stores, component placement | available |
| `fdm-core-api` | `fdm-core` function patterns: `fn(fdm, principal_id, …)` signatures, transactions, `handleError`, colocated types and tests | planned |
| `fdm-norms` | Year-versioned Dutch fertilizer application norms in `fdm-calculator/src/norms/`: copy-forward per year, the `filling`/`value` split, legal sourcing | planned |
| `fdm-calculator` | Agronomic calculation conventions, nutrient balances, `nmi-api` usage | planned |

`impeccable` is a third-party design skill and is not part of the family; it is vendored as-is and should not be edited to encode FDM conventions. It covers how `fdm-app` should look and feel, while `fdm-app-conventions` covers how it is wired.

## Layout

Every family member uses the same structure:

```
.github/skills/<name>/
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
- `version` uses semver and is bumped when the guidance changes materially.
- Prose is not hard-wrapped: one continuous line per paragraph or bullet.

## Writing guidance

- Teach rules and process; link to `fdm-docs/` for exhaustive reference material rather than copying it, since a copy is itself a source of drift.
- Prefer tables and wrong/right code pairs over prose.
- If a convention can be checked mechanically, ship a script under `scripts/` and wire it into CI — documentation that nothing enforces drifts silently.
