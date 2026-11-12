#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook: format the file that was just edited with oxfmt.
 *
 * Reads the hook payload from stdin, takes `tool_input.file_path`, and runs the
 * repository's own oxfmt (respecting `.oxfmtrc.json`) on that single file. Only
 * code and JSON files inside the repository are formatted; Markdown is skipped
 * because the manual and docs are written by hand.
 *
 * The hook never blocks an edit: it always exits 0 and reports problems on stderr.
 */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const FORMATTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
])
const SKIPPED_SEGMENTS = ["node_modules", "dist", "build", ".react-router", ".turbo", ".docusaurus"]

const repoRoot = process.env.CLAUDE_PROJECT_DIR
  ? path.resolve(process.env.CLAUDE_PROJECT_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

function readStdin() {
  return new Promise((resolve) => {
    let data = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk) => {
      data += chunk
    })
    process.stdin.on("end", () => resolve(data))
    process.stdin.on("error", () => resolve(""))
  })
}

function shouldFormat(filePath) {
  if (!FORMATTED_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return false
  const relative = path.relative(repoRoot, filePath)
  if (relative.startsWith("..") || path.isAbsolute(relative)) return false
  const segments = relative.split(path.sep)
  return !segments.some((segment) => SKIPPED_SEGMENTS.includes(segment))
}

async function main() {
  let payload
  try {
    payload = JSON.parse(await readStdin())
  } catch {
    return
  }
  const rawPath = payload?.tool_input?.file_path ?? payload?.tool_response?.filePath
  if (typeof rawPath !== "string" || rawPath.length === 0) return

  const filePath = path.resolve(repoRoot, rawPath)
  if (!shouldFormat(filePath) || !existsSync(filePath)) return

  // Run oxfmt's own entry point with the current Node binary, so no shell (and no
  // shell quoting of paths with spaces) is involved on any platform.
  const entry = path.join(repoRoot, "node_modules", "oxfmt", "bin", "oxfmt")
  if (!existsSync(entry)) {
    process.stderr.write("format hook: oxfmt not found; run `pnpm install` first\n")
    return
  }

  const result = spawnSync(process.execPath, [entry, filePath], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 10_000,
  })
  if (result.error || result.status !== 0) {
    const reason = result.error?.message ?? result.stderr?.trim() ?? `exit code ${result.status}`
    process.stderr.write(
      `format hook: oxfmt failed for ${path.relative(repoRoot, filePath)}: ${reason}\n`,
    )
  }
}

main()
  .catch((error) => {
    process.stderr.write(`format hook: ${error?.message ?? error}\n`)
  })
  .finally(() => {
    process.exitCode = 0
  })
