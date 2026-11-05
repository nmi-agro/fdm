import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import allowlist from "../../content/manual/label-allowlist.json"
import { manualPages } from "./content.server"
import { createLabelMatcher, extractUiStrings, normalizeLabel } from "./labels"

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const repoRoot = resolve(appRoot, "..")

/** Source directories whose strings can appear in the UI. */
const CORPUS_ROOTS = ["fdm-app/app", "fdm-core/src", "fdm-data/src", "fdm-calculator/src"]

/** Paths that must not count as UI, relative to the repository root. */
const EXCLUDED = [
  /^fdm-app\/app\/content\/manual\//,
  /^fdm-app\/app\/lib\/manual\//,
  /^fdm-app\/app\/lib\/changelog\.ts$/,
  /\.test\.tsx?$/,
  /\/migrations\//,
  /\.d\.ts$/,
]

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") yield* walk(path)
    } else if (/\.tsx?$/.test(entry.name)) {
      yield path
    }
  }
}

function collectCorpus(): string[] {
  const strings: string[] = []
  for (const root of CORPUS_ROOTS) {
    for (const file of walk(resolve(repoRoot, root))) {
      const rel = relative(repoRoot, file).replaceAll("\\", "/")
      if (EXCLUDED.some((pattern) => pattern.test(rel))) continue
      strings.push(...extractUiStrings(readFileSync(file, "utf8")))
    }
  }
  return strings
}

describe("extractUiStrings", () => {
  it("finds string literals, template parts and JSX text", () => {
    const source = `const a = "Bouwplan"; const b = \`Oogst \${x} toevoegen\`;
      <Button>Snede{" "}toevoegen</Button>`
    expect(extractUiStrings(source)).toEqual(
      expect.arrayContaining(["Bouwplan", "Oogst", "toevoegen", "Snede toevoegen"]),
    )
  })
})

describe("createLabelMatcher", () => {
  const match = createLabelMatcher(["Bemesting", "Klik hier om een bemesting toe te voegen"])

  it("matches short labels only exactly", () => {
    expect(match("Bemesting")).toBe(true)
    expect(match("Klik")).toBe(false)
  })

  it("matches long labels as a substring", () => {
    expect(match("een bemesting toe te voegen")).toBe(true)
  })
})

describe("manual labels", () => {
  const matches = createLabelMatcher(collectCorpus())
  const allowed = new Map(allowlist.map((entry) => [normalizeLabel(entry.text), entry]))

  const labels = manualPages.flatMap((page) => [
    ...page.bold.map((ref) => ({ text: ref.value, where: `${page.file}:${ref.line}` })),
    ...(page.frontmatter.inApp ?? []).map((text) => ({ text, where: `${page.file} (inApp)` })),
  ])

  it("only uses bold text and in-app paths for labels that exist in the app", () => {
    const missing = labels
      .filter((label) => !allowed.has(normalizeLabel(label.text)) && !matches(label.text))
      .map((label) => `${label.where}: "${label.text}"`)
    expect(
      missing,
      "Vetgedrukte tekst moet een bestaand UI-label zijn. Pas de tekst aan, of zet hem met een reden in label-allowlist.json.",
    ).toEqual([])
  })

  it("has a reason for every allowlist entry and no unused entries", () => {
    const used = new Set(labels.map((label) => normalizeLabel(label.text)))
    const problems = allowlist.flatMap((entry) => {
      const errors: string[] = []
      if (!entry.reason?.trim()) errors.push(`"${entry.text}": reden ontbreekt`)
      if (!used.has(normalizeLabel(entry.text))) errors.push(`"${entry.text}": wordt niet gebruikt`)
      if (matches(entry.text)) errors.push(`"${entry.text}": is al een UI-label, verwijder het`)
      return errors
    })
    expect(problems).toEqual([])
  })
})
