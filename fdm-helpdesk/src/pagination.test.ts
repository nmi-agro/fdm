import { describe, expect, test } from "vitest"
import { getPageOffsetAndLimit } from "./pagination"

describe("getPageOffsetAndLimit", () => {
    test("should use default offset 0 and limit 20 when no filters are provided", () => {
        const result = getPageOffsetAndLimit({})

        expect(result.pageOffset).toBe(0)
        expect(result.pageLimit).toBe(20)
    })

    test("should clamp a negative pageOffset to 0", () => {
        const result = getPageOffsetAndLimit({ pageOffset: -5 })

        expect(result.pageOffset).toBe(0)
    })

    test("should clamp a pageLimit less than 1 to 1", () => {
        const result = getPageOffsetAndLimit({ pageLimit: -1 })

        expect(result.pageLimit).toBe(1)
    })

    test("should pass through valid pageOffset and pageLimit", () => {
        const result = getPageOffsetAndLimit({ pageOffset: 10, pageLimit: 50 })

        expect(result.pageOffset).toBe(10)
        expect(result.pageLimit).toBe(50)
    })
})
