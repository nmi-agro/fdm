import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { type ManualKind, type ManualPage, parseManualFile } from "./parse"

const FOLDERS: Record<ManualKind, string> = { chapter: "chapters", background: "background" }

/**
 * Reads and parses all manual pages from disk.
 *
 * The app loads the pages with `import.meta.glob` (`content.server.ts`), which only works inside
 * Vite. Tools that run in plain Node.js, such as the screenshot run, use this function instead.
 *
 * @param appRoot - The fdm-app package folder.
 * @returns The parsed pages, chapters first, each kind sorted by file name.
 */
export function loadManualPagesFromDisk(appRoot: string): ManualPage[] {
  const pages: ManualPage[] = []
  for (const kind of ["chapter", "background"] as const) {
    const folder = `app/content/manual/${FOLDERS[kind]}`
    const files = readdirSync(join(appRoot, folder))
      .filter((name) => name.endsWith(".md"))
      .sort()
    for (const name of files) {
      const file = `${folder}/${name}`
      pages.push(parseManualFile(kind, file, readFileSync(join(appRoot, file), "utf8")))
    }
  }
  return pages
}
