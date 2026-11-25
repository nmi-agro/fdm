import type { FdmType } from "@nmi-agro/fdm-core"
import { describe, expect, it, vi } from "vitest"

const nitrogen = vi.hoisted(() => ({
  calculateNitrogenBalanceForFarms: vi.fn(),
  calculateNitrogenBalancesFieldToFarm: vi.fn(),
}))
const nitrogenInput = vi.hoisted(() => ({ collectInputForNitrogenBalanceForFarms: vi.fn() }))
const organicMatter = vi.hoisted(() => ({
  calculateOrganicMatterBalanceForFarms: vi.fn(),
  calculateOrganicMatterBalancesFieldToFarm: vi.fn(),
}))
const organicMatterInput = vi.hoisted(() => ({
  collectInputForOrganicMatterBalanceForFarms: vi.fn(),
}))
const phosphate = vi.hoisted(() => ({
  calculatePhosphateBalanceForFarms: vi.fn(),
  calculatePhosphateBalancesFieldToFarm: vi.fn(),
}))
const phosphateInput = vi.hoisted(() => ({ collectInputForPhosphateBalanceForFarms: vi.fn() }))

vi.mock("./nitrogen", () => nitrogen)
vi.mock("./nitrogen/input", () => nitrogenInput)
vi.mock("./organic-matter", () => organicMatter)
vi.mock("./organic-matter/input", () => organicMatterInput)
vi.mock("./phosphate", () => phosphate)
vi.mock("./phosphate/input", () => phosphateInput)

const { getNitrogenBalanceForFarms, getOrganicMatterBalanceForFarms, getPhosphateBalanceForFarms } =
  await import("./farms")

const fdm = {} as FdmType
const timeframe = { start: new Date("2025-01-01"), end: new Date("2025-12-31") }

describe("getNitrogenBalanceForFarms", () => {
  it("returns the combined balance and one balance per farm", async () => {
    nitrogenInput.collectInputForNitrogenBalanceForFarms.mockResolvedValue([
      { b_id_farm: "farm-a", fields: [{ field: { b_id: "f1" } }, { field: { b_id: "f2" } }] },
      { b_id_farm: "farm-b", fields: [{ field: { b_id: "f3" } }] },
      { b_id_farm: "farm-c", fields: [] },
    ])
    const fields = [
      { b_id: "f1", balance: {} },
      { b_id: "f2", errorMessage: "Missing soil data" },
      { b_id: "f3", balance: {} },
    ]
    nitrogen.calculateNitrogenBalanceForFarms.mockResolvedValue({ balance: 10, fields })
    nitrogen.calculateNitrogenBalancesFieldToFarm.mockImplementation(
      (farmFields: { b_id: string }[], hasErrors: boolean, messages: string[]) => ({
        fieldIds: farmFields.map((field) => field.b_id),
        hasErrors,
        messages,
      }),
    )

    const result = await getNitrogenBalanceForFarms(
      fdm,
      "p1",
      ["farm-a", "farm-b", "farm-c"],
      timeframe,
    )

    expect(result.total).toEqual({ balance: 10, fields })
    expect(result.farms).toEqual([
      {
        b_id_farm: "farm-a",
        balance: { fieldIds: ["f1", "f2"], hasErrors: true, messages: ["Missing soil data"] },
      },
      { b_id_farm: "farm-b", balance: { fieldIds: ["f3"], hasErrors: false, messages: [] } },
      { b_id_farm: "farm-c", errorMessage: "No fields in input" },
    ])
  })
})

describe("getOrganicMatterBalanceForFarms", () => {
  it("splits the balance per farm, skips unknown fields and reports a failing farm", async () => {
    organicMatterInput.collectInputForOrganicMatterBalanceForFarms.mockResolvedValue([
      { b_id_farm: "farm-a", fields: [{ field: { b_id: "f1" } }] },
      { b_id_farm: "farm-b", fields: [{ field: { b_id: "f2" } }] },
    ])
    organicMatter.calculateOrganicMatterBalanceForFarms.mockResolvedValue({
      balance: 1,
      fields: [{ b_id: "f1" }, { b_id: "f2" }, { b_id: "unknown" }],
    })
    organicMatter.calculateOrganicMatterBalancesFieldToFarm.mockImplementation(
      (farmFields: { b_id: string }[]) => {
        if (farmFields[0]?.b_id === "f2") throw new Error("aggregation failed")
        if (farmFields[0]?.b_id === "f1") throw "not an error"
        return {}
      },
    )

    const result = await getOrganicMatterBalanceForFarms(fdm, "p1", ["farm-a", "farm-b"], timeframe)

    expect(result.farms).toEqual([
      { b_id_farm: "farm-a", errorMessage: "not an error" },
      { b_id_farm: "farm-b", errorMessage: "aggregation failed" },
    ])
  })
})

describe("getPhosphateBalanceForFarms", () => {
  it("passes the options to the input collection and splits the balance per farm", async () => {
    phosphateInput.collectInputForPhosphateBalanceForFarms.mockResolvedValue([
      { b_id_farm: "farm-a", fields: [{ field: { b_id: "f1" } }] },
      { b_id_farm: "farm-b", fields: [{ field: { b_id: "f2" } }] },
    ])
    const fields = [
      { b_id: "f1", balance: {} },
      { b_id: "f2", exclusion: "bufferstrip" },
    ]
    phosphate.calculatePhosphateBalanceForFarms.mockResolvedValue({ balance: 5, fields })
    phosphate.calculatePhosphateBalancesFieldToFarm.mockImplementation(
      (farmFields: { b_id: string }[], hasErrors: boolean) => ({
        fieldIds: farmFields.map((field) => field.b_id),
        hasErrors,
      }),
    )

    const result = await getPhosphateBalanceForFarms(fdm, "p1", ["farm-a", "farm-b"], timeframe, {
      nmiApiKey: "key",
    })

    expect(phosphateInput.collectInputForPhosphateBalanceForFarms).toHaveBeenCalledWith(
      fdm,
      "p1",
      ["farm-a", "farm-b"],
      timeframe,
      { nmiApiKey: "key" },
    )
    expect(result.total).toEqual({ balance: 5, fields })
    expect(result.farms).toEqual([
      { b_id_farm: "farm-a", balance: { fieldIds: ["f1"], hasErrors: false } },
      { b_id_farm: "farm-b", balance: { fieldIds: ["f2"], hasErrors: false } },
    ])
  })
})
