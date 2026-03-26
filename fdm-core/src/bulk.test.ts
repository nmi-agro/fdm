import { describe, expect, it } from "vitest"
import { splitBy } from "./bulk"

describe("splitBy", () => {
    it("should split by key", () => {
        const data = [
            { key: "aaa", value: 3 },
            { key: "aaa", value: 5 },
            { key: "bbb", value: 2 },
        ]

        expect(splitBy(data, (datum) => datum.key)).toEqual({
            aaa: [
                { key: "aaa", value: 3 },
                { key: "aaa", value: 5 },
            ],
            bbb: [{ key: "bbb", value: 2 }],
        })
    })

    it("should handle an empty array", () => {
        const data: { key: string; value: string }[] = []

        expect(splitBy(data, (datum) => datum.key)).toEqual({})
    })

    it("should throw an error for unsorted keys", () => {
        const data = [
            { key: "aaa", value: 3 },
            { key: "bbb", value: 2 },
            { key: "aaa", value: 5 },
        ]

        expect(() => splitBy(data, (datum) => datum.key)).toThrow(
            `Key "aaa" has been encountered twice`,
        )
    })
})
