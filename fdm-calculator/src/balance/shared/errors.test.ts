import { describe, expect, it } from "vitest"
import { handleInputCollectionError } from "./errors"

describe("handleInputCollectionError", () => {
    const handleNutrientBalanceInputCollectionError =
        handleInputCollectionError(
            "Failed to collect nutrient balance input for farm",
            "Failed to collect nutrient balance input",
        )

    it("should wrap errors in the context of a farm", () => {
        const cause = new Error("Database transaction error")
        try {
            throw cause
        } catch (error) {
            const wrapped = handleNutrientBalanceInputCollectionError(
                error,
                "test-farm",
            )
            expect(wrapped.message).toEqual(
                "Failed to collect nutrient balance input for farm test-farm: Database transaction error",
            )
            expect(wrapped.cause).toBe(cause)
        }
    })

    it("should wrap errors outside the context of a farm", () => {
        const cause = new Error("Database transaction error")
        try {
            throw cause
        } catch (error) {
            const wrapped = handleNutrientBalanceInputCollectionError(error)
            expect(wrapped.message).toEqual(
                "Failed to collect nutrient balance input: Database transaction error",
            )
            expect(wrapped.cause).toBe(cause)
        }
    })

    it("should not rewrap known errors in the context of a farm", () => {
        const cause = new Error("Database transaction error")
        try {
            throw handleNutrientBalanceInputCollectionError(cause, "test-farm")
        } catch (error) {
            const wrapped = handleNutrientBalanceInputCollectionError(error)
            expect(wrapped.message).toEqual(
                "Failed to collect nutrient balance input for farm test-farm: Database transaction error",
            )
            expect(wrapped.cause).toBe(cause)
        }
    })

    it("should not rewrap known errors outside the context of a farm", () => {
        const cause = new Error("Database transaction error")
        try {
            throw handleNutrientBalanceInputCollectionError(cause)
        } catch (error) {
            const wrapped = handleNutrientBalanceInputCollectionError(
                error,
                "test-farm",
            )
            expect(wrapped.message).toEqual(
                "Failed to collect nutrient balance input: Database transaction error",
            )
            expect(wrapped.cause).toBe(cause)
        }
    })

    it("should handle errors that are not instance of Error", () => {
        try {
            throw null
        } catch (error) {
            const wrapped = handleNutrientBalanceInputCollectionError(error)
            expect(wrapped.message).toEqual(
                "Failed to collect nutrient balance input: null",
            )
            expect(wrapped.cause).toEqual(null)
        }
    })
})
