/**
 * Schema conformance against a real database. The MCP server validates every tool result against
 * its output schema, which the REST API never did. Mocked services return what a test author
 * expects; this test returns what fdm-core really returns.
 *
 * It builds a synthetic farm through the write tools, calls every read tool on it, and removes
 * the farm through the delete tools. Every call must succeed. NMI-backed tools need an NMI API
 * key and are left out, as are farm group and organization tools, which need an organization.
 *
 * Needs PostgreSQL with PostGIS, configured with POSTGRES_* in the environment.
 */
import { defaultServices } from "@nmi-agro/fdm-api"
import { createFdmServer, type FdmServerType, syncCatalogues } from "@nmi-agro/fdm-core"
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest"
import type { ToolContext } from "../tools/types"
import { callTool } from "../call-tool"
import { TOOLS } from "../tools"

const YEAR = 2025

/** A synthetic square field of about 3 ha; not a real parcel. */
const SQUARE = {
  type: "Polygon",
  coordinates: [
    [
      [5.66, 51.98],
      [5.6625, 51.98],
      [5.6625, 51.9817],
      [5.66, 51.9817],
      [5.66, 51.98],
    ],
  ],
}

let fdm: FdmServerType
let ctx: ToolContext
const tested = new Set<string>()

/** Calls a tool, fails the test with the message on an error, and returns the result. */
async function call<T = Record<string, unknown>>(name: string, args: Record<string, unknown>) {
  const tool = TOOLS.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Unknown tool ${name}`)
  const parsedArgs = tool.input.parse(args)
  const result = await callTool(tool, ctx, parsedArgs)
  expect(result.isError, `${name}: ${JSON.stringify(result.content)}`).toBeFalsy()
  tested.add(name)
  return result.structuredContent as T
}

beforeAll(async () => {
  fdm = createFdmServer(
    inject("host"),
    inject("port"),
    inject("user"),
    inject("password"),
    inject("database"),
  )
  await syncCatalogues(fdm)
  const userId = randomUUID()
  ctx = {
    fdm,
    services: {
      ...defaultServices,
      // No NMI calls in this test.
      getNmiApiKey: () => undefined,
    },
    principal: {
      userId,
      apiKeyId: `test-${randomUUID()}`,
      keyName: "conformance",
      channel: "mcp",
      effectivePrincipalId: userId,
    },
  }
})

afterAll(async () => {
  await fdm?.$client?.end?.()
})

describe("tool results match their output schemas on real data", () => {
  it("builds, reads and removes a farm through the tools", async () => {
    // --- Build ---
    const farm = await call<{ b_id_farm: string }>("create_farm", {
      b_name_farm: "Conformance test farm",
      b_businessid_farm: "00000000",
      b_address_farm: "Teststraat 1",
      b_postalcode_farm: "0000 AA",
    })
    const b_id_farm = farm.b_id_farm
    await call("update_farm", { b_id_farm, b_name_farm: "Conformance test farm (updated)" })

    const field = await call<{ b_id: string }>("create_field", {
      b_id_farm,
      b_name: "Test field",
      b_geometry: SQUARE,
      b_start: `${YEAR - 2}-01-01`,
      b_acquiring_method: "nl_01",
    })
    const b_id = field.b_id
    await call("update_field", { b_id, b_name: "Test field (updated)" })

    const crops = await call<{ data: { b_lu_catalogue: string }[] }>(
      "search_cultivation_catalogue",
      { b_id_farm, query: "tarwe" },
    )
    expect(crops.data.length).toBeGreaterThan(0)
    const cultivation = await call<{ b_lu: string }>("create_cultivation", {
      b_id,
      b_lu_catalogue: crops.data[0].b_lu_catalogue,
      b_lu_start: `${YEAR}-01-01`,
    })
    const b_lu = cultivation.b_lu
    await call("update_cultivation", { b_lu, b_lu_variety: null })

    const parameters = await call<{ parameters: string[]; defaults: Record<string, number> }>(
      "get_harvest_parameters",
      { b_lu },
    )
    const harvestValues = Object.fromEntries(
      parameters.parameters.map((code) => [code, parameters.defaults[code] ?? 1]),
    )
    const harvest = await call<{ b_id_harvesting: string }>("create_harvest", {
      b_lu,
      b_lu_harvest_date: `${YEAR}-08-01`,
      ...harvestValues,
    })
    await call("update_harvest", {
      b_id_harvesting: harvest.b_id_harvesting,
      b_lu_harvest_date: `${YEAR}-08-02`,
      ...harvestValues,
    })

    const fertilizers = await call<{ data: { p_id: string; p_app_amount_unit?: string }[] }>(
      "list_fertilizers",
      { b_id_farm },
    )
    expect(fertilizers.data.length).toBeGreaterThan(0)
    const catalogueFertilizers = await call<{ data: { p_id_catalogue: string }[] }>(
      "search_fertilizer_catalogue",
      { b_id_farm, query: "kas" },
    )
    if (catalogueFertilizers.data.length > 0) {
      const added = await call<{ p_id: string }>("create_fertilizer", {
        b_id_farm,
        p_id_catalogue: catalogueFertilizers.data[0].p_id_catalogue,
        p_acquiring_amount: 1000,
        p_acquiring_date: `${YEAR}-01-15`,
      })
      await call("delete_fertilizer", { p_id: added.p_id })
    }
    const custom = await call<{ p_id: string }>("create_custom_fertilizer", {
      b_id_farm,
      p_name_nl: "Eigen mest (test)",
      p_type: "manure",
      p_n_rt: 4,
      p_p_rt: 1.5,
      p_k_rt: 5,
      p_dm: 90,
    })
    await call("update_custom_fertilizer", { p_id: custom.p_id, p_n_rt: 4.2 })
    const application = await call<{ p_app_id: string }>("create_fertilizer_application", {
      b_id,
      p_id: fertilizers.data[0].p_id,
      p_app_amount_display: 100,
      p_app_method: "broadcasting",
      p_app_date: `${YEAR}-03-15`,
    })
    await call("update_fertilizer_application", {
      p_app_id: application.p_app_id,
      p_app_amount_display: 120,
    })

    const analysis = await call<{ a_id: string }>("create_soil_analysis", {
      b_id,
      a_date: `${YEAR}-01-20`,
      b_sampling_date: `${YEAR}-01-20`,
      a_source: "other",
      a_depth_lower: 30,
      a_som_loi: 3.5,
      a_ph_cc: 5.8,
      a_p_al: 45,
      a_clay_mi: 15,
      a_n_rt: 1500,
      a_cn_fr: 12,
      a_density_sa: 1.3,
      b_soiltype_agr: "dekzand",
      b_gwl_class: "II",
    })
    await call("update_soil_analysis", { a_id: analysis.a_id, a_ph_cc: 5.9 })

    const measures = await call<{ data: { m_id: string }[] }>("search_measure_catalogue", {
      b_id_farm,
    })
    let b_id_measure: string | undefined
    if (measures.data.length > 0) {
      const measure = await call<{ b_id_measure: string }>("create_measure", {
        b_id,
        m_id: measures.data[0].m_id,
        m_start: `${YEAR}-01-01`,
      })
      b_id_measure = measure.b_id_measure
      await call("update_measure", { b_id_measure, m_end: `${YEAR}-12-31` })
    }

    const certification = await call<{ b_id_organic: string }>("create_organic_certification", {
      b_id_farm,
      b_organic_issued: `${YEAR}-01-01`,
      b_organic_expires: `${YEAR + 1}-01-01`,
    })
    const derogation = await call<{ b_id_derogation: string }>("create_derogation", {
      b_id_farm,
      b_derogation_year: YEAR,
    })
    await call("set_grazing_intention", {
      b_id_farm,
      b_grazing_intention_year: YEAR,
      b_grazing_intention: true,
    })

    // --- Read ---
    await call("list_farms", {})
    await call("get_farm", { b_id_farm })
    await call("list_fields", { b_id_farm })
    await call("get_field", { b_id })
    for (const scope of [{ b_id }, { b_id_farm }]) {
      await call("list_cultivations", scope)
      await call("list_fertilizer_applications", scope)
      await call("list_soil_analyses", scope)
      await call("list_measures", scope)
      await call("get_current_soil_data", scope)
    }
    await call("get_current_soil_data", { b_id, per_zone: true })
    await call("list_harvests", { b_lu })
    await call("list_harvests", { b_id_farm })
    await call("list_organic_certifications", { b_id_farm })
    await call("list_derogations", { b_id_farm })
    await call("list_grazing_intentions", { b_id_farm })
    await call("list_catalogues", {})
    await call("list_catalogues", { b_id_farm })
    const period = { start: `${YEAR}-01-01`, end: `${YEAR}-12-31` }
    for (const scope of [{ b_id }, { b_id_farm }]) {
      await call("calculate_nitrogen_balance", { ...scope, ...period })
      await call("calculate_organic_matter_balance", { ...scope, ...period })
      await call("get_fertilization_norms", { ...scope, year: String(YEAR) })
    }
    await call("get_dose_for_field", { b_id })

    // --- Remove ---
    // Continue with another key, so the test stays within the write limit per key.
    ctx = { ...ctx, principal: { ...ctx.principal, apiKeyId: `test-${randomUUID()}` } }
    await call("delete_grazing_intention", { b_id_farm, b_grazing_intention_year: YEAR })
    await call("delete_derogation", { b_id_derogation: derogation.b_id_derogation })
    await call("delete_organic_certification", { b_id_organic: certification.b_id_organic })
    if (b_id_measure) await call("delete_measure", { b_id_measure })
    await call("delete_soil_analysis", { a_id: analysis.a_id })
    await call("delete_fertilizer_application", { p_app_id: application.p_app_id })
    await call("delete_fertilizer", { p_id: custom.p_id })
    await call("delete_harvest", { b_id_harvesting: harvest.b_id_harvesting })
    await call("delete_cultivation", { b_lu })
    await call("delete_field", { b_id })
    await call("delete_farm", { b_id_farm })
  })

  it("covers every tool except the NMI-backed and group or organization tools", () => {
    const skipped = new Set([
      // Need an NMI API key.
      "get_nutrient_advice",
      "get_indicators",
      "list_measure_options",
      // Need an organization.
      "list_farm_groups",
      "get_farm_group",
      "create_farm_group",
      "update_farm_group",
      "delete_farm_group",
      "add_farm_to_group",
      "remove_farm_from_group",
      "get_measure_summary",
    ])
    const untested = TOOLS.map((tool) => tool.name).filter(
      (name) => !tested.has(name) && !skipped.has(name),
    )
    expect(untested).toEqual([])
  })
})
