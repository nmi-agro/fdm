import { describe, expect, test } from "vitest"
import { BaseError, ensureError, handleError } from "./error"

describe("ensureError", () => {
    test("should return the input when it is already an Error", () => {
        const error = new Error("original")
        expect(ensureError(error)).toBe(error)
    })

    test("should wrap a string thrown as a non-Error value", () => {
        const result = ensureError("something went wrong")
        expect(result).toBeInstanceOf(Error)
        expect(result.message).toContain("something went wrong")
    })

    test("should wrap a non-Error object", () => {
        const result = ensureError({ code: 42 })
        expect(result).toBeInstanceOf(Error)
        expect(result.message).toContain("42")
    })
})

describe("handleError", () => {
    test("should wrap an error with the provided base message", () => {
        const cause = new Error("db failure")
        const result = handleError(cause, "Exception for someOperation")
        expect(result).toBeInstanceOf(BaseError)
        expect(result.message).toBe("Exception for someOperation")
        expect(result.cause).toBe(cause)
    })

    test("should pass through the permission denied message unchanged", () => {
        const cause = new Error(
            "Principal does not have permission to perform this action",
        )
        const result = handleError(cause, "Exception for someOperation")
        expect(result.message).toBe(
            "Principal does not have permission to perform this action",
        )
    })

    test("should attach context to the error", () => {
        const result = handleError(
            new Error("cause"),
            "Exception for operation",
            { resource: "ticket", id: "abc" },
        )
        expect(result.context).toEqual({ resource: "ticket", id: "abc" })
    })
})

describe("BaseError", () => {
    test("should set name to the class name", () => {
        const error = new BaseError("test error")
        expect(error.name).toBe("BaseError")
    })

    test("should expose the cause", () => {
        const cause = new Error("root cause")
        const error = new BaseError("wrapper", { cause })
        expect(error.cause).toBe(cause)
    })

    test("should store the context payload", () => {
        const error = new BaseError("with context", {
            context: { foo: "bar" },
        })
        expect(error.context).toEqual({ foo: "bar" })
    })

    test("should use the subclass name when extended", () => {
        class CustomError extends BaseError {}
        const error = new CustomError("custom")
        expect(error.name).toBe("CustomError")
    })
})
