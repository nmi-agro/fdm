import type { Field } from "@nmi-agro/fdm-core"
import { describe, expect, it } from "vitest"
import {
  getAllowedImportActions,
  getReviewHash,
  ImportChoiceError,
  resolveImportChoices,
} from "./review"
import { type RvoField, type RvoImportReviewItem, RvoImportReviewStatus } from "./types"

const year = 2026

const square = {
  type: "Polygon" as const,
  coordinates: [
    [
      [5.0, 52.0],
      [5.001, 52.0],
      [5.001, 52.001],
      [5.0, 52.001],
      [5.0, 52.0],
    ],
  ],
}
const otherSquare = {
  type: "Polygon" as const,
  coordinates: [
    [
      [5.0, 52.0],
      [5.002, 52.0],
      [5.002, 52.002],
      [5.0, 52.002],
      [5.0, 52.0],
    ],
  ],
}

function rvoField(id: string, overrides: Partial<RvoField["properties"]> = {}): RvoField {
  return {
    type: "Feature",
    geometry: otherSquare,
    properties: {
      CropFieldID: id,
      CropFieldVersion: "1",
      CropFieldDesignator: "Remote name",
      BeginDate: "2026-01-01",
      Country: "NL",
      CropTypeCode: "265",
      UseTitleCode: "02",
      mestData: { IndBufferstrook: "N" },
      ...overrides,
    },
  }
}

function localField(b_id: string): Field {
  return {
    b_id,
    b_name: "Local name",
    b_id_farm: "farm-1",
    b_id_source: "rvo-old",
    b_geometry: square,
    b_centroid: [5.0005, 52.0005],
    b_area: 0.8,
    b_perimeter: 300,
    b_start: new Date("2020-01-01"),
    b_end: null,
    b_acquiring_method: "nl_01",
    b_bufferstrip: false,
  } as unknown as Field
}

const newRemote: RvoImportReviewItem<Field> = {
  status: RvoImportReviewStatus.NEW_REMOTE,
  rvoField: rvoField("rvo-1"),
  diffs: [],
}

const conflict: RvoImportReviewItem<Field> = {
  status: RvoImportReviewStatus.CONFLICT,
  localField: localField("b1"),
  rvoField: rvoField("rvo-old"),
  localCultivation: { b_lu: "lu-1", b_lu_catalogue: "nl_2014" },
  diffs: ["b_name", "b_geometry"],
}

const expired: RvoImportReviewItem<Field> = {
  status: RvoImportReviewStatus.EXPIRED_LOCAL,
  localField: localField("b2"),
  diffs: [],
}

const newLocal: RvoImportReviewItem<Field> = {
  status: RvoImportReviewStatus.NEW_LOCAL,
  localField: localField("b3"),
  diffs: [],
}

const items = [newRemote, conflict, expired, newLocal]

describe("getAllowedImportActions", () => {
  it("lists the actions per status", () => {
    expect(getAllowedImportActions(RvoImportReviewStatus.NEW_REMOTE)).toEqual([
      "ADD_REMOTE",
      "IGNORE",
    ])
    expect(getAllowedImportActions(RvoImportReviewStatus.EXPIRED_LOCAL)).toContain("CLOSE_LOCAL")
    expect(getAllowedImportActions(RvoImportReviewStatus.NEW_LOCAL)).toContain("REMOVE_LOCAL")
  })
})

describe("getReviewHash", () => {
  it("does not depend on the order of items or diffs", () => {
    const reordered = [
      newLocal,
      expired,
      { ...conflict, diffs: ["b_geometry", "b_name"] },
      newRemote,
    ]
    expect(getReviewHash(reordered as RvoImportReviewItem<Field>[])).toBe(getReviewHash(items))
  })

  it("changes when a status or diff changes", () => {
    const changed = [newRemote, { ...conflict, diffs: ["b_name"] }, expired, newLocal]
    expect(getReviewHash(changed as RvoImportReviewItem<Field>[])).not.toBe(getReviewHash(items))
  })
})

describe("resolveImportChoices", () => {
  it("adds a new field with the remote values", () => {
    const plan = resolveImportChoices(items, { "rvo-1": { action: "ADD_REMOTE" } }, year)
    expect(plan.fieldsToAdd).toEqual([
      {
        b_name: "Remote name",
        b_id_source: "rvo-1",
        b_geometry: otherSquare,
        b_lu_catalogue: "nl_265",
        b_start: new Date("2026-01-01"),
        b_end: null,
        b_acquiring_method: "nl_02",
        b_bufferstrip: false,
      },
    ])
  })

  it("updates only the values that differ for UPDATE_FROM_REMOTE", () => {
    const plan = resolveImportChoices(items, { b1: { action: "UPDATE_FROM_REMOTE" } }, year)
    expect(plan.fieldsToUpdate).toEqual([
      {
        b_id: "b1",
        b_lu: "lu-1",
        b_name: "Remote name",
        b_geometry: otherSquare,
      },
    ])
  })

  it("closes an expired field on 31 December of the previous year", () => {
    const plan = resolveImportChoices(items, { b2: { action: "CLOSE_LOCAL" } }, year)
    expect(plan.fieldsToUpdate).toEqual([
      { b_id: "b2", b_lu: undefined, b_end: new Date(Date.UTC(2025, 11, 31)) },
    ])
  })

  it("removes a local field and leaves items without a choice alone", () => {
    const plan = resolveImportChoices(items, { b3: { action: "REMOVE_LOCAL" } }, year)
    expect(plan).toEqual({ fieldsToAdd: [], fieldsToUpdate: [], fieldsToRemove: ["b3"] })
  })

  it("changes nothing for KEEP_LOCAL without values", () => {
    const plan = resolveImportChoices(items, { b1: { action: "KEEP_LOCAL" } }, year)
    expect(plan.fieldsToUpdate).toEqual([])
  })

  describe("per-field values", () => {
    it.each([
      ["b_name", "Custom name"],
      ["b_start", new Date("2026-02-01")],
      ["b_end", new Date("2026-11-30")],
      ["b_acquiring_method", "nl_09"],
      ["b_bufferstrip", true],
      ["b_lu_catalogue", "nl_233"],
    ] as const)("overrides %s when adding a field", (key, value) => {
      const plan = resolveImportChoices(
        items,
        { "rvo-1": { action: "ADD_REMOTE", values: { [key]: value } } },
        year,
      )
      expect(plan.fieldsToAdd[0]?.[key]).toEqual(value)
    })

    it.each([
      ["b_name", "Custom name"],
      ["b_start", new Date("2019-06-01")],
      ["b_end", new Date("2026-11-30")],
      ["b_acquiring_method", "nl_09"],
      ["b_bufferstrip", true],
      ["b_lu_catalogue", "nl_233"],
      ["b_lu_catalogue", null],
    ] as const)("overrides %s on an existing field", (key, value) => {
      const plan = resolveImportChoices(
        items,
        { b1: { action: "KEEP_LOCAL", values: { [key]: value } } },
        year,
      )
      expect(plan.fieldsToUpdate).toEqual([{ b_id: "b1", b_lu: "lu-1", [key]: value }])
    })

    it("lets a client keep the local geometry while taking other remote values", () => {
      const plan = resolveImportChoices(
        items,
        { b1: { action: "UPDATE_FROM_REMOTE", values: { b_geometry: "local" } } },
        year,
      )
      expect(plan.fieldsToUpdate[0]).not.toHaveProperty("b_geometry")
      expect(plan.fieldsToUpdate[0]?.b_name).toBe("Remote name")
    })

    it("lets a client take the remote geometry while keeping local values", () => {
      const plan = resolveImportChoices(
        items,
        { b1: { action: "KEEP_LOCAL", values: { b_geometry: "remote" } } },
        year,
      )
      expect(plan.fieldsToUpdate).toEqual([{ b_id: "b1", b_lu: "lu-1", b_geometry: otherSquare }])
    })

    it("lets a client set another end date when closing a field", () => {
      const b_end = new Date("2026-03-31")
      const plan = resolveImportChoices(
        items,
        { b2: { action: "CLOSE_LOCAL", values: { b_end } } },
        year,
      )
      expect(plan.fieldsToUpdate).toEqual([{ b_id: "b2", b_lu: undefined, b_end }])
    })
  })

  describe("validation", () => {
    function issuesOf(fn: () => unknown) {
      try {
        fn()
      } catch (error) {
        if (error instanceof ImportChoiceError) return error.issues
        throw error
      }
      throw new Error("Expected an ImportChoiceError")
    }

    it("rejects an unknown item", () => {
      expect(
        issuesOf(() => resolveImportChoices(items, { nope: { action: "IGNORE" } }, year)),
      ).toEqual([expect.objectContaining({ item_id: "nope", code: "unknown_item" })])
    })

    it("rejects an action that does not fit the status", () => {
      expect(
        issuesOf(() => resolveImportChoices(items, { b3: { action: "UPDATE_FROM_REMOTE" } }, year)),
      ).toEqual([expect.objectContaining({ item_id: "b3", code: "action_not_allowed" })])
    })

    it("rejects an empty name and an end date before the start date", () => {
      const issues = issuesOf(() =>
        resolveImportChoices(
          items,
          {
            "rvo-1": { action: "ADD_REMOTE", values: { b_name: " " } },
            b1: { action: "KEEP_LOCAL", values: { b_end: new Date("2010-01-01") } },
          },
          year,
        ),
      )
      expect(issues.map((i) => [i.item_id, i.code])).toEqual([
        ["rvo-1", "invalid_value"],
        ["b1", "invalid_value"],
      ])
    })
  })
})

describe("compareShapefileFields", () => {
  it("keeps the local buffer strip and does not report it as a difference", async () => {
    const { compareShapefileFields } = await import("./review")
    const local = {
      ...localField("b1"),
      b_bufferstrip: true,
      b_id_source: "rvo-9",
      cultivations: [],
    }
    const remote = rvoField("rvo-9", {
      CropFieldDesignator: "Local name",
      BeginDate: "2020-01-01",
      UseTitleCode: "01",
    })
    remote.geometry = square

    const [item] = compareShapefileFields([local], [remote], year)

    expect(item?.diffs).not.toContain("b_bufferstrip")
    expect(item?.rvoField?.properties.mestData?.IndBufferstrook).toBe("J")
  })

  it("estimates the buffer strip of a new shapefile field", async () => {
    const { compareShapefileFields } = await import("./review")
    const remote = rvoField("rvo-10", { CropFieldDesignator: "Bufferstrook langs sloot" })
    const [item] = compareShapefileFields([], [remote], year)
    expect(item?.status).toBe(RvoImportReviewStatus.NEW_REMOTE)
    expect(["J", "N"]).toContain(item?.rvoField?.properties.mestData?.IndBufferstrook)
  })
})
