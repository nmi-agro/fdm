import type { FdmType, PrincipalId } from "@nmi-agro/fdm-core"
import * as fdmCore from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { collectInputForPhosphateBalance, collectInputForPhosphateBalanceForFarms } from "./input"

vi.mock("@nmi-agro/fdm-core", async () => {
  const original = await vi.importActual("@nmi-agro/fdm-core")
  return {
    ...original,
    getField: vi.fn(),
    getFields: vi.fn(),
    getCultivations: vi.fn(),
    getCultivationsForFarm: vi.fn(),
    getHarvests: vi.fn(),
    getHarvestsForFarm: vi.fn(),
    getSoilAnalyses: vi.fn(),
    getSoilAnalysesForFarm: vi.fn(),
    getFertilizerApplications: vi.fn(),
    getFertilizerApplicationsForFarm: vi.fn(),
    getCultivationsFromCatalogue: vi.fn(),
    getFertilizersFromCatalogue: vi.fn(),
    getEnabledCultivationCataloguesForFarms: vi.fn(),
    getEnabledFertilizerCataloguesForFarms: vi.fn(),
    getCultivationsFromCatalogues: vi.fn(),
    getFertilizersFromCatalogues: vi.fn(),
  }
})

const fdm = { transaction: async (fn: (tx: FdmType) => unknown) => fn(fdm) } as unknown as FdmType
const principal = "user" as PrincipalId
const timeframe = { start: new Date("2025-01-01"), end: new Date("2025-12-31") }
const fields = [
  { b_id: "f1", b_area: 2, b_bufferstrip: false },
  { b_id: "f2", b_area: 3, b_bufferstrip: false },
]
const cultivation = (b_id: string, b_lu: string, b_lu_catalogue: string) => ({
  b_id,
  b_lu,
  b_lu_catalogue,
})

describe("collectInputForPhosphateBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fdmCore.getFields).mockResolvedValue(fields as never)
    vi.mocked(fdmCore.getCultivationsForFarm).mockResolvedValue(
      new Map([["f1", [cultivation("f1", "c1", "nl_265")]]]) as never,
    )
    vi.mocked(fdmCore.getHarvestsForFarm).mockResolvedValue(
      new Map([["c1", [{ b_id_harvesting: "h1", b_lu: "c1" }]]]) as never,
    )
    vi.mocked(fdmCore.getSoilAnalysesForFarm).mockResolvedValue(
      new Map([["f2", [{ a_id: "s1", a_p_al: 40 }]]]) as never,
    )
    vi.mocked(fdmCore.getFertilizerApplicationsForFarm).mockResolvedValue(
      new Map([["f1", [{ p_app_id: "a1", p_id_catalogue: "x" }]]]) as never,
    )
    vi.mocked(fdmCore.getCultivationsFromCatalogue).mockResolvedValue([] as never)
    vi.mocked(fdmCore.getFertilizersFromCatalogue).mockResolvedValue([] as never)
  })

  it("should use the farm-level queries for a whole farm and assemble the fields", async () => {
    const input = await collectInputForPhosphateBalance(fdm, principal, "farm", timeframe)
    expect(fdmCore.getCultivations).not.toHaveBeenCalled()
    expect(fdmCore.getHarvests).not.toHaveBeenCalled()
    // Soil analyses without the timeframe: the most recent ones describe the soil
    expect(fdmCore.getSoilAnalysesForFarm).toHaveBeenCalledWith(fdm, principal, "farm")
    expect(input.fields.map((f) => f.field.b_id)).toEqual(["f1", "f2"])
    expect(input.fields[0].harvests.map((h) => h.b_id_harvesting)).toEqual(["h1"])
    expect(input.fields[0].fertilizerApplications).toHaveLength(1)
    expect(input.fields[1].cultivations).toEqual([])
    expect(input.fields[1].soilAnalyses).toHaveLength(1)
    expect(input.timeFrame).toEqual(timeframe)
  })

  it("should use the per-field queries for one field", async () => {
    vi.mocked(fdmCore.getField).mockResolvedValue(fields[0] as never)
    vi.mocked(fdmCore.getCultivations).mockResolvedValue([
      cultivation("f1", "c1", "nl_265"),
    ] as never)
    vi.mocked(fdmCore.getHarvests).mockResolvedValue([{ b_id_harvesting: "h1" }] as never)
    vi.mocked(fdmCore.getSoilAnalyses).mockResolvedValue([] as never)
    vi.mocked(fdmCore.getFertilizerApplications).mockResolvedValue([] as never)
    const input = await collectInputForPhosphateBalance(fdm, principal, "farm", timeframe, "f1")
    expect(fdmCore.getFields).not.toHaveBeenCalled()
    expect(input.fields).toHaveLength(1)
    expect(input.fields[0].harvests).toHaveLength(1)
  })
})

describe("collectInputForPhosphateBalanceForFarms", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fdmCore.getFields).mockResolvedValue(fields as never)
    vi.mocked(fdmCore.getCultivationsForFarm).mockResolvedValue(
      new Map([["f1", [cultivation("f1", "c1", "nl_265")]]]) as never,
    )
    vi.mocked(fdmCore.getHarvestsForFarm).mockResolvedValue(new Map() as never)
    vi.mocked(fdmCore.getSoilAnalysesForFarm).mockResolvedValue(new Map() as never)
    vi.mocked(fdmCore.getFertilizerApplicationsForFarm).mockResolvedValue(new Map() as never)
    vi.mocked(fdmCore.getEnabledCultivationCataloguesForFarms).mockResolvedValue({
      farm1: ["brp"],
      farm2: ["brp"],
    } as never)
    vi.mocked(fdmCore.getEnabledFertilizerCataloguesForFarms).mockResolvedValue({
      farm1: [],
      farm2: [],
    } as never)
    vi.mocked(fdmCore.getCultivationsFromCatalogues).mockResolvedValue([
      { b_lu_catalogue: "nl_265", b_lu_source: "brp" },
      { b_lu_catalogue: "nl_256", b_lu_source: "brp" },
    ] as never)
    vi.mocked(fdmCore.getFertilizersFromCatalogues).mockResolvedValue([] as never)
  })

  it("should fetch the catalogues once and keep only the items each farm uses", async () => {
    const inputs = await collectInputForPhosphateBalanceForFarms(
      fdm,
      principal,
      ["farm1", "farm2", "farm1"],
      timeframe,
    )
    expect(fdmCore.getCultivationsFromCatalogues).toHaveBeenCalledTimes(1)
    expect(inputs.map((i) => i.b_id_farm)).toEqual(["farm1", "farm2"])
    expect(inputs[0].cultivationDetails.map((c) => c.b_lu_catalogue)).toEqual(["nl_265"])
  })

  it("should leave out a farm whose input cannot be collected", async () => {
    vi.mocked(fdmCore.getFields).mockImplementation((async (
      _fdm: unknown,
      _p: unknown,
      b_id_farm: string,
    ) => {
      if (b_id_farm === "farm2") throw new Error("no access")
      return fields
    }) as never)
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const inputs = await collectInputForPhosphateBalanceForFarms(
      fdm,
      principal,
      ["farm1", "farm2"],
      timeframe,
    )
    expect(inputs.map((i) => i.b_id_farm)).toEqual(["farm1"])
    spy.mockRestore()
  })
})
