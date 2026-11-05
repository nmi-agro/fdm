---
name: fdm-user-guide-sync
description: Use when the user guide in fdm-app (the public "Handleiding" at /manual, Markdown in fdm-app/app/content/manual) must catch up with changes in the app — after a PR that changes labels, flows or pages, in the weekly sync against development, or when preparing the background-page review for a release. Finds the chapters whose routes changed, compares them with the diff, updates labels, steps and in-app paths, and keeps the label test green. Not for writing new chapters from scratch, the manual's rendering code or routes (see fdm-app-conventions), visual design (see impeccable), or the agronomic content of background pages, which a person reviews.
version: 1.0.0
user-invocable: true
argument-hint: "[pr|since <git-ref>|release] — default: pr"
license: MIT
---

The user guide ("Handleiding") is only useful while it matches the app: a chapter that describes a button that no longer exists does more harm than no chapter. This skill brings chapters in line with code changes. It edits what a diff proves changed and nothing else, and it says what it could not verify instead of guessing.

The content, its frontmatter and its writing rules are described in `fdm-app/app/content/manual/README.md`. Read that first.

## Modes

| Mode | Diff to compare | Typical caller |
|---|---|---|
| `pr` (default) | `origin/development...HEAD` | A developer, in their own PR, before review |
| `since <git-ref>` | `<git-ref>...origin/development` | The weekly routine; the release manager |
| `release` | The previous release tag `...HEAD` on the release branch | The release manager, before the release PR |

For the weekly routine, `<git-ref>` is the newest commit on `development` whose message contains `[user-guide-sync]`. When there is none, use the commit from 7 days ago: `git rev-list -1 --before="7 days ago" origin/development`.

## Tone of voice

The guide speaks as a calm, competent agronomic colleague who explains the app: plain-spoken, substantiated and quietly confident. It is professional but informal, never corporate and never hype. Every edit, however small, keeps that voice, so a synced paragraph reads like the text around it.

- **Dutch, addressed as "je".** The guide uses "je/jij/jouw", not "u/uw", even where the app's own screens use "u". Use "{{appName}}" for the product and "de app" for the software.
- **Short, active sentences.** One instruction per sentence; lead with the action: "Klik op **Opslaan**." Steps are numbered lists; options and outcomes are bullets or tables.
- **Explain why, briefly.** One sentence of reason when it helps the reader decide: "Waarom die gegevens? Ze bepalen hoeveel stikstof er met de oogst afgaat."
- **Honest about limits.** Say what is estimated, indicative or not (yet) supported, and when RVO or the regulations take precedence. Never promise outcomes, and never claim more than the app does.
- **Agronomic vocabulary as farmers and advisors use it**: perceel, bouwplan, gebruiksruimte, bemesting, snede, bufferstrook. Explain a technical term the first time it appears on a page; don't translate it into English.
- **Metric units, Dutch number format**: "30 m³/ha", "0,5", "1.250 kg N/ha", "15 minuten".
- **No filler, exclamation marks, emoji or marketing**: no "eenvoudig", "snel en makkelijk", "revolutionair", "Let op!!".

| Instead of | Write |
|---|---|
| "U kunt eenvoudig een bemesting toevoegen!" | "Klik op **Toevoegen** om een bemesting in te voeren." |
| "Deze geavanceerde functie berekent nauwkeurig uw stikstofbalans." | "{{appName}} rekent de stikstofbalans per perceel uit. De uitkomst is zo goed als de gegevens die je invult." |
| "De gebruikersinterface toont de nutrient advice per field." | "Je ziet het bemestingsadvies per perceel." |
| "Dit werkt altijd." (unverified) | Leave the sentence out, or say under which conditions it works. |

## Process

1. **Find the affected chapters.** Run the drift script with the diff from the table:

   ```bash
   BASE_SHA=<base> HEAD_SHA=<head> node fdm-app/scripts/manual-route-drift.mjs
   ```

   Each `::warning` names a chapter and the changed files it describes, through the `routes` and `watch` globs in its frontmatter. No warnings means nothing to do: stop and report that.

2. **Read the change, then the chapter.** For each affected chapter, read `git diff <base>...<head> -- <changed files>` and then the chapter. Look for:
   - renamed or removed labels: buttons, tabs, menu items, field labels, statuses;
   - steps that moved, were added or disappeared, such as a wizard step or a dialog;
   - pages that moved, which affect the `inApp` paths, help targets and `routes` globs;
   - features that were switched off, put behind a flag, or newly released.

3. **Edit the chapter.** Keep the scope minimal.
   - Use the exact label from the code in **bold**. Bold is reserved for UI labels; everything else is plain text.
   - Keep `{{appName}}` and the explicit `{#id}`s, and write in the [tone of voice](#tone-of-voice) above.
   - Update `inApp`, `routes` and `watch` when pages moved. Every glob must still match a file.
   - Set `updated:` to today's date on every chapter you change.
   - Don't rewrite paragraphs the diff does not touch, and don't restyle.

4. **Help targets.** When a heading that a help target in `fdm-app/app/lib/manual/help-targets.ts` points to was renamed, keep its `{#id}`. When a route's purpose changed, check its `handle.help`.

5. **Verify.**

   ```bash
   pnpm --filter @nmi-agro/fdm-app test
   pnpm exec oxfmt <changed files>
   ```

   The label test lists every bold text that is not an existing UI label. Fix the text; add to `label-allowlist.json` only when the label truly exists but is composed at runtime, and give a reason.

6. **Changeset.** Add a patch changeset for `@nmi-agro/fdm-app` ("Update the user guide for …"), or update the PR's existing one.

7. **Report.** For each chapter, give one line per change, saying what changed and which file or commit proves it. Then list the open questions: behaviour you could not confirm from the code, such as runtime conditions, flags or external services.

## Release mode: background pages

Background pages (`content/manual/background/`) explain calculations. Their accuracy is a person's responsibility; this skill only prepares the review.

- List the changes in `fdm-calculator/src` since the previous release, per background page, using each page's `watch` globs.
- For each page, write a short summary for the reviewer: which constants, formulas or inputs changed, and which paragraphs of the page they touch.
- **Never change `lastReviewed`.** A maintainer sets it after the review. Propose text changes in the report, not in the files, unless the user asks for them.

## Weekly routine

The scheduled routine runs `since <git-ref>` against `development`. Unattended, it follows these rules:

- Work on the branch `chore/user-guide-sync-<YYYY-MM-DD>` from `origin/development`.
- When there are changes, make one commit, `docs(fdm-app): sync user guide with development [user-guide-sync]`, push it, and open one PR to `development` with the report as its description. Ask for review from the people the routine is configured with.
- When there is nothing to do, don't create a branch or a PR.
- Touch only `fdm-app/app/content/manual/**`, `label-allowlist.json` and `.changeset/`. Code that looks wrong goes in the report, not in a fix.
- When unsure, leave the text as it is and put the question in the report. A PR that asks is better than a manual that guesses.

## Anti-patterns

| Anti-pattern | Instead |
|---|---|
| Rewriting a whole chapter because one label changed | Change the label and the sentence it is in |
| Bold for emphasis | Plain text or *italics*; bold means UI label |
| Adding a label to the allowlist to make the test pass | Use the label that the code actually renders |
| Bumping `lastReviewed` | Only a maintainer does that, after the agronomic review |
| Describing behaviour inferred from a component name | Read the JSX and the conditions; report what you could not confirm |
| Fixing app code from this skill | Report it; the sync PR only changes the guide |
