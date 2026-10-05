/**
 * Raised when a BLN3 result (score, measure applicability or measure advice) cannot be
 * produced, for example because the NMI service is unreachable or returned an unusable
 * payload.
 *
 * The message is safe to expose to API clients: it never contains upstream error
 * payloads, credentials or field coordinates. The original error is kept in `cause`
 * for server-side logging only.
 */
export class Bln3UnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "Bln3UnavailableError"
  }
}
