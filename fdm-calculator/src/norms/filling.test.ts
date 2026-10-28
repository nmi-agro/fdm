import type { BaseFertilizerApplication, Cultivation, Fertilizer } from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NL2026NormsFillingInput } from "./nl/2026/filling/types"
import { createUncachedFunctionsForFertilizerApplicationFilling } from "."
import { calculateFertilizerApplicationFillingsWithRegion } from "./filling"
import { getRegion } from "./nl/2025/value/stikstofgebruiksnorm"

vi.mock("./nl/2025/value/stikstofgebruiksnorm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./nl/2025/value/stikstofgebruiksnorm")>()
  return { ...actual, getRegion: vi.fn(actual.getRegion) }
})

beforeEach(() => {
  vi.mocked(getRegion).mockResolvedValue("zand_nwc")
})

// Synthetic fixtures: a cattle slurry (RVO code 14) and a mineral fertilizer
const fertilizers = [
  {
    p_id: "slurry",
    p_id_catalogue: "cat-slurry",
    p_type_rvo: "14",
    p_n_rt: 4,
    p_p_rt: 1.5,
    p_type: "manure",
  },
  {
    p_id: "mineral",
    p_id_catalogue: "cat-mineral",
    p_type_rvo: "115",
    p_n_rt: 270,
    p_p_rt: 0,
    p_type: "mineral",
  },
] as unknown as Fertilizer[]

const cultivations = [
  {
    b_lu: "cult-1",
    b_lu_start: new Date("2025-01-01"),
    b_lu_end: null,
    b_lu_catalogue: "nl_265",
  },
] as unknown as Cultivation[]

function application(
  p_app_id: string,
  fertilizer: Fertilizer,
  p_app_amount: number,
  p_app_date: Date,
): BaseFertilizerApplication {
  return {
    p_app_id,
    p_id: fertilizer.p_id,
    p_id_catalogue: fertilizer.p_id_catalogue,
    p_name_nl: null,
    p_app_amount,
    p_app_method: "slotted coulter",
    p_app_date,
  }
}

function inputFor(year: number): NL2026NormsFillingInput {
  return {
    cultivations,
    fertilizers,
    applications: [
      application("app-1", fertilizers[0], 30000, new Date(`${year}-03-15`)),
      application("app-2", fertilizers[1], 200, new Date(`${year}-04-15`)),
    ],
    has_organic_certification: false,
    has_grazing_intention: false,
    fosfaatgebruiksnorm: 90,
    b_centroid: [5.6, 52.0],
  }
}

describe("calculateFertilizerApplicationFillingsWithRegion", () => {
  it.each(["2025", "2026"] as const)(
    "equals the uncached filling functions for %s",
    async (year) => {
      const input = inputFor(Number(year))
      const uncached = createUncachedFunctionsForFertilizerApplicationFilling("NL", year)

      const expected = {
        nitrogen: await uncached.calculateFertilizerApplicationFillingForNitrogen(input),
        manure: uncached.calculateFertilizerApplicationFillingForManure(input),
        phosphate: uncached.calculateFertilizerApplicationFillingForPhosphate(input),
        renure:
          "calculateFertilizerApplicationFillingForRenure" in uncached
            ? uncached.calculateFertilizerApplicationFillingForRenure(input)
            : undefined,
      }

      const result = calculateFertilizerApplicationFillingsWithRegion(year, input, "zand_nwc")
      expect(result).toEqual(expected)
      expect(result.nitrogen.normFilling).toBeGreaterThan(0)
      expect(result.renure !== undefined).toBe(year === "2026")
    },
  )

  it("uses the given region for the nitrogen filling", () => {
    const input = inputFor(2026)
    const sand = calculateFertilizerApplicationFillingsWithRegion("2026", input, "zand_nwc")
    const clay = calculateFertilizerApplicationFillingsWithRegion("2026", input, "klei")
    expect(sand.manure).toEqual(clay.manure)
    expect(sand.nitrogen.applicationFilling).toHaveLength(2)
    expect(clay.nitrogen.applicationFilling).toHaveLength(2)
  })

  it("throws for an unsupported year", () => {
    expect(() =>
      calculateFertilizerApplicationFillingsWithRegion("2024" as "2025", inputFor(2024), "klei"),
    ).toThrow("Year not supported")
  })
})
