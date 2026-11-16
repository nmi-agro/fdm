/**
 * Tests for coded fields: every code is listed with its Dutch name in the OpenAPI document, so a
 * client can map the user's words to a code, and requests accept only those codes.
 */
import { fdmSchema } from "@nmi-agro/fdm-core"
import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import {
  ACQUIRING_METHODS,
  APPLICATION_METHODS,
  type CodeOption,
  describeCodes,
  GROUNDWATER_CLASSES,
  SELECTABLE_SOIL_ANALYSIS_SOURCES,
  SOIL_TYPES,
} from "../codes"
import { createFdmApi } from "../index"

const mockAuth = { api: { verifyApiKey: vi.fn() } } as any
const config = { appName: "Test App", appUrl: "https://test.example.com" }

async function components(): Promise<Record<string, any>> {
  const app = createFdmApi({} as any, mockAuth, config)
  const spec = await (await app.request("/openapi.json")).json()
  return spec.components.schemas
}

describe("describeCodes", () => {
  it("lists every code with its Dutch name, and leaves out a name equal to its code", () => {
    const text = describeCodes("Example.", [
      { value: "a", label: "Naam A" },
      { value: "II", label: "II" },
    ])
    expect(text).toContain("'a' (Naam A)")
    expect(text).toContain("'II'")
    expect(text).not.toContain("'II' (II)")
  })
})

describe("coded request fields", () => {
  const cases: [schema: string, property: string, options: readonly CodeOption[]][] = [
    ["CreateFertilizerApplication", "p_app_method", APPLICATION_METHODS],
    ["UpdateFertilizerApplication", "p_app_method", APPLICATION_METHODS],
    ["CreateField", "b_acquiring_method", ACQUIRING_METHODS],
    ["UpdateField", "b_acquiring_method", ACQUIRING_METHODS],
    ["CreateSoilAnalysis", "a_source", SELECTABLE_SOIL_ANALYSIS_SOURCES],
    ["CreateSoilAnalysis", "b_soiltype_agr", SOIL_TYPES],
    ["CreateSoilAnalysis", "b_gwl_class", GROUNDWATER_CLASSES],
  ]

  it.each(cases)(
    "%s.%s accepts exactly the codes and names each of them",
    async (name, property, options) => {
      const schema = (await components())[name]?.properties?.[property]
      expect(schema, `${name}.${property}`).toBeDefined()
      const text = JSON.stringify(schema)
      for (const { value, label } of options) {
        expect(text).toContain(`"${value}"`)
        if (label !== value) expect(schema.description).toContain(label)
      }
    },
  )

  it("does not let a client choose a source that only the system records", () => {
    expect(SELECTABLE_SOIL_ANALYSIS_SOURCES.map((option) => option.value)).not.toContain(
      "nl-other-nmi",
    )
  })
})

describe("RVO fertilizer codes in the developer documentation", () => {
  it("lists every code of fdm-core with its Dutch name", () => {
    const docs = readFileSync(
      new URL("../../../fdm-docs/docs/rest-api/06-endpoints.md", import.meta.url),
      "utf8",
    )
    const rows = docs.split(/\r?\n/).filter((line) => line.startsWith("| `"))
    for (const { value, label } of fdmSchema.typeRvoOptions) {
      const row = rows.find((line) => line.startsWith(`| \`${value}\` `))
      expect(row, value).toBeDefined()
      expect(row, value).toContain(` ${label} `)
    }
  })
})
