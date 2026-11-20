import { describe, expect, it } from "vitest"
import { parseCattleEartag } from "./cattle-eartag"

describe("parseCattleEartag", () => {
  it("accepts the 9-digit example from the RVO message book and derives the work number", () => {
    expect(parseCattleEartag("NL 1011 7721 0")).toEqual({
      kind: "dutch",
      eartag: "NL101177210",
      worknumber: "7721",
      checkDigitVerified: true,
    })
  })

  it("accepts the 12-digit electronic example from the RVO message book", () => {
    expect(parseCattleEartag("NL 1300001 0001 9")).toEqual({
      kind: "dutch",
      eartag: "NL130000100019",
      worknumber: "0001",
      checkDigitVerified: true,
    })
  })

  it("normalizes the country code, separators and case", () => {
    const expected = parseCattleEartag("NL130000100019")
    expect(parseCattleEartag("130000100019")).toEqual(expected)
    expect(parseCattleEartag("528130000100019")).toEqual(expected)
    expect(parseCattleEartag(" nl-1300001.0001.9 ")).toEqual(expected)
    expect(parseCattleEartag("528101177210")).toEqual(parseCattleEartag("NL101177210"))
  })

  it("rejects a wrong check digit", () => {
    expect(parseCattleEartag("NL101177211")).toEqual({ kind: "invalid", reason: "check_digit" })
    expect(parseCattleEartag("NL130000100018")).toEqual({ kind: "invalid", reason: "check_digit" })
  })

  it("does not check the check digit of the conventional 12-digit series", () => {
    expect(parseCattleEartag("NL 1200000 4321 7")).toEqual({
      kind: "dutch",
      eartag: "NL120000043217",
      worknumber: "4321",
      checkDigitVerified: false,
    })
  })

  it("rejects numbers with the wrong length or outside the cattle series", () => {
    for (const input of [
      "",
      "NL",
      "NL12345",
      "NL012345678",
      "NL140000000000",
      "NL1300001000190",
      "NL13000010001X",
    ]) {
      expect(parseCattleEartag(input)).toEqual({ kind: "invalid", reason: "format" })
    }
  })

  it("leaves a foreign life number unchecked", () => {
    expect(parseCattleEartag("  DE 01 234 56789 ")).toEqual({
      kind: "foreign",
      eartag: "DE 01 234 56789",
    })
  })
})
