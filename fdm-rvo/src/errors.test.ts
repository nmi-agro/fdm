import { RvoSoapFaultError } from "@nmi-agro/rvo-connector"
import { describe, expect, it } from "vitest"
import { getRvoErrorDetails, isRvoPermissionDeniedError } from "./errors"

const RAW_RESPONSE = "<S:Envelope><S:Body><S:Fault>synthetic</S:Fault></S:Body></S:Envelope>"

function soapFault(ediCode: string | undefined, httpStatus = 500) {
  return new RvoSoapFaultError(
    {
      faultCode: "Server",
      faultString: "Synthetic fault string",
      ediCode,
      ediDescription: ediCode ? `Synthetic description for ${ediCode}` : undefined,
    },
    httpStatus,
    RAW_RESPONSE,
  )
}

describe("isRvoPermissionDeniedError", () => {
  it("returns true for an EDI009 SOAP fault", () => {
    expect(isRvoPermissionDeniedError(soapFault("EDI009"))).toBe(true)
  })

  it("returns false for a SOAP fault with another EDI code", () => {
    expect(isRvoPermissionDeniedError(soapFault("EDI001"))).toBe(false)
  })

  it("returns false for a SOAP fault without an EDI code", () => {
    expect(isRvoPermissionDeniedError(soapFault(undefined))).toBe(false)
  })

  it("recognises an EDI009 fault by name when instanceof fails", () => {
    const error = Object.assign(new Error("Toegang geweigerd"), {
      name: "RvoSoapFaultError",
      ediCode: "EDI009",
    })
    expect(isRvoPermissionDeniedError(error)).toBe(true)
  })

  it("returns true for a plain 401 or 403 request error", () => {
    expect(isRvoPermissionDeniedError(new Error("Request failed: 401 - body"))).toBe(true)
    expect(isRvoPermissionDeniedError(new Error("Request failed: 403 - body"))).toBe(true)
  })

  it("returns false for a plain 500 request error", () => {
    expect(isRvoPermissionDeniedError(new Error("Request failed: 500 - body"))).toBe(false)
  })

  it("returns false for other errors and non-error values", () => {
    expect(isRvoPermissionDeniedError(new Error("Something else"))).toBe(false)
    expect(isRvoPermissionDeniedError("Request failed: 403")).toBe(false)
    expect(isRvoPermissionDeniedError(undefined)).toBe(false)
  })
})

describe("getRvoErrorDetails", () => {
  it("returns the status, EDI code and description of a SOAP fault", () => {
    expect(getRvoErrorDetails(soapFault("EDI009"))).toEqual({
      status_code: "500",
      edi_code: "EDI009",
      message: "Synthetic description for EDI009",
    })
  })

  it("falls back to the fault string when there is no EDI description", () => {
    expect(getRvoErrorDetails(soapFault(undefined, 502))).toEqual({
      status_code: "502",
      edi_code: undefined,
      message: "Synthetic fault string",
    })
  })

  it("never includes the raw response of a SOAP fault", () => {
    const details = getRvoErrorDetails(soapFault("EDI009"))
    expect(JSON.stringify(details)).not.toContain("Envelope")
  })

  it("returns the status of a plain request error without the response body", () => {
    expect(getRvoErrorDetails(new Error("Request failed: 503 - <html>body</html>"))).toEqual({
      status_code: "503",
      message: "Request failed: 503",
    })
  })

  it("returns only the message for other errors", () => {
    expect(getRvoErrorDetails(new Error("Something else"))).toEqual({
      message: "Something else",
    })
  })

  it("returns an empty object for non-error values", () => {
    expect(getRvoErrorDetails("oops")).toEqual({})
  })
})
