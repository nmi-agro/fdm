#!/usr/bin/env node
/**
 * Route-drift warning for the user manual.
 *
 * Lists the files a pull request changes and compares them with the `routes` and `watch` globs in
 * the frontmatter of every manual page. When a PR changes a file that a page describes, but not
 * the page itself, it writes a GitHub warning annotation and a table in the job summary, so the
 * author can check whether the manual still matches the app.
 *
 * It only warns: the exit code is always 0. Run it with BASE_SHA and HEAD_SHA set, for example:
 *
 *   BASE_SHA=$(git merge-base origin/development HEAD) HEAD_SHA=HEAD node fdm-app/scripts/manual-route-drift.mjs
 */
import { execFileSync } from "node:child_process"
import { appendFileSync, readdirSync, readFileSync } from "node:fs"
import { dirname, matchesGlob, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = resolve(appDir, "..")
const contentDir = "fdm-app/app/content/manual"
const routesDir = "fdm-app/app/routes"

function changedFiles(base, head) {
  const output = execFileSync("git", ["diff", "--name-only", `${base}...${head}`], {
    cwd: repoRoot,
    encoding: "utf8",
  })
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function manualPages() {
  const pages = []
  for (const kind of ["chapters", "background"]) {
    const dir = `${contentDir}/${kind}`
    for (const name of readdirSync(resolve(repoRoot, dir))) {
      if (!name.endsWith(".md")) continue
      const file = `${dir}/${name}`
      const raw = readFileSync(resolve(repoRoot, file), "utf8")
      const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)
      if (!match) continue
      const frontmatter = parse(match[1]) ?? {}
      const globs = [
        ...(frontmatter.routes ?? []).map((glob) => `${routesDir}/${glob}`),
        ...(frontmatter.watch ?? []),
      ]
      pages.push({ file, title: frontmatter.title ?? name, globs })
    }
  }
  return pages
}

function main() {
  const base = process.env.BASE_SHA
  const head = process.env.HEAD_SHA || "HEAD"
  if (!base) {
    console.log("BASE_SHA is not set; skipping the manual route-drift check.")
    return
  }

  let changed
  try {
    changed = changedFiles(base, head)
  } catch (error) {
    console.log(`::warning::Could not list changed files: ${error.message}`)
    return
  }
  const changedSet = new Set(changed)

  const findings = []
  for (const page of manualPages()) {
    if (changedSet.has(page.file)) continue
    const hits = changed.filter((file) => page.globs.some((glob) => matchesGlob(file, glob)))
    if (hits.length > 0) findings.push({ page, hits })
  }

  if (findings.length === 0) {
    console.log("Manual route-drift: no described routes changed without their manual page.")
    return
  }

  for (const { page, hits } of findings) {
    const list = hits.slice(0, 5).join(", ") + (hits.length > 5 ? ", …" : "")
    console.log(
      `::warning file=${page.file},title=Handleiding bijwerken?::This PR changes ${list}, which "${page.title}" describes. Check whether the manual page still matches, or tick "manual not needed" in the PR.`,
    )
  }

  const summary = process.env.GITHUB_STEP_SUMMARY
  if (summary) {
    const rows = findings.map(
      ({ page, hits }) => `| \`${page.file}\` | ${hits.map((hit) => `\`${hit}\``).join("<br>")} |`,
    )
    appendFileSync(
      summary,
      [
        "## Manual route drift",
        "",
        "These manual pages describe files that this PR changes, but the pages themselves did not change. Check whether labels, steps or screenshots are still correct.",
        "",
        "| Manual page | Changed files |",
        "| --- | --- |",
        ...rows,
        "",
      ].join("\n"),
    )
  }
}

try {
  main()
} catch (error) {
  console.log(`::warning::Manual route-drift check failed: ${error.message}`)
}
process.exit(0)
