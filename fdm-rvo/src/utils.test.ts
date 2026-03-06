import { describe, it, expect } from "vitest"
import { getItemId } from "./utils"
import { RvoImportReviewStatus } from "./types"

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

    it("should return 'unknown' if neither present", () => {
        const item = {
            status: RvoImportReviewStatus.NEW_REMOTE,
            diffs: [],
        } as any
        expect(getItemId(item)).toBe("unknown")
    })
})
