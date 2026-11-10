/**
 * Tests for tools that cover several operations: the scope argument chooses the operation, and
 * REST and MCP return the same data for the same operation.
 */
import { createFdmApi } from "@nmi-agro/fdm-api"
import { describe, expect, it, vi } from "vitest"
import { baseServices, connect, makeApp, makeMockAuth, makeMockFdm } from "./helpers"

const cultivation = (b_lu: string, b_id: string) => ({
  b_lu,
  b_id,
  b_lu_catalogue: "nl_265",
  b_lu_source: "brp",
  b_lu_name: "Grasland, blijvend",
  b_lu_name_en: "Grassland, permanent",
  b_lu_hcat3: "nl_6794",
  b_lu_hcat3_name: "Grasland",
  b_lu_croprotation: "grass",
  b_lu_eom: 3000,
  b_lu_eom_residue: 0,
  b_lu_harvestable: "multiple",
  b_lu_variety: null,
  b_lu_start: new Date("2024-01-01T00:00:00Z"),
  b_lu_end: null,
  m_cropresidue: null,
  b_lu_harvest_date: null,
})

describe("scoped list tools", () => {
  it("runs the field operation for b_id and the farm operation for b_id_farm", async () => {
    const getCultivations = vi.fn().mockResolvedValue([cultivation("c-1", "field-1")])
    const getCultivationsForFarm = vi.fn().mockResolvedValue([cultivation("c-2", "field-2")])
    const { app } = makeApp({ getCultivations, getCultivationsForFarm } as never)
    const client = await connect(app)

    const forField = await client.callTool({
      name: "list_cultivations",
      arguments: { b_id: "field-1" },
    })
    expect(forField.isError, JSON.stringify(forField.content)).toBeFalsy()
    expect(getCultivations).toHaveBeenCalledWith(expect.anything(), "user-1", "field-1")

    const forFarm = await client.callTool({
      name: "list_cultivations",
      arguments: { b_id_farm: "farm-1" },
    })
    expect(forFarm.isError, JSON.stringify(forFarm.content)).toBeFalsy()
    expect(getCultivationsForFarm).toHaveBeenCalled()
    await client.close()
  })

  it("explains which argument is missing when no scope is given", async () => {
    const { app } = makeApp()
    const client = await connect(app)
    const result = await client.callTool({ name: "list_cultivations", arguments: {} })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain("`b_id`")
    expect(JSON.stringify(result.content)).toContain("`b_id_farm`")
    await client.close()
  })
})

describe("scoped tools", () => {
  it("validates the arguments of the chosen scope", async () => {
    const { app } = makeApp()
    const client = await connect(app)
    // A farm-level balance needs a period; the group-level one needs a year.
    const result = await client.callTool({
      name: "calculate_nitrogen_balance",
      arguments: { b_id_farm: "farm-1" },
    })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain("Invalid arguments for farm")
    await client.close()
  })

  it("chooses the organization scope before the farm filter", async () => {
    const getFarmIdsOfOrganization = vi.fn().mockResolvedValue(["farm-1"])
    const getFarmMeasureSummary = vi.fn().mockResolvedValue({
      b_id_farm: "farm-1",
      eligibleFields: [{ b_id: "field-1" }],
      measures: [
        {
          m_id: "m-1",
          m_name: "Bufferstrook",
          m_start: new Date("2026-03-01"),
          m_end: null,
          fieldCount: 1,
        },
      ],
      mainCultivations: [],
    })
    const { app } = makeApp({ getFarmIdsOfOrganization, getFarmMeasureSummary } as never)
    const client = await connect(app)
    const result = await client.callTool({
      name: "get_measure_summary",
      arguments: { organization_id: "org-1", year: "2026", b_id_farm: "farm-1" },
    })
    expect(result.isError, JSON.stringify(result.content)).toBeFalsy()
    expect((result.structuredContent as { scope: string }).scope).toBe("organization")
    expect(getFarmIdsOfOrganization).toHaveBeenCalledWith(expect.anything(), "user-1", "org-1")
    await client.close()
  })
})

describe("list_catalogues", () => {
  it("lists all catalogue sources without a farm", async () => {
    const { app } = makeApp()
    const client = await connect(app)
    const result = await client.callTool({ name: "list_catalogues", arguments: {} })
    expect(result.isError, JSON.stringify(result.content)).toBeFalsy()
    expect((result.structuredContent as { scope: string }).scope).toBe("available")
    await client.close()
  })

  it("lists the catalogues enabled on a farm", async () => {
    const { app } = makeApp({
      getEnabledCultivationCatalogues: vi.fn().mockResolvedValue(["brp"]),
      getEnabledFertilizerCatalogues: vi.fn().mockResolvedValue(["baat"]),
      getEnabledMeasureCatalogues: vi.fn().mockResolvedValue(["bln"]),
    } as never)
    const client = await connect(app)
    const result = await client.callTool({
      name: "list_catalogues",
      arguments: { b_id_farm: "farm-1" },
    })
    expect(result.isError, JSON.stringify(result.content)).toBeFalsy()
    expect(result.structuredContent).toEqual({
      scope: "enabled",
      result: { cultivation: ["brp"], fertilizer: ["baat"], measure: ["bln"] },
    })
    await client.close()
  })
})

describe("REST and MCP return the same data", () => {
  const farm = {
    b_id_farm: "farm-1",
    b_name_farm: "Proefbedrijf",
    b_businessid_farm: "12345678",
    b_address_farm: "Dorpsstraat 1",
    b_postalcode_farm: "1234 AB",
  }
  const field = {
    b_id: "field-1",
    b_name: "Perceel Noord",
    b_id_farm: "farm-1",
    b_id_source: null,
    b_geometry: null,
    b_centroid: [5.2, 52.1] as [number, number],
    b_area: 3.5,
    b_perimeter: 840.2,
    b_bufferstrip: false,
    b_start: new Date("2023-01-01T00:00:00Z"),
    b_end: null,
    b_acquiring_method: "unknown",
  }
  const services = {
    ...baseServices,
    getFarm: vi.fn().mockResolvedValue(farm),
    getFields: vi.fn().mockResolvedValue([field]),
  }

  async function rest(path: string) {
    const api = createFdmApi(
      makeMockFdm(),
      makeMockAuth(),
      { appName: "Test App", appUrl: "https://api.test.example" },
      services,
    )
    const res = await api.request(path, { headers: { "x-api-key": "key" } })
    expect(res.status).toBe(200)
    return res.json()
  }

  it("get_farm equals GET /farms/{b_id_farm}", async () => {
    const { app } = makeApp(services)
    const client = await connect(app)
    const viaMcp = await client.callTool({ name: "get_farm", arguments: { b_id_farm: "farm-1" } })
    expect(viaMcp.structuredContent).toEqual(await rest("/farms/farm-1"))
    await client.close()
  })

  it("list_fields equals GET /farms/{b_id_farm}/fields", async () => {
    const { app } = makeApp(services)
    const client = await connect(app)
    const viaMcp = await client.callTool({
      name: "list_fields",
      arguments: { b_id_farm: "farm-1" },
    })
    const viaRest = (await rest("/farms/farm-1/fields")) as { data: unknown[] }
    expect((viaMcp.structuredContent as { data: unknown[] }).data).toEqual(viaRest.data)
    await client.close()
  })
})
