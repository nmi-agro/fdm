import { describe, expect, it } from "vitest"
import type { NL2026NormsInput } from "../../2026/value/types"
import { calculateNL2026DierlijkeMestGebruiksNorm } from "../../2026/value/dierlijke-mest-gebruiksnorm"

// 2027 uses the rules introduced in 2026 (provisional), so these tests run the 2026 functions
// with a 2027 input.
describe("2027, calculateNL2026DierlijkeMestGebruiksNorm", () => {
  it("should return the default norm value", async () => {
    const input: NL2026NormsInput = {
      year: 2027,
      farm: { has_grazing_intention: false },
      field: {
        b_id: "field-1",
        b_centroid: [0, 0],
        b_bufferstrip: false,
      },
      cultivations: [],
      soilAnalysis: { a_p_al: 0, a_p_cc: 0 },
    }
    const result = await calculateNL2026DierlijkeMestGebruiksNorm(input)
    expect(result.normValue).toBe(170)
    expect(result.normSource).toBe("Standaard - geen derogatie")
  })

  it("should return 0 for buffer strips", async () => {
    const input = {
      field: {
        b_bufferstrip: true,
      },
    } as NL2026NormsInput
    const result = await calculateNL2026DierlijkeMestGebruiksNorm(input)
    expect(result.normValue).toBe(0)
    expect(result.normSource).toBe("Bufferstrook: geen plaatsingsruimte")
  })
})
