import { describe, expect, it } from "vitest"
import type { FieldGeometry } from "@nmi-agro/fdm-core"
import { RvoImportReviewStatus } from "./types"
import { computeBbox, getItemId } from "./utils"

describe("getItemId", () => {
    it("should return local ID if present", () => {
        const item = {
            status: RvoImportReviewStatus.MATCH,
            localField: { b_id: "local-1" },
            diffs: [],
        } as any
        expect(getItemId(item)).toBe("local-1")
    })

    it("should return RVO ID if local not present", () => {
        const item = {
            status: RvoImportReviewStatus.NEW_REMOTE,
            rvoField: { properties: { CropFieldID: "rvo-1" } },
            diffs: [],
        } as any
        expect(getItemId(item)).toBe("rvo-1")
    })

    it("should return a deterministic composite when neither field is present", () => {
        const item = {
            status: RvoImportReviewStatus.NEW_REMOTE,
            diffs: [],
        } as any
        const id = getItemId(item)
        // Must be a non-empty string that starts with the status value
        expect(id).toContain(RvoImportReviewStatus.NEW_REMOTE)
        // Must not be "unknown" — no collisions across degenerate items
        expect(id).not.toBe("unknown")
    })
})

describe("computeBbox", () => {
    it("returns the bounding box of a Polygon geometry", () => {
        const polygon: FieldGeometry = {
            type: "Polygon",
            coordinates: [
                [
                    [0, 0],
                    [2, 0],
                    [2, 3],
                    [0, 3],
                    [0, 0],
                ],
            ],
        }
        expect(computeBbox(polygon)).toEqual([0, 0, 2, 3])
    })
})
