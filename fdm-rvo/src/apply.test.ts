import {
  addCultivation,
  addField,
  getDefaultDatesOfCultivation,
  removeCultivation,
  removeField,
  updateField,
} from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { applyRvoImport, forEachAddedField, type RvoImportPlan } from "./apply"

vi.mock("@nmi-agro/fdm-core", () => ({
  addField: vi.fn(),
  updateField: vi.fn(),
  removeField: vi.fn(),
  addCultivation: vi.fn(),
  removeCultivation: vi.fn(),
  getDefaultDatesOfCultivation: vi.fn(),
  acquiringMethodOptions: [
    { value: "nl_01", label: "Eigendom" },
    { value: "unknown", label: "Onbekend" },
  ],
}))

const geometry = {
  type: "Polygon" as const,
  coordinates: [
    [
      [5, 52],
      [5.1, 52],
      [5, 52.1],
      [5, 52],
    ],
  ],
}
const mockFdm = {
  transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockFdm)),
} as never

function emptyPlan(): RvoImportPlan {
  return { fieldsToAdd: [], fieldsToUpdate: [], fieldsToRemove: [] }
}

describe("applyRvoImport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(addField).mockResolvedValue("new-1")
    vi.mocked(getDefaultDatesOfCultivation).mockResolvedValue({
      b_lu_start: new Date("2026-04-01"),
      b_lu_end: new Date("2026-09-30"),
    })
  })

  it("adds a field with its cultivation and reports it", async () => {
    const plan = emptyPlan()
    plan.fieldsToAdd.push({
      b_name: "A",
      b_id_source: "rvo-1",
      b_geometry: geometry,
      b_lu_catalogue: "nl_265",
      b_start: new Date("2026-01-01"),
      b_end: null,
      b_acquiring_method: "nl_01",
      b_bufferstrip: true,
    })
    const onFieldAdded = vi.fn()

    const result = await applyRvoImport(mockFdm, "p1", "farm-1", plan, 2026, { onFieldAdded })

    expect(addField).toHaveBeenCalledWith(
      mockFdm,
      "p1",
      "farm-1",
      "A",
      "rvo-1",
      geometry,
      new Date("2026-01-01"),
      "nl_01",
      null,
      true,
    )
    expect(addCultivation).toHaveBeenCalledWith(
      mockFdm,
      "p1",
      "nl_265",
      "new-1",
      new Date("2026-04-01"),
      new Date("2026-09-30"),
    )
    expect(onFieldAdded).toHaveBeenCalledWith(mockFdm, "new-1", geometry)
    expect(result.created).toEqual([{ b_id: "new-1", b_geometry: geometry }])
  })

  it("adds no cultivation when b_lu_catalogue is null", async () => {
    const plan = emptyPlan()
    plan.fieldsToAdd.push({
      b_name: "A",
      b_id_source: null,
      b_geometry: geometry,
      b_lu_catalogue: null,
      b_start: new Date("2026-01-01"),
      b_end: null,
      b_acquiring_method: "unknown",
      b_bufferstrip: false,
    })
    await applyRvoImport(mockFdm, "p1", "farm-1", plan, 2026)
    expect(addCultivation).not.toHaveBeenCalled()
  })

  it("replaces the cultivation of an updated field", async () => {
    const plan = emptyPlan()
    plan.fieldsToUpdate.push({ b_id: "b1", b_lu: "lu-1", b_lu_catalogue: "nl_233" })
    const result = await applyRvoImport(mockFdm, "p1", "farm-1", plan, 2026)

    expect(updateField).toHaveBeenCalled()
    expect(removeCultivation).toHaveBeenCalledWith(mockFdm, "p1", "lu-1")
    expect(addCultivation).toHaveBeenCalledWith(
      mockFdm,
      "p1",
      "nl_233",
      "b1",
      expect.any(Date),
      expect.any(Date),
    )
    expect(result.updated).toEqual(["b1"])
  })

  it("removes the cultivation when b_lu_catalogue is null", async () => {
    const plan = emptyPlan()
    plan.fieldsToUpdate.push({ b_id: "b1", b_lu: "lu-1", b_lu_catalogue: null })
    await applyRvoImport(mockFdm, "p1", "farm-1", plan, 2026)
    expect(removeCultivation).toHaveBeenCalledWith(mockFdm, "p1", "lu-1")
    expect(addCultivation).not.toHaveBeenCalled()
  })

  it("leaves the cultivation alone when b_lu_catalogue is absent", async () => {
    const plan = emptyPlan()
    plan.fieldsToUpdate.push({ b_id: "b1", b_lu: "lu-1", b_name: "New" })
    await applyRvoImport(mockFdm, "p1", "farm-1", plan, 2026)
    expect(removeCultivation).not.toHaveBeenCalled()
  })

  it("reports closed and removed fields", async () => {
    const plan = emptyPlan()
    plan.fieldsToUpdate.push({ b_id: "b1", b_end: new Date("2025-12-31") })
    plan.fieldsToRemove.push("b2")
    const result = await applyRvoImport(mockFdm, "p1", "farm-1", plan, 2026)
    expect(result.closed).toEqual(["b1"])
    expect(removeField).toHaveBeenCalledWith(mockFdm, "p1", "b2")
    expect(result.removed).toEqual(["b2"])
  })
})

describe("forEachAddedField", () => {
  it("runs the task per field and reports failures without stopping", async () => {
    const fields = ["a", "b", "c"].map((b_id) => ({ b_id, b_geometry: geometry }))
    const done: string[] = []
    const failed: string[] = []
    await forEachAddedField(
      fields,
      async (b_id) => {
        if (b_id === "b") throw new Error("boom")
        done.push(b_id)
      },
      (b_id) => failed.push(b_id),
      2,
    )
    expect(done.sort()).toEqual(["a", "c"])
    expect(failed).toEqual(["b"])
  })
})
