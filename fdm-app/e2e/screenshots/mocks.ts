/**
 * Synthetic responses for captures of flows that read uploaded files, such as lab reports. The
 * screenshots must never show real reports, so the browser gets a made-up answer instead of the
 * reading service's.
 */

import type { Page } from "@playwright/test"
import type { FeatureCollection, Polygon } from "geojson"
import { readFileSync } from "node:fs"
import type { DemoFarmIds, DemoFieldKey } from "../seed/demo-farm"
import { samplingPoints } from "../seed/sampling"
import { BASE_URL } from "../support/env"

/** The names of the mocks that capture definitions can use. */
export type CaptureMock = "soil-reader"

/** A tiny valid PDF, used as the content of every uploaded file. */
export const DUMMY_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
)

const OUTLINES = new Map(
  (
    JSON.parse(
      readFileSync(new URL("../seed/fields.geojson", import.meta.url), "utf8"),
    ) as FeatureCollection<Polygon, { key: DemoFieldKey }>
  ).features.map((feature) => [feature.properties.key, feature.geometry]),
)

/** One lab report as the soil reader would return it, by the file name it came from. */
interface Report {
  file: string
  /** The field the sampling location is in. */
  field: DemoFieldKey
  /** The field name printed on the report; may differ from the field of the location. */
  name: string
  depthLower: number
  values: Record<string, number | string>
}

const SAND = { a_som_loi: 4.8, a_clay_mi: 3, a_silt_mi: 9, a_sand_mi: 88, a_p_al: 38, a_p_cc: 2.1 }
const CLAY = {
  a_som_loi: 3.2,
  a_clay_mi: 29,
  a_silt_mi: 41,
  a_sand_mi: 30,
  a_p_al: 34,
  a_p_cc: 1.8,
}

/** The reports of the soil-reader mock: three that match, one to check and one unreadable. */
export const SOIL_REPORTS: Report[] = [
  {
    file: "Bodemanalyse Lange akker.pdf",
    field: "tarwe",
    name: "Lange akker",
    depthLower: 30,
    values: { ...CLAY, a_k_cc: 170, a_ph_cc: 6.8, a_n_rt: 1600 },
  },
  {
    file: "Bodemanalyse Kleiakker.pdf",
    field: "aardappelen",
    name: "Kleiakker",
    depthLower: 30,
    values: { ...CLAY, a_k_cc: 155, a_ph_cc: 6.9, a_n_rt: 1550 },
  },
  {
    file: "Bodemanalyse Maisakker.pdf",
    field: "mais",
    name: "Maïsakker",
    depthLower: 30,
    values: { ...SAND, a_k_cc: 100, a_ph_cc: 5.6, a_n_rt: 1900 },
  },
  {
    // The name on the report points to another field than the sampling location.
    file: "Bodemanalyse perceel 4.pdf",
    field: "grasland-huiskavel",
    name: "Achterweide",
    depthLower: 10,
    values: { ...SAND, a_k_cc: 130, a_ph_cc: 5.3, a_n_rt: 2200 },
  },
]

/** A file the reader could not read. */
export const UNREADABLE_REPORT = "Scan bodemrapport.pdf"

/** The file names to upload for the soil-reader mock. */
export const SOIL_REPORT_FILES = [...SOIL_REPORTS.map((r) => r.file), UNREADABLE_REPORT]

/**
 * Answers the app's lab report reader (`/api/soil-analysis/extract`) with {@link SOIL_REPORTS},
 * in the newline-delimited JSON that the real endpoint streams.
 *
 * @param page - The page to install the mock on.
 * @param ids - The demo farm, for the year of the sampling date.
 */
export async function mockSoilReader(page: Page, ids: DemoFarmIds): Promise<void> {
  const samplingDate = new Date(Date.UTC(ids.year, 2, 2, 12)).toISOString()
  const lines = SOIL_REPORTS.map((report) => {
    const outline = OUTLINES.get(report.field)
    if (!outline) throw new Error(`No outline for ${report.field}`)
    const points = samplingPoints(outline)
    return {
      success: true,
      filename: report.file,
      analyses: [
        {
          filename: report.file,
          b_name: report.name,
          b_sampling_date: samplingDate,
          a_depth_upper: 0,
          a_depth_lower: report.depthLower,
          location: { type: "Point", coordinates: points.coordinates[0] },
          b_sampling_geometry: points,
          b_sampling_geometry_zone: outline,
          a_source: "other",
          ...report.values,
        },
      ],
    }
  })
  lines.push({
    success: false,
    filename: UNREADABLE_REPORT,
    error: "Analyse mislukt",
  } as unknown as (typeof lines)[number])

  await page.route("**/api/soil-analysis/extract", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
    }),
  )
}

/** The greetings of the farm overview, which the server picks by the time of day. */
const GREETING = /Goede(?:nacht|morgen|middag|navond)/g

/**
 * Makes every page show the afternoon greeting, as if the server rendered it at 14:00. The server
 * picks the greeting from its own clock, which the run cannot freeze; without this, a capture in
 * the morning and one in the afternoon would differ.
 *
 * It rewrites the server-rendered HTML, including the loader data the browser hydrates with, so
 * both renders agree.
 *
 * @param page - The page to install the rewrite on.
 */
export async function fixGreeting(page: Page): Promise<void> {
  await page.route(`${BASE_URL}/**`, async (route) => {
    if (route.request().resourceType() !== "document") return route.fallback()
    // Redirects go back to the browser, so it ends up at the right URL.
    const response = await route.fetch({ maxRedirects: 0 })
    if (!(response.headers()["content-type"] ?? "").includes("text/html")) {
      return route.fulfill({ response })
    }
    const body = (await response.text()).replace(GREETING, "Goedemiddag")
    return route.fulfill({ response, body })
  })
}
