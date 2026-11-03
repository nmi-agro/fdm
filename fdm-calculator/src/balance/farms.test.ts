import type { FdmType } from "@nmi-agro/fdm-core"
import { describe, expect, it, vi } from "vitest"

const nitrogen = vi.hoisted(() => ({
  calculateNitrogenBalanceForFarms: vi.fn(),
  calculateNitrogenBalancesFieldToFarm: vi.fn(),
}))
const nitrogenInput = vi.hoisted(() => ({ collectInputForNitrogenBalanceForFarms: vi.fn() }))

vi.mock("./nitrogen", () => nitrogen)
vi.mock("./nitrogen/input", () => nitrogenInput)

const { getNitrogenBalanceForFarms } = await import("./farms")

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
