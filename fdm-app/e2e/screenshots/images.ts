/**
 * Turns Playwright screenshots into the committed WebP files and keeps `manifest.json` in step.
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"

/** Widest image in the manual, in pixels: the width of the capture viewport (1920 × 1080). */
export const MAX_WIDTH = 1920

/** WebP quality: small files with crisp text. */
const WEBP_QUALITY = 82

/** A channel difference above this counts as a changed pixel; below it is encoding noise. */
const CHANNEL_TOLERANCE = 24

/**
 * Changed pixels allowed outside maps. Rendering can differ by a few isolated pixels between
 * runs; a changed word or number changes hundreds, so a real change always counts.
 */
export const STRAY_PIXELS = 40

/**
 * Share of the pixels inside a map that may change. Map tiles and raster layers render slightly
 * differently between runs. Outside the maps the strict {@link STRAY_PIXELS} limit applies, so a
 * changed label next to a map still counts.
 */
export const MAP_CHANGED_SHARE = 0.02

/** A rectangle in screenshot pixels, such as the area of a map. */
export interface Area {
  x: number
  y: number
  width: number
  height: number
}

/** What happened to one screenshot in this run. */
export type ImageStatus = "added" | "changed" | "unchanged"

/** Width and height of each screenshot, keyed by id, as read by `app/lib/manual/screenshots.ts`. */
export type Manifest = Record<string, { width: number; height: number }>

/**
 * Converts a PNG to the committed WebP format.
 *
 * @param png - The screenshot as PNG.
 * @returns The WebP image, at most {@link MAX_WIDTH} pixels wide.
 */
export async function toWebp(png: Buffer): Promise<Buffer> {
  return sharp(png)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 6, smartSubsample: true })
    .toBuffer()
}

/**
 * Tells whether two images differ by more than rendering noise.
 *
 * @param a - The first image (any format sharp reads).
 * @param b - The second image.
 * @param maps - Areas with a map, where up to {@link MAP_CHANGED_SHARE} of the pixels may change.
 * @returns `true` when the sizes differ, more than {@link STRAY_PIXELS} pixels changed outside
 *   the maps, or more than {@link MAP_CHANGED_SHARE} of the pixels changed inside them.
 */
export async function differs(a: Buffer, b: Buffer, maps: readonly Area[] = []): Promise<boolean> {
  const [rawA, rawB] = await Promise.all(
    [a, b].map((image) => sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true })),
  )
  const { width, height } = rawA.info
  if (width !== rawB.info.width || height !== rawB.info.height) return true

  const inMap = (x: number, y: number) =>
    maps.some((m) => x >= m.x && x < m.x + m.width && y >= m.y && y < m.y + m.height)
  let mapPixels = 0
  let changedInMaps = 0
  let changedOutside = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      let changed = false
      for (let c = 0; c < 4 && !changed; c++) {
        changed = Math.abs(rawA.data[i + c] - rawB.data[i + c]) > CHANNEL_TOLERANCE
      }
      if (maps.length > 0 && inMap(x, y)) {
        mapPixels++
        if (changed) changedInMaps++
      } else if (changed) {
        changedOutside++
      }
    }
  }
  return (
    changedOutside > STRAY_PIXELS ||
    (mapPixels > 0 && changedInMaps / mapPixels > MAP_CHANGED_SHARE)
  )
}

/**
 * Writes a screenshot unless it looks the same as the committed one, so that unchanged pages do
 * not create noise in the screenshot pull request.
 *
 * @param dir - The screenshots folder.
 * @param id - The screenshot id.
 * @param png - The new screenshot as PNG.
 * @param maps - Areas with a map in the PNG, in its pixels (see {@link differs}).
 * @returns Whether the image was added, changed or kept.
 */
export async function saveScreenshot(
  dir: string,
  id: string,
  png: Buffer,
  maps: readonly Area[] = [],
): Promise<ImageStatus> {
  const file = join(dir, `${id}.webp`)
  const webp = await toWebp(png)
  // The WebP can be smaller than the PNG; scale the map areas along.
  const scale =
    ((await sharp(webp).metadata()).width ?? 1) / ((await sharp(png).metadata()).width ?? 1)
  const scaled = maps.map((m) => ({
    x: Math.floor(m.x * scale),
    y: Math.floor(m.y * scale),
    width: Math.ceil(m.width * scale),
    height: Math.ceil(m.height * scale),
  }))
  if (existsSync(file)) {
    if (!(await differs(readFileSync(file), webp, scaled))) return "unchanged"
    writeFileSync(file, webp)
    return "changed"
  }
  writeFileSync(file, webp)
  return "added"
}

/**
 * Removes images whose id no longer has a capture definition.
 *
 * @param dir - The screenshots folder.
 * @param ids - The ids that still have a definition.
 * @returns The removed ids.
 */
export function removeStaleImages(dir: string, ids: ReadonlySet<string>): string[] {
  if (!existsSync(dir)) return []
  const removed: string[] = []
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".webp")) continue
    const id = name.slice(0, -".webp".length)
    if (!ids.has(id)) {
      rmSync(join(dir, name))
      removed.push(id)
    }
  }
  return removed.sort()
}

/**
 * Writes `manifest.json` with the size of every WebP file in the folder, sorted by id.
 *
 * @param dir - The screenshots folder.
 * @returns The manifest.
 */
export async function writeManifest(dir: string): Promise<Manifest> {
  const manifest: Manifest = {}
  const names = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".webp")) : []
  for (const name of names.sort()) {
    const { width, height } = await sharp(join(dir, name)).metadata()
    if (!width || !height) throw new Error(`Could not read the size of ${name}`)
    manifest[name.slice(0, -".webp".length)] = { width, height }
  }
  writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}
