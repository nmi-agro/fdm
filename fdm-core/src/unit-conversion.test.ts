import Decimal from "decimal.js"
import { describe, expect, it } from "vitest"
import {
    type AppAmountUnit,
    fromKgPerHa,
    type RvoUnitSuggestionTableItem,
    suggestUnitFromRvoCode,
    toKgPerHa,
} from "./unit-conversion"

interface ConversionUnitTestCase {
    input: number
    unit: AppAmountUnit
    density?: number | undefined

    output?: number | null
    throws?: string
}

describe("toKgPerHa", () => {
    const tests: ConversionUnitTestCase[] = [
        { input: 20, unit: "kg/ha", output: 20 },
        { input: 20, unit: "ton/ha", output: 20000 },
        { input: 20, unit: "l/ha", density: 0.8, output: 16 },
        { input: 20, unit: "m3/ha", density: 0.8, output: 16000 },
        { input: 0, unit: "kg/ha", output: 0 },
        { input: 0, unit: "ton/ha", output: 0 },
        { input: 0, unit: "l/ha", density: 0.8, output: 0 },
        { input: 0, unit: "m3/ha", density: 0.8, output: 0 },
    ]

    const throwingTests: ConversionUnitTestCase[] = [
        {
            input: 20,
            unit: "l/ha",
            density: undefined,
            throws: "Density (p_density) is required for l/ha → kg/ha conversion",
        },
        {
            input: 20,
            unit: "m3/ha",
            density: undefined,
            throws: "Density (p_density) is required for m3/ha → kg/ha conversion",
        },
        {
            input: 20,
            unit: "ft3/ha" as AppAmountUnit,
            density: 2,
            throws: "ft3/ha → kg/ha conversion is not supported",
        },
    ]

    for (const { input, unit, density, output } of tests) {
        it(
            density !== undefined
                ? `should convert ${unit} to kg/ha with density ${density} kg/l`
                : `should convert ${unit} to kg/ha without density specified`,
            () => {
                expect(toKgPerHa(input, unit, density).toNumber()).toBe(output)
            },
        )
    }

    for (const { input, unit, density, throws } of throwingTests) {
        it(
            density !== undefined
                ? `should throw exception on conversion from ${unit} to kg/ha`
                : `should throw exception on conversion from ${unit} to kg/ha without density specified`,
            () => {
                expect(() => toKgPerHa(input, unit, density)).toThrow(throws)
            },
        )
    }

    it("should accept input of type Decimal", () => {
        expect(
            toKgPerHa(new Decimal(10), "m3/ha", new Decimal(2)).toNumber(),
        ).toBe(20000)
    })
})

describe("fromKgPerHa", () => {
    const tests: ConversionUnitTestCase[] = [
        { input: 20, unit: "kg/ha", output: 20 },
        { input: 20000, unit: "ton/ha", output: 20 },
        { input: 16, unit: "l/ha", density: 0.8, output: 20 },
        { input: 16000, unit: "m3/ha", density: 0.8, output: 20 },
        { input: 0, unit: "kg/ha", output: 0 },
        { input: 0, unit: "ton/ha", output: 0 },
        { input: 0, unit: "l/ha", density: 0.8, output: 0 },
        { input: 0, unit: "m3/ha", density: 0.8, output: 0 },
        {
            input: 20,
            unit: "l/ha",
            density: undefined,
            output: null,
        },
        {
            input: 20,
            unit: "m3/ha",
            density: undefined,
            output: null,
        },
        {
            input: 20,
            unit: "m3/ha",
            density: 0,
            output: null,
        },
        {
            input: 20,
            unit: "m3/ha",
            density: -1,
            output: null,
        },
        {
            input: 20,
            unit: "ft3/ha" as AppAmountUnit,
            density: 2,
            output: null,
        },
    ]

    for (const { input, unit, density, output } of tests) {
        it(
            density !== undefined
                ? `should convert kg/ha to ${unit} with density ${density} kg/l`
                : `should convert kg/ha to ${unit} without density specified`,
            () => {
                const value = fromKgPerHa(input, unit, density)
                expect(value !== null ? value.toNumber() : null).toBe(output)
            },
        )
    }

    it("should accept input of type Decimal", () => {
        expect(
            fromKgPerHa(
                new Decimal(20000),
                "m3/ha",
                new Decimal(2),
            )?.toNumber(),
        ).toBe(10)
    })
})

describe("suggestUnitFromRvoCode", () => {
    describe("internal table", () => {
        it("should return ton/ha for solid cattle manure", () => {
            expect(suggestUnitFromRvoCode("10")).toBe("ton/ha")
        })
        it("should return m3/ha for swine slurry", () => {
            expect(suggestUnitFromRvoCode("42")).toBe("m3/ha")
        })
        it("should return l/ha for liquid goat manure", () => {
            expect(suggestUnitFromRvoCode("60")).toBe("l/ha")
        })
        it("should return kg/ha for mineral fertilizers", () => {
            expect(suggestUnitFromRvoCode("115")).toBe("kg/ha")
        })
    })

    describe("custom table", () => {
        const customTable: RvoUnitSuggestionTableItem[] = [
            { p_type_rvo: "42", type: "other", unit: "kg/ha" },
            { p_type_rvo: "113", type: "solid sewage", unit: "ton/ha" },
            { p_type_rvo: "114", type: "liquid sewage", unit: "l/ha" },
            { p_type_rvo: "115", type: "swine slurry", unit: "m3/ha" },
        ]

        it("should return kg/ha for other fertilizers in custom table", () => {
            expect(suggestUnitFromRvoCode("42", customTable)).toBe("kg/ha")
        })
        it("should return ton/ha for solid sewage", () => {
            expect(suggestUnitFromRvoCode("113", customTable)).toBe("ton/ha")
        })
        it("should return l/ha for liquid sewage in custom table", () => {
            expect(suggestUnitFromRvoCode("114", customTable)).toBe("l/ha")
        })
        it("should return m3/ha for swine slurry", () => {
            expect(suggestUnitFromRvoCode("115", customTable)).toBe("m3/ha")
        })
        it("should return kg/ha for code not in table", () => {
            expect(suggestUnitFromRvoCode("10", customTable)).toBe("kg/ha")
        })
    })
})
