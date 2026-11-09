import type { FdmType, Field, Timeframe } from "@nmi-agro/fdm-core"
import { startOfDayInFdmTimeZone, toFdmDateString } from "@nmi-agro/fdm-core"
import { describe, expect, it, vi } from "vitest"
import type { NL2026NormsFillingInput } from "./nl/2026/filling/types"
import type { NL2026NormsInput, NL2026NormsInputForCultivation } from "./nl/2026/value/types"
import {
  createFunctionsForFertilizerApplicationFilling,
  createFunctionsForNorms,
  createUncachedFunctionsForFertilizerApplicationFilling,
} from "./index"
import { calculateNL2026FosfaatGebruiksNorm } from "./nl/2026/value/fosfaatgebruiksnorm"
import {
  collectFillingInputForYear,
  createFunctionsForFertilizerApplicationFillingForYear,
  createFunctionsForNormsForYear,
  createProvisionalNormsFunctions,
  createProvisionalUncachedFillingFunctions,
  createUncachedFunctionsForFertilizerApplicationFillingForYear,
  type NormsYearFdmCoreOperations,
  resolveNormsYear,
  shiftDateByYears,
  shiftFillingInput,
  shiftNormsInput,
} from "./years"

// Synthetic fixtures only.
/** Start of a calendar day in Europe/Amsterdam. */
const day = (year: number, month: number, d: number) => startOfDayInFdmTimeZone(year, month, d)

const fdm = {} as FdmType

/** A norms input for grassland sown in March of a year, with one harvest in June. */
function grasslandInput(year: number): NL2026NormsInput {
  return {
    farm: { has_grazing_intention: false },
    field: { b_id: "f1", b_centroid: [5.0, 52.0], b_bufferstrip: false },
    cultivations: [
      {
        b_lu: "lu1",
        b_lu_catalogue: "nl_265",
        b_lu_start: day(year, 3, 1),
        b_lu_end: day(year, 10, 31),
        b_lu_variety: null,
        harvests: [{ b_lu_harvest_date: day(year, 6, 1) }],
      } as NL2026NormsInputForCultivation,
    ],
    soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
  }
}

/** Fake fdm-core operations that record the timeframes and years they are called with. */
function recordingOperations() {
  const calls: { name: string; timeframe?: Timeframe; year?: number; date?: Date }[] = []
  const field = { b_id: "f1", b_id_farm: "farm1", b_centroid: [5.0, 52.0] } as unknown as Field
  const operations = {
    getField: vi.fn(async () => field),
    getFields: vi.fn(async (_f: FdmType, _p: string, _farm: string, timeframe?: Timeframe) => {
      calls.push({ name: "getFields", timeframe })
      return [field]
    }),
    getCultivations: vi.fn(async (_f: FdmType, _p: string, _b: string, timeframe?: Timeframe) => {
      calls.push({ name: "getCultivations", timeframe })
      return []
    }),
    getCultivationsForFarm: vi.fn(
      async (_f: FdmType, _p: string, _farm: string, timeframe?: Timeframe) => {
        calls.push({ name: "getCultivationsForFarm", timeframe })
        return new Map()
      },
    ),
    getCurrentSoilData: vi.fn(
      async (_f: FdmType, _p: string, _b: string, timeframe?: Timeframe) => {
        calls.push({ name: "getCurrentSoilData", timeframe })
        return []
      },
    ),
    getCurrentSoilDataForFarm: vi.fn(
      async (_f: FdmType, _p: string, _farm: string, timeframe?: Timeframe) => {
        calls.push({ name: "getCurrentSoilDataForFarm", timeframe })
        return new Map()
      },
    ),
    getGrazingIntention: vi.fn(async (_f: FdmType, _p: string, _farm: string, year: number) => {
      calls.push({ name: "getGrazingIntention", year })
      return true
    }),
    getHarvests: vi.fn(async (_f: FdmType, _p: string, _b: string, timeframe?: Timeframe) => {
      calls.push({ name: "getHarvests", timeframe })
      return []
    }),
    getHarvestsForFarm: vi.fn(
      async (_f: FdmType, _p: string, _farm: string, timeframe?: Timeframe) => {
        calls.push({ name: "getHarvestsForFarm", timeframe })
        return new Map()
      },
    ),
    getFertilizerApplications: vi.fn(
      async (_f: FdmType, _p: string, _b: string, timeframe?: Timeframe) => {
        calls.push({ name: "getFertilizerApplications", timeframe })
        return []
      },
    ),
    getFertilizerApplicationsForFarm: vi.fn(async () => new Map()),
    getFertilizers: vi.fn(async () => []),
    isOrganicCertificationValid: vi.fn(
      async (_f: FdmType, _p: string, _farm: string, date: Date) => {
        calls.push({ name: "isOrganicCertificationValid", date })
        return false
      },
    ),
  } as unknown as NormsYearFdmCoreOperations
  return { operations, calls }
}

describe("resolveNormsYear", () => {
  it("uses the own norms of a supported year", () => {
    expect(resolveNormsYear("NL", 2025)).toEqual({
      targetYear: 2025,
      normsYear: "2025",
      provisional: false,
    })
    expect(resolveNormsYear("NL", 2026)).toEqual({
      targetYear: 2026,
      normsYear: "2026",
      provisional: false,
    })
  })

  it("uses the newest norms provisionally for later years", () => {
    expect(resolveNormsYear("NL", 2027)).toEqual({
      targetYear: 2027,
      normsYear: "2026",
      provisional: true,
    })
    expect(resolveNormsYear("NL", 2030).normsYear).toBe("2026")
  })

  it("rejects years before the first norm year and invalid years", () => {
    expect(() => resolveNormsYear("NL", 2024)).toThrow("Year not supported")
    expect(() => resolveNormsYear("NL", 2026.5)).toThrow()
    expect(() => resolveNormsYear("XX" as "NL", 2026)).toThrow("Region not supported")
  })
})

describe("factories for a supported year", () => {
  it("return the functions of the norm year unchanged", () => {
    const norms = createFunctionsForNormsForYear("NL", 2026)
    const base = createFunctionsForNorms("NL", "2026")
    expect(norms.provisional).toBe(false)
    expect(norms.calculateNormForNitrogen).toBe(base.calculateNormForNitrogen)
    expect(norms.collectInputForNorms).toBe(base.collectInputForNorms)

    const filling = createFunctionsForFertilizerApplicationFillingForYear("NL", 2025)
    expect(filling.normsYear).toBe("2025")
    expect(filling.calculateFertilizerApplicationFillingForManure).toBe(
      createFunctionsForFertilizerApplicationFilling("NL", "2025")
        .calculateFertilizerApplicationFillingForManure,
    )

    const uncached = createUncachedFunctionsForFertilizerApplicationFillingForYear("NL", 2026)
    expect(uncached.calculateFertilizerApplicationFillingForPhosphate).toBe(
      createUncachedFunctionsForFertilizerApplicationFilling("NL", "2026")
        .calculateFertilizerApplicationFillingForPhosphate,
    )
  })

  it("return provisional functions for a later year", () => {
    const norms = createFunctionsForNormsForYear("NL", 2027)
    expect(norms).toMatchObject({ targetYear: 2027, normsYear: "2026", provisional: true })
    expect("calculateNormForRenure" in norms).toBe(true)
    const filling = createFunctionsForFertilizerApplicationFillingForYear("NL", 2027)
    expect(filling.provisional).toBe(true)
    expect("calculateFertilizerApplicationFillingForRenure" in filling).toBe(true)
  })
})

describe("date shifting", () => {
  it("moves dates by whole years in Europe/Amsterdam", () => {
    expect(shiftDateByYears(day(2027, 5, 15), -1).getTime()).toBe(day(2026, 5, 15).getTime())
    expect(shiftDateByYears(day(2028, 2, 29), -2).getTime()).toBe(day(2026, 2, 28).getTime())
    expect(shiftDateByYears(null, -1)).toBeNull()
    expect(shiftDateByYears(undefined, -1)).toBeUndefined()
  })

  it("moves the cultivation and harvest dates of a norms input", () => {
    expect(shiftNormsInput(grasslandInput(2027), -1)).toEqual(grasslandInput(2026))
  })

  it("moves the cultivation and application dates of a filling input", () => {
    const input = {
      cultivations: [{ b_lu: "lu1", b_lu_start: day(2027, 3, 1), b_lu_end: null }],
      applications: [{ p_app_id: "a1", p_app_date: day(2027, 9, 15) }],
      fertilizers: [],
      has_organic_certification: false,
      has_grazing_intention: false,
      fosfaatgebruiksnorm: 75,
      b_centroid: [5.0, 52.0],
    } as unknown as NL2026NormsFillingInput
    const shifted = shiftFillingInput(input, -1)
    expect(shifted.cultivations[0].b_lu_start?.getTime()).toBe(day(2026, 3, 1).getTime())
    expect(shifted.cultivations[0].b_lu_end).toBeNull()
    expect(shifted.applications[0].p_app_date.getTime()).toBe(day(2026, 9, 15).getTime())
    // The original input is not changed
    expect(input.applications[0].p_app_date.getTime()).toBe(day(2027, 9, 15).getTime())
  })
})

describe("provisional norm functions", () => {
  const resolution = resolveNormsYear("NL", 2027)

  it("apply the rules of the norm year to the plan of the target year", async () => {
    const base = {
      ...createFunctionsForNorms("NL", "2026"),
      calculateNormForPhosphate: (_fdm: FdmType, input: NL2026NormsInput) =>
        calculateNL2026FosfaatGebruiksNorm(input),
    } as unknown as ReturnType<typeof createFunctionsForNorms<"2026">>
    const provisional = createProvisionalNormsFunctions(base, resolution)

    // Without moving the dates, the 2026 rules find no main cultivation in 2027 data
    const unshifted = await calculateNL2026FosfaatGebruiksNorm(grasslandInput(2027))
    expect(unshifted.normSource).toContain("Bouwland")

    const result = await provisional.calculateNormForPhosphate(fdm, grasslandInput(2027))
    expect(result).toEqual(await calculateNL2026FosfaatGebruiksNorm(grasslandInput(2026)))
    expect(result.normSource).toContain("Grasland")
  })

  it("collect the data of the target year", async () => {
    const { operations, calls } = recordingOperations()
    const provisional = createProvisionalNormsFunctions(
      createFunctionsForNorms("NL", "2026"),
      resolution,
      operations,
    )
    const input = await provisional.collectInputForNorms(fdm, "p1", "f1")
    expect(input.farm.has_grazing_intention).toBe(true)
    expect(calls.find((c) => c.name === "getGrazingIntention")?.year).toBe(2027)
    const cultivations = calls.find((c) => c.name === "getCultivations")?.timeframe
    expect(cultivations?.start?.getFullYear()).toBe(2026)
    expect(cultivations?.end?.getFullYear()).toBe(2027)
    const soil = calls.find((c) => c.name === "getCurrentSoilData")?.timeframe
    expect(soil?.start?.getFullYear()).toBe(2027)

    calls.length = 0
    await provisional.collectInputForNormsForFarm(fdm, "p1", "farm1")
    expect(calls.find((c) => c.name === "getGrazingIntention")?.year).toBe(2027)
    expect(
      calls.find((c) => c.name === "getHarvestsForFarm")?.timeframe?.start?.getFullYear(),
    ).toBe(2027)
  })
})

describe("provisional filling functions", () => {
  const resolution = resolveNormsYear("NL", 2027)

  it("collect the data of the target year", async () => {
    const { operations, calls } = recordingOperations()
    const input = await collectFillingInputForYear(fdm, "p1", "f1", 75, 2027, operations)
    expect(input.fosfaatgebruiksnorm).toBe(75)
    expect(input.has_grazing_intention).toBe(true)
    expect(calls.find((c) => c.name === "getGrazingIntention")?.year).toBe(2027)
    expect(calls.find((c) => c.name === "isOrganicCertificationValid")?.date?.getFullYear()).toBe(
      2027,
    )
    const applications = calls.find((c) => c.name === "getFertilizerApplications")?.timeframe
    expect(applications?.start?.getTime()).toBe(day(2027, 1, 1).getTime())
    expect(applications?.end?.getTime()).toBe(day(2028, 1, 1).getTime() - 1)
    expect(applications?.end && toFdmDateString(applications.end)).toBe("2027-12-31")
  })

  it("move the input to the norm year before calculating", () => {
    const manure = vi.fn((_input: NL2026NormsFillingInput) => ({
      normFilling: 1,
      applicationFilling: [],
    }))
    const base = {
      ...createUncachedFunctionsForFertilizerApplicationFilling("NL", "2026"),
      calculateFertilizerApplicationFillingForManure: manure,
    } as unknown as ReturnType<
      typeof createUncachedFunctionsForFertilizerApplicationFilling<"2026">
    >
    const provisional = createProvisionalUncachedFillingFunctions(base, resolution)
    const input = {
      cultivations: [],
      applications: [{ p_app_id: "a1", p_app_date: day(2027, 3, 1) }],
      fertilizers: [],
      has_organic_certification: false,
      has_grazing_intention: false,
      fosfaatgebruiksnorm: 75,
      b_centroid: [5.0, 52.0],
    } as unknown as NL2026NormsFillingInput
    provisional.calculateFertilizerApplicationFillingForManure(input)
    const passed = manure.mock.calls[0][0]
    expect(passed.applications[0].p_app_date.getTime()).toBe(day(2026, 3, 1).getTime())
  })
})
