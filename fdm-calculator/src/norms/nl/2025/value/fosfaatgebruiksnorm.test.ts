import { createFdmServer, Field, getLatestCachedResultForEntity } from "@nmi-agro/fdm-core"
import { describe, expect, it, inject } from "vitest"
import type { NL2025NormsInput, NL2025NormsInputForCultivation } from "./types"
import { createId } from "../../../../shared/test-util"
import {
  calculateNL2025FosfaatGebruiksNorm,
  getNL2025FosfaatGebruiksNorm,
} from "./fosfaatgebruiksnorm"

describe("calculateNL2025FosfaatGebruiksNorm", () => {
  it("should return the correct norm for grasland", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: true },
      field: {
        b_id: "1",
        b_centroid: [5.0, 52.0],
        b_bufferstrip: false,
      },
      cultivations: [
        {
          b_lu_catalogue: "nl_265",
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }
    const result = await calculateNL2025FosfaatGebruiksNorm(mockInput)
    expect(result.normValue).toBe(120)
    expect(result.normSource).toContain("Grasland")
  })

  it("should return the correct norm for bouwland", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: true },
      field: {
        b_id: "1",
        b_centroid: [5.0, 52.0],
        b_bufferstrip: false,
      },
      cultivations: [
        {
          b_lu_catalogue: "nl_101",
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }
    const result = await calculateNL2025FosfaatGebruiksNorm(mockInput)
    expect(result.normValue).toBe(120)
    expect(result.normSource).toContain("Bouwland")
  })

  it("should return 0 for buffer strips", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: true },
      field: {
        b_id: "1",
        b_centroid: [5.0, 52.0],
        b_bufferstrip: true,
      },
      cultivations: [
        {
          b_lu_catalogue: "nl_101",
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }
    const result = await calculateNL2025FosfaatGebruiksNorm(mockInput)
    expect(result.normValue).toBe(0)
    expect(result.normSource).toBe("Bufferstrook: geen plaatsingsruimte")
  })

  it("should handle zero values for a_p_al and a_p_cc (regression test for falsy bug)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: true },
      field: {
        b_id: "1",
        b_centroid: [5.0, 52.0],
        b_bufferstrip: false,
      },
      cultivations: [
        {
          b_lu_catalogue: "nl_265",
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 0, a_p_cc: 0 },
    }
    const result = await calculateNL2025FosfaatGebruiksNorm(mockInput)
    expect(result).not.toBeNull()
    expect(result.normValue).toBeGreaterThan(0)
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

    const inputs: NL2025NormsInput = {
      farm: {
        is_derogatie_bedrijf: false,
        has_grazing_intention: false,
      },
      field: {
        b_id: b_id,
        b_centroid: [5.656346970245633, 51.987872886419524],
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265", // Grass
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 2, 10), // Mar 10
        },
        {
          b_lu_catalogue: "nl_259", // Maize (as example of relevant crop)
          b_lu_start: new Date(2025, 2, 11),
          b_lu_end: new Date(2025, 9, 1),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    await getNL2025FosfaatGebruiksNorm(fdm, inputs)

    // setCachedCalculation is fire-and-forget so we need to wait a bit to make sure it is called.
    await new Promise((resolve) => {
      setTimeout(resolve, 100)
    })

    const cached = await getLatestCachedResultForEntity(
      fdm,
      "calculateNL2025FosfaatGebruiksNorm",
      "field",
      b_id,
    )
    expect(cached).not.toBeNull()
  })
})
