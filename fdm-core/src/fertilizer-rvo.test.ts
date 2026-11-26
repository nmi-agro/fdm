import { describe, expect, it } from "vitest"
import { getFertilizerTypesByRvoCode } from "./fertilizer"

describe("getFertilizerTypesByRvoCode", () => {
  it("maps RVO codes to the type of fertilizers with that code", () => {
    expect(
      getFertilizerTypesByRvoCode([
        { p_type_rvo: "11", p_type: "manure" },
        { p_type_rvo: "115", p_type: "mineral" },
        { p_type_rvo: "11", p_type: "manure" },
      ]),
    ).toEqual({ "11": "manure", "115": "mineral" })
  })

  it("skips fertilizers without an RVO code or a type", () => {
    expect(
      getFertilizerTypesByRvoCode([
        { p_type_rvo: null, p_type: "manure" },
        { p_type_rvo: "11", p_type: null },
        {},
      ]),
    ).toEqual({})
  })
})
