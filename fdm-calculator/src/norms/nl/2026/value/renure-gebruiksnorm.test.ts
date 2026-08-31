import { createFdmServer, getLatestCachedResultForEntity } from "@nmi-agro/fdm-core"
import { describe, expect, inject, it } from "vitest"
import type { NL2026NormsInput } from "./types"
import { createId } from "../../../../shared/test-util"
import {
  calculateNL2026RenureGebruiksNorm,
  getNL2026RenureGebruiksNorm,
} from "./renure-gebruiksnorm"

describe("calculateNL2026RenureGebruiksNorm", () => {
  it("should return the default norm value", async () => {
    const input: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "field-1",
        b_centroid: [0, 0],
        b_bufferstrip: false,
      },
      cultivations: [],
      soilAnalysis: { a_p_al: 0, a_p_cc: 0 },
    }
    const result = await calculateNL2026RenureGebruiksNorm(input)
    expect(result.normValue).toBe(80)
    expect(result.normSource).toBe("")
  })

  it("should return 0 for buffer strips", async () => {
    const input = {
      field: {
        b_bufferstrip: true,
      },
    } as NL2026NormsInput
    const result = await calculateNL2026RenureGebruiksNorm(input)
    expect(result.normValue).toBe(0)
    expect(result.normSource).toBe("Bufferstrook: geen plaatsingsruimte")
  })

  it("should set the correct cache entity id", async () => {
    const b_id = `field_${createId()}`

    const fdm = createFdmServer(
      inject("host"),
      inject("port"),
      inject("user"),
      inject("password"),
      inject("database"),
    )

    const input: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: b_id,
        b_centroid: [Math.random(), 52.0],
        b_bufferstrip: true,
      },
      cultivations: [],
      soilAnalysis: { a_p_al: 0, a_p_cc: 0 },
    }

    await getNL2026RenureGebruiksNorm(fdm, input)

    // setCachedCalculation is fire-and-forget so we need to wait a bit to make sure it is called.
    await new Promise((resolve) => {
      setTimeout(resolve, 100)
    })

    const cached = await getLatestCachedResultForEntity(
      fdm,
      "calculateNL2026RenureGebruiksNorm",
      "field",
      b_id,
    )
    expect(cached).not.toBeNull()
  })
})
