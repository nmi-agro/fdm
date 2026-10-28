import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const srcDir = dirname(fileURLToPath(import.meta.url))

/** Packages that must never be reached at runtime from the browser entry. */
const FORBIDDEN = [/^@nmi-agro\/fdm-core$/, /^drizzle-orm/, /^postgres$/, /^geotiff$/, /^node:/]

/** Packages that are known to be safe in the browser. */
const ALLOWED = [/^decimal\.js$/, /^date-fns/, /^zod$/]

// Matches runtime `import ... from "x"`, `export ... from "x"` and side-effect `import "x"`.
// Type-only imports and exports are skipped, because they are erased at build time.
const IMPORT_RE = /^\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm

function resolveRelative(fromFile: string, specifier: string): string {
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [`${base}.ts`, join(base, "index.ts"), base]
  const found = candidates.find((candidate) => existsSync(candidate) && candidate.endsWith(".ts"))
  if (!found) throw new Error(`Cannot resolve ${specifier} from ${fromFile}`)
  return found
}

function collectRuntimeImports(entry: string) {
  const visited = new Set<string>()
  const external: { from: string; specifier: string }[] = []
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (visited.has(file)) continue
    visited.add(file)
    const source = readFileSync(file, "utf-8")
    for (const match of source.matchAll(IMPORT_RE)) {
      const specifier = match[1]
      if (specifier.startsWith(".")) {
        queue.push(resolveRelative(file, specifier))
      } else {
        external.push({ from: file, specifier })
      }
    }
  }
  return { visited, external }
}

describe("browser entry", () => {
  const { visited, external } = collectRuntimeImports(join(srcDir, "browser.ts"))

  it("does not import server-only modules at runtime", () => {
    const forbidden = external.filter(({ specifier }) =>
      FORBIDDEN.some((pattern) => pattern.test(specifier)),
    )
    expect(forbidden).toEqual([])
  })

  it("only imports packages that are known to be browser-safe", () => {
    const unknown = external.filter(
      ({ specifier }) => !ALLOWED.some((pattern) => pattern.test(specifier)),
    )
    expect(unknown).toEqual([])
  })

  it("reaches the modules it re-exports", () => {
    expect(visited.size).toBeGreaterThan(1)
  })
})
