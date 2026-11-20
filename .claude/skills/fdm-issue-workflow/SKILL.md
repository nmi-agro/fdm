---
name: fdm-issue-workflow
description: Use when drafting a GitHub issue or PR description for nmi-agro/fdm, when starting work on an FDM-NNN issue (from Linear or GitHub), or when deciding the branch, base branch and PR size for a change — including whether to split it into stacked PRs. Covers the English issue template, the gitignored .drafts/ folder, branch naming for feature, release and hotfix work, the ~100-file PR limit, and the plan-before-code flow. Not for the content of a change itself (see fdm-schema, fdm-app-conventions, fdm-api, fdm-user-guide-sync), release mechanics (see fdm-docs/docs/contributing/03-releasing-fdm.md), or reviewing a PR.
version: 1.0.0
user-invocable: true
argument-hint: "[draft-issue|start|pr-description|plan-stack] [FDM-NNN or topic]"
license: MIT
---

This skill turns a request like "draft an issue for X" or "work on FDM-123" into the same predictable flow every time, so that issues read alike, branches land on the right base, and PRs stay reviewable.

## Commands

| Command | Do this |
|---|---|
| `draft-issue [topic]` | Investigate the code, then write the issue to `.drafts/issue-<slug>.md` using the template below. |
| `start FDM-NNN` | Read the issue, pick the branch and base (Branches), make a plan with a file-count estimate (Plan first), and wait for approval before writing code. |
| `pr-description` | Write `.drafts/pr-<branch>.md` following `.github/pull_request_template.md`. |
| `plan-stack` | Split a change that exceeds the PR limit into a stack (PR size). |

## Drafts

- Write every draft (issue, PR description, issue-tracker update, release note) to `.drafts/` in the repository root. The folder is gitignored, so drafts never end up in a commit. Create it if it is missing.
- Name drafts by type and subject: `issue-<slug>.md`, `pr-<branch>.md`, `update-fdm-<NNN>.md`.
- Don't create or edit issues, PRs or issue-tracker items yourself unless asked; the user posts the draft.

## Issue template

Issues are in **English**, also when the conversation is in Dutch. Quote Dutch UI labels as they appear in the app ("Bemestingsplan").

```markdown
# <Imperative title: what should change>

## Problem
What goes wrong or is missing today, for whom, and how to see it. Link code as `path/to/file.ts:123`.

## Context
Background a reviewer needs: related packages, earlier decisions, constraints (public repo, Dutch UI, year-versioned norms).

## Proposal
The intended change. Name the packages and main files. Mention alternatives only when a choice is still open.

## Acceptance criteria
- [ ] Observable outcomes a reviewer can check.
- [ ] Tests that prove it.
- [ ] Docs, manual chapter and changesets updated where needed.

## Out of scope
What this issue deliberately does not cover.
```

Rules:

- Investigate before writing: cite the actual files and functions, not guesses. Mark anything you could not verify as an open question.
- No real farm, field or personal data, no internal URLs and no internal source systems; the repository and its issues are public.
- Keep it as short as the problem allows. A two-line bug needs no "Context" essay.

## Branches

| Work | Branch | From | PR into |
|---|---|---|---|
| Feature or fix for an issue | `fdm-NNN` (lowercase, the issue key) | `development` | `development` |
| Release preparation | `release/YYYY-MM` | `development` | `main` |
| Urgent production fix | `hotfix/fdm-NNN` | `main` | `main` |

After a release or hotfix merges into `main`, `main` is merged back into `development`. When an issue says "hotfix" or the bug is in production only, ask whether it should go through `hotfix/` before branching from `development`. If the user already created a branch, use it.

## Plan first

1. Read the issue and the code it touches. Load the domain skill for each area.
2. Write a short plan: the change per package, tests, docs and manual chapters, agent instructions (`AGENTS.md`, `CLAUDE.md`, skills) that describe what changes, and one changeset per affected package.
3. Estimate the number of changed files, including tests, docs, migrations and changesets.
4. Get approval before writing code.

## PR size

- Keep a PR under about **100 changed files**; larger PRs can't be reviewed automatically.
- If the estimate is larger, propose a stack of **at most 5 PRs** before writing code: name each branch (`fdm-NNN-<part>`), what it contains, and its base (the previous branch in the stack). Shared interfaces and schema go first.
- Ask whether the stacked PRs should reference the parent issue or get sub-issues; don't assume.
- Put new feature logic in its own workspace package rather than growing `fdm-core`.
- Work on lower branches of a stack in a git worktree, so a running `pnpm dev` in the main checkout keeps working.

## PR description

Follow `.github/pull_request_template.md`: a summary of what changed and why with the issue link, the checklist ticked honestly, and concrete "How to test" steps. Note any CLAUDE.md or AGENTS.md mismatch you ran into, and any check you could not run.
