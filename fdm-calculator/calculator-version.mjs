// Plain JavaScript with JSDoc types, so that both the tsdown config of fdm-calculator and the Vite
// config of fdm-app can import it without a TypeScript loader.
import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageDir = path.dirname(fileURLToPath(import.meta.url))
const sourceDir = path.join(packageDir, "src")

/** The placeholder in `src/package.ts` that the build replaces with {@link getCalculatorVersion}. */
export const CALCULATOR_VERSION_PLACEHOLDER = `"fdm-calculator:{FDM_CALCULATOR_VERSION}"`

/**
 * Returns the version of fdm-calculator that is part of the key of cached calculations:
 * `fdm-calculator:<package version>+<source hash>`.
 *
 * The source hash is a hash of the calculator source (`src`, without tests). It changes with every
 * change to the calculation code, also between releases and during local development, so that a
 * cached result of older code is not reused. Builds of the same code get the same version, so the
 * cache stays valid across deployments of one release.
 *
 * @returns {string} The calculator version, e.g. `fdm-calculator:0.20.0+3f9a1c0b2d4e`.
 */
export function getCalculatorVersion() {
  /** @type {{ version: string }} */
  const pkg = JSON.parse(readFileSync(path.join(packageDir, "package.json"), "utf-8"))
  return `fdm-calculator:${pkg.version}+${hashCalculatorSource()}`
}

/**
 * Returns the calculator version as a string literal of the same length as the placeholder, so that
 * source maps stay valid when it replaces the placeholder.
 *
 * @returns {string} The quoted calculator version, padded with spaces after the closing quote.
 * @throws {Error} If the version is longer than the placeholder.
 */
export function getCalculatorVersionReplacement() {
  const replacement = JSON.stringify(getCalculatorVersion())
  if (replacement.length > CALCULATOR_VERSION_PLACEHOLDER.length) {
    throw new Error(
      `The fdm-calculator version ${replacement} is longer than its placeholder; source maps would break.`,
    )
  }
  return replacement.padEnd(CALCULATOR_VERSION_PLACEHOLDER.length, " ")
}

/**
 * Whether a file belongs to the calculator source that {@link getCalculatorVersion} hashes.
 *
 * @param {string} file - An absolute file path.
 * @returns {boolean} `true` for files in `src`, except tests.
 */
export function isCalculatorSource(file) {
  const relative = path.relative(sourceDir, path.resolve(file))
  return !relative.startsWith("..") && !path.isAbsolute(relative) && !isTest(relative)
}

/**
 * @param {string} relativePath - A path relative to `src`.
 * @returns {boolean} Whether the file is a test (`*.test.*`) or the test setup.
 */
function isTest(relativePath) {
  // The same files as `**/*.test.*` in .dockerignore, so a Docker build gets the same hash
  const name = path.basename(relativePath)
  return name.includes(".test.") || name === "setup-test.ts"
}

/**
 * @returns {string} The first 12 characters of the SHA-256 hash of the calculator source.
 */
function hashCalculatorSource() {
  const files = readdirSync(sourceDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(sourceDir, path.join(entry.parentPath, entry.name)))
    .filter((relative) => !isTest(relative))
    // Sort on the path with forward slashes, so the hash is the same on every platform
    .map((relative) => relative.split(path.sep).join("/"))
    .sort()

  const hash = createHash("sha256")
  for (const relative of files) {
    // Ignore line endings, so a checkout with CRLF gives the same hash
    const content = readFileSync(path.join(sourceDir, relative), "utf-8").replace(/\r\n/g, "\n")
    hash.update(relative).update("\0").update(content).update("\0")
  }
  return hash.digest("hex").slice(0, 12)
}
