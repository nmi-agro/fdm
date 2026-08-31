import { createFdmServer, getLatestCachedResultForEntity } from "@nmi-agro/fdm-core"
import { describe, expect, inject, it } from "vitest"
import type { NL2026NormsInput, NL2026NormsInputForCultivation } from "./types"
import { createId } from "../../../../shared/test-util"
import {
  calculateNL2026FosfaatGebruiksNorm,
  getNL2026FosfaatGebruiksNorm,
} from "./fosfaatgebruiksnorm"

describe("calculateNL2026FosfaatGebruiksNorm", () => {
  it("should return the correct norm for grasland", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: true },
      field: {
        b_id: "1",
        b_centroid: [5.0, 52.0],
        b_bufferstrip: false,
      },
      cultivations: [
        {
          b_lu_catalogue: "nl_265",
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }
    const result = await calculateNL2026FosfaatGebruiksNorm(mockInput)
    expect(result.normValue).toBe(120)
    expect(result.normSource).toContain("Grasland")
  })

  it("should return the correct norm for bouwland", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: true },
      field: {
        b_id: "1",
        b_centroid: [5.0, 52.0],
        b_bufferstrip: false,
      },
      cultivations: [
        {
          b_lu_catalogue: "nl_101",
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }
    const result = await calculateNL2026FosfaatGebruiksNorm(mockInput)
    expect(result.normValue).toBe(120)
    expect(result.normSource).toContain("Bouwland")
  })

  it("should return 0 for buffer strips", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: true },
      field: {
        b_id: "1",
        b_centroid: [5.0, 52.0],
        b_bufferstrip: true,
      },
      cultivations: [
        {
          b_lu_catalogue: "nl_101",
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }
    const result = await calculateNL2026FosfaatGebruiksNorm(mockInput)
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

    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: true },
      field: {
        b_id: b_id,
        b_centroid: [Math.random(), 52.0],
        b_bufferstrip: true,
      },
      cultivations: [
        {
          b_lu_catalogue: "nl_101",
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    await getNL2026FosfaatGebruiksNorm(fdm, mockInput)

    // setCachedCalculation is fire-and-forget so we need to wait a bit to make sure it is called.
    await new Promise((resolve) => {
      setTimeout(resolve, 100)
    })

    const cached = await getLatestCachedResultForEntity(
      fdm,
      "calculateNL2026FosfaatGebruiksNorm",
      "field",
      b_id,
    )
    expect(cached).not.toBeNull()
  })

  it("should handle zero values for a_p_al and a_p_cc (regression test for falsy bug)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: true },
      field: {
        b_id: "1",
        b_centroid: [5.0, 52.0],
        b_bufferstrip: false,
      },
      cultivations: [
        {
          b_lu_catalogue: "nl_265",
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 0, a_p_cc: 0 },
    }
    const result = await calculateNL2026FosfaatGebruiksNorm(mockInput)
    expect(result).not.toBeNull()
    expect(result.normValue).toBeGreaterThan(0)
  })
})
