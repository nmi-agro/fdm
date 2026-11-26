import { describe, expect, it } from "vitest"
import type { NL2027NormsInput } from "./types"
import { calculateNL2027DierlijkeMestGebruiksNorm } from "./dierlijke-mest-gebruiksnorm"

describe("calculateNL2027DierlijkeMestGebruiksNorm", () => {
  it("should return the default norm value", async () => {
    const input: NL2027NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "field-1",
        b_centroid: [0, 0],
        b_bufferstrip: false,
      },
      cultivations: [],
      soilAnalysis: { a_p_al: 0, a_p_cc: 0 },
    }
    const result = await calculateNL2027DierlijkeMestGebruiksNorm(input)
    expect(result.normValue).toBe(170)
    expect(result.normSource).toBe("Standaard - geen derogatie")
  })

  it("should return 0 for buffer strips", async () => {
    const input = {
      field: {
        b_bufferstrip: true,
      },
    } as NL2027NormsInput
    const result = await calculateNL2027DierlijkeMestGebruiksNorm(input)
    expect(result.normValue).toBe(0)
    expect(result.normSource).toBe("Bufferstrook: geen plaatsingsruimte")
  })
})
