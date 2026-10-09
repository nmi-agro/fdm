import { RvoSoapFaultError } from "@nmi-agro/rvo-connector"

/**
 * EDI-Crop error code that RVO returns when the authenticated eHerkenning account is not
 * allowed to request the data (Toegang geweigerd).
 */
const EDI_ACCESS_DENIED = "EDI009"

/**
 * Returns the error as an `RvoSoapFaultError`, or `undefined` if it is not one.
 *
 * Falls back to a name check, so the error is still recognised when more than one copy of
 * `@nmi-agro/rvo-connector` is loaded and `instanceof` fails.
 */
function asRvoSoapFaultError(error: unknown): RvoSoapFaultError | undefined {
  if (error instanceof RvoSoapFaultError) return error
  if (error instanceof Error && error.name === "RvoSoapFaultError") {
    return error as RvoSoapFaultError
  }
  return undefined
}

/**
 * Checks whether an error from the RVO client means that RVO denied access to the requested
 * farm data.
 *
 * The RVO client (`@nmi-agro/rvo-connector`) reports this in two ways:
 *
 * - As an `RvoSoapFaultError` with EDI-Crop code `EDI009` (Toegang geweigerd). RVO returns
 *   this fault with HTTP status 500, for example when the eHerkenning account has no
 *   machtiging for the KvK number sent as `ThirdPartyFarmID`, or when a farmer sends the KvK
 *   number of their own farm.
 * - As a plain `Error` with a message like `"Request failed: <status> - <body>"` and HTTP
 *   status 401 or 403.
 *
 * A denied request is a *completed* request that denies the relationship, not a
 * network/config/server fault. When the request was made with a machtiging, it is therefore
 * meaningful enough to record as a `not_verified` farm-verification result (see fdm-core's
 * `addFarmVerification` docs on faulting vs. completed requests).
 *
 * @param error - The error thrown by the RVO client.
 * @returns `true` if RVO denied access, otherwise `false`.
 */
export function isRvoPermissionDeniedError(error: unknown): boolean {
  const soapFault = asRvoSoapFaultError(error)
  if (soapFault) return soapFault.ediCode === EDI_ACCESS_DENIED

  if (!(error instanceof Error)) return false
  const match = error.message.match(/Request failed: (\d{3})/)
  if (!match) return false
  const status = Number(match[1])
  return status === 401 || status === 403
}

/**
 * Details of an RVO client error that are safe to use for logging and analytics.
 */
export interface RvoErrorDetails {
  /** HTTP status code of the RVO response, if known. */
  status_code?: string
  /** EDI-Crop error code of the SOAP fault (e.g. `EDI009`), if the error is a SOAP fault. */
  edi_code?: string
  /**
   * A short description of the error. For a SOAP fault, this is the fault description returned
   * by RVO. The raw response body is never included, as it may contain farm data.
   */
  message?: string
}

/**
 * Extracts the HTTP status code, EDI-Crop error code and a short description from an error
 * thrown by the RVO client.
 *
 * @param error - The error thrown by the RVO client.
 * @returns The extracted details. Fields that cannot be determined are left `undefined`.
 */
export function getRvoErrorDetails(error: unknown): RvoErrorDetails {
  const soapFault = asRvoSoapFaultError(error)
  if (soapFault) {
    return {
      status_code: String(soapFault.httpStatus),
      edi_code: soapFault.ediCode,
      message: soapFault.ediDescription ?? soapFault.faultString,
    }
  }

  if (!(error instanceof Error)) return {}
  const match = error.message.match(/^Request failed: (\d{3})\s/)
  if (match) {
    // Drop the response body that follows the status code, as it may contain farm data
    return { status_code: match[1], message: `Request failed: ${match[1]}` }
  }
  return { message: error.message }
}
