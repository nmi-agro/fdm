/**
 * @packageDocumentation
 * @module mineralisatie/errors
 *
 * Custom error types for the Mineralisatie module.
 */

/**
 * Thrown when the NMI API returns a non-2xx HTTP response during a
 * mineralization (nsupply) or DYNA calculation request.
 *
 * @example
 * ```typescript
 * try {
 *   await getNSupply(fdm, input)
 * } catch (err) {
 *   if (err instanceof NmiApiError && err.status === 422) {
 *     // Handle missing soil data
 *   }
 * }
 * ```
 *
 * Common status codes:
 * - `400` — Invalid request (e.g. duplicate year in rotation, missing `b_lu`)
 * - `401` / `403` — API key missing or expired
 * - `422` — Insufficient soil/field data to run the model
 * - `503` — NMI API temporarily unavailable
 */
export class NmiApiError extends Error {
    /**
     * The HTTP status code returned by the NMI API.
     */
    public readonly status: number

    /**
     * @param status - HTTP status code from the NMI API response
     * @param message - Dutch-language user-facing error description
     */
    constructor(status: number, message: string) {
        super(message)
        this.status = status
        this.name = "NmiApiError"
    }
}
