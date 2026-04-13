import type { Jsonable } from "./error.types"

/**
 * Converts an unknown error into a structured BaseError, applying a custom message for permission denials.
 *
 * The function first ensures the input is an Error instance using `ensureError`. If the error message exactly matches
 * "Principal does not have permission to perform this action", the message is explicitly set to that value. The resulting
 * BaseError includes the resolved error as its cause along with any additional context provided.
 *
 * @param err - The error value to convert into an Error instance.
 * @param base - The default error message, which may be overridden for specific permission denial cases.
 * @param context - Optional supplementary context to include with the error.
 * @returns A new BaseError instance encapsulating the error, its message, and any additional context.
 */
export function handleError(err: unknown, base: string, context?: Jsonable) {
    const error = ensureError(err)

    // Customize error in case of permission denied
    let message = base
    if (
        error.message ===
        "Principal does not have permission to perform this action"
    ) {
        message = "Principal does not have permission to perform this action"
    }

    return new BaseError(message, {
        cause: error,
        context: context,
    })
}

export function ensureError(value: unknown): Error {
    if (value instanceof Error) return value

    let stringified = "[Unable to stringify the thrown value]"
    try {
        stringified = JSON.stringify(value)
    } catch {}

    const error = new Error(
        `This value was thrown as is, not through an Error: ${stringified}`,
    )
    return error
}

export class BaseError extends Error {
    public readonly context?: Jsonable

    constructor(
        message: string,
        options: { cause?: Error; context?: Jsonable } = {},
    ) {
        const { cause, context } = options

        super(message, { cause })
        this.name = this.constructor.name

        this.context = context
    }
}
