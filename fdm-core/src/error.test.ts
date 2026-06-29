import { describe, expect, it } from "vitest"
import { BaseError, ensureError, handleError } from "./error"

describe("Error Handling", () => {
  describe("handleError", () => {
    it("should wrap an error with context", () => {
      const originalError = new Error("Original error")
      const context = { userId: 123 }
      const baseMessage = "Something went wrong"

      const handledError = handleError(originalError, baseMessage, context)

      expect(handledError).toBeInstanceOf(BaseError)
      expect(handledError.message).toBe(baseMessage)
      expect(handledError.cause).toBe(originalError)
      expect(handledError.context).toBe(context)
    })

    it("should wrap a non-error value with context", () => {
      const thrownValue = "A string error"
      const context = { userId: 456 }
      const baseMessage = "Another error occurred"

      const handledError = handleError(thrownValue, baseMessage, context)

      expect(handledError).toBeInstanceOf(BaseError)
      expect(handledError.message).toBe(baseMessage)
      expect(handledError.cause).toBeInstanceOf(Error)
      expect(handledError.context).toBe(context)
    })
  })

  describe("ensureError", () => {
    it("should return the original error if it's an Error instance", () => {
      const originalError = new Error("Test error")
      const result = ensureError(originalError)
      expect(result).toBe(originalError)
    })

    it("should create a new error if the input is not an Error instance", () => {
      const input = "not an error"
      const result = ensureError(input)
      expect(result).toBeInstanceOf(Error)
      expect(result.message).toContain(JSON.stringify(input))
    })
    it("should handle unstringifiable values", () => {
      const circularObject: any = {}
      circularObject.circular = circularObject

      const result = ensureError(circularObject)
      expect(result).toBeInstanceOf(Error)
      expect(result.message).toContain("[Unable to stringify the thrown value]")
    })
  })

  describe("BaseError", () => {
    it("should create a BaseError with a message and context", () => {
      const message = "Test error message"
      const context = { key: "value" }
      const error = new BaseError(message, { context })

      expect(error.message).toBe(message)
      expect(error.context).toBe(context)
      expect(error.name).toBe("BaseError")
    })

    it("should create a BaseError with a message, cause, and context", () => {
      const message = "Test error message"
      const cause = new Error("Original error")
      const context = { key: "value" }
      const error = new BaseError(message, { cause, context })

      expect(error.message).toBe(message)
      expect(error.cause).toBe(cause)
      expect(error.context).toBe(context)
      expect(error.name).toBe("BaseError")
    })
  })
})
