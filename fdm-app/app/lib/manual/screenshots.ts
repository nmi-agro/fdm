import { SCREENSHOT_PROTOCOL } from "./markdown"

/** A screenshot that manual content can show with `![Alt](screenshot:<id>)`. */
export interface ManualScreenshot {
  id: string
  src: string
  width?: number
  height?: number
}

const files = import.meta.glob<string>("/app/content/manual/screenshots/*.webp", {
  query: "?url",
  import: "default",
  eager: true,
})

const manifests = import.meta.glob<Record<string, { width: number; height: number }>>(
  "/app/content/manual/screenshots/manifest.json",
  { import: "default", eager: true },
)

const manifest = Object.values(manifests)[0] ?? {}

const screenshots = new Map<string, ManualScreenshot>(
  Object.entries(files).map(([path, src]) => {
    const id = path.replace(/^.*\//, "").replace(/\.webp$/, "")
    return [id, { id, src, ...manifest[id] }]
  }),
)

/**
 * Returns the screenshot for a `screenshot:<id>` URL or a bare id.
 *
 * @param idOrUrl - The id, with or without the `screenshot:` prefix.
 * @returns The screenshot, or `undefined` when the file does not exist (yet).
 */
export function getScreenshot(idOrUrl: string): ManualScreenshot | undefined {
  const id = idOrUrl.startsWith(SCREENSHOT_PROTOCOL)
    ? idOrUrl.slice(SCREENSHOT_PROTOCOL.length)
    : idOrUrl
  return screenshots.get(id)
}
