import type { FdmType } from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"

const factories = vi.hoisted(() => ({
  createFunctionsForNorms: vi.fn(),
  createFunctionsForFertilizerApplicationFilling: vi.fn(),
}))
vi.mock("./index", () => factories)

const { calculateNormFillingsForFields, calculateNormsForFields } = await import("./fields")

const fdm = {} as FdmType

/** A cached function mock whose `many` calls the single mock per input. */
function cached(fn: (input: { b_id: string }) => Promise<unknown>) {
  const single = vi.fn((_fdm: unknown, input: { b_id: string }) => fn(input))
  return Object.assign(single, {
    many: vi.fn((_fdm: unknown, inputs: { b_id: string }[]) =>
      inputs.map((input) => single(_fdm, input)),
    ),
  })
}

const norm = (normValue: number) => ({ normValue, normSource: "test" })

describe("calculateNormsForFields", () => {
  let functions: Record<string, ReturnType<typeof cached>>

  beforeEach(() => {
    vi.clearAllMocks()
    functions = {
      calculateNormForManure: cached(async () => norm(170)),
      calculateNormForPhosphate: cached(async (input) => {
        if (input.b_id === "no-soil") throw new Error("missing soil analysis data")
        return norm(75)
      }),
      calculateNormForNitrogen: cached(async (input) => {
        if (input.b_id === "no-soil") throw new Error("nitrogen failed too")
        return norm(200)
      }),
      calculateNormForRenure: cached(async () => norm(100)),
    }
    factories.createFunctionsForNorms.mockReturnValue(functions)
  })

  it("calculates the norms of all fields with one call per norm, in the order of the inputs", async () => {
    const results = await calculateNormsForFields(fdm, "NL", "2026", [
      { b_id: "f1" },
      undefined,
      { b_id: "f2" },
    ])

    expect(results).toEqual([
      {
        values: { manure: norm(170), phosphate: norm(75), nitrogen: norm(200), renure: norm(100) },
      },
      undefined,
      {
        values: { manure: norm(170), phosphate: norm(75), nitrogen: norm(200), renure: norm(100) },
      },
    ])
    for (const fn of Object.values(functions)) {
      expect(fn.many).toHaveBeenCalledTimes(1)
      expect(fn.many.mock.calls[0]?.[1]).toEqual([{ b_id: "f1" }, { b_id: "f2" }])
    }
    expect(factories.createFunctionsForNorms).toHaveBeenCalledWith("NL", "2026")
  })

  it("returns the first error in the order manure, phosphate, nitrogen, renure", async () => {
    const [result] = await calculateNormsForFields(fdm, "NL", "2026", [{ b_id: "no-soil" }])
    expect(result).toEqual({ error: new Error("missing soil analysis data") })
  })

  it("leaves out the renure norm for years without one", async () => {
    const { calculateNormForRenure: _renure, ...withoutRenure } = functions
    factories.createFunctionsForNorms.mockReturnValue(withoutRenure)

    const [result] = await calculateNormsForFields(fdm, "NL", "2025", [{ b_id: "f1" }])

    expect(result).toEqual({
      values: { manure: norm(170), phosphate: norm(75), nitrogen: norm(200), renure: undefined },
    })
  })
})

describe("calculateNormFillingsForFields", () => {
  it("calculates the fillings with the filling functions of the year", async () => {
    const filling = (normFilling: number) => ({ normFilling, applicationFilling: [] })
    const functions = {
      calculateFertilizerApplicationFillingForManure: cached(async () => filling(40)),
      calculateFertilizerApplicationFillingForPhosphate: cached(async () => filling(20)),
      calculateFertilizerApplicationFillingForNitrogen: cached(async () => filling(50)),
    }
    factories.createFunctionsForFertilizerApplicationFilling.mockReturnValue(functions)

    const results = await calculateNormFillingsForFields(fdm, "NL", "2025", [{ b_id: "f1" }])

    expect(results).toEqual([
      {
        values: {
          manure: filling(40),
          phosphate: filling(20),
          nitrogen: filling(50),
          renure: undefined,
        },
      },
    ])
    expect(factories.createFunctionsForFertilizerApplicationFilling).toHaveBeenCalledWith(
      "NL",
      "2025",
    )
  })

  it("returns no results for no inputs without calculating", async () => {
    const functions = {
      calculateFertilizerApplicationFillingForManure: cached(async () => null),
      calculateFertilizerApplicationFillingForPhosphate: cached(async () => null),
      calculateFertilizerApplicationFillingForNitrogen: cached(async () => null),
    }
    factories.createFunctionsForFertilizerApplicationFilling.mockReturnValue(functions)

    expect(await calculateNormFillingsForFields(fdm, "NL", "2026", [])).toEqual([])
    expect(functions.calculateFertilizerApplicationFillingForManure).not.toHaveBeenCalled()
  })
})
