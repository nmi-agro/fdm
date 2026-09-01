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
      setTimeout(resolve, 200)
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

  it("should throw when soil analysis values are missing", async () => {
    const baseInput: NL2026NormsInput = {
      farm: { has_grazing_intention: true },
      field: { b_id: "1", b_centroid: [5.0, 52.0], b_bufferstrip: false },
      cultivations: [{ b_lu_catalogue: "nl_265" } as NL2026NormsInputForCultivation],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    await expect(
      calculateNL2026FosfaatGebruiksNorm({
        ...baseInput,
        soilAnalysis: { ...baseInput.soilAnalysis, a_p_al: null as unknown as number },
      }),
    ).rejects.toThrow("Missing soil analysis data for NL 2026 Fosfaatgebruiksnorm")
    await expect(
      calculateNL2026FosfaatGebruiksNorm({
        ...baseInput,
        soilAnalysis: { ...baseInput.soilAnalysis, a_p_al: undefined as unknown as number },
      }),
    ).rejects.toThrow("Missing soil analysis data for NL 2026 Fosfaatgebruiksnorm")
    await expect(
      calculateNL2026FosfaatGebruiksNorm({
        ...baseInput,
        soilAnalysis: { ...baseInput.soilAnalysis, a_p_cc: null as unknown as number },
      }),
    ).rejects.toThrow("Missing soil analysis data for NL 2026 Fosfaatgebruiksnorm")
    await expect(
      calculateNL2026FosfaatGebruiksNorm({
        ...baseInput,
        soilAnalysis: { ...baseInput.soilAnalysis, a_p_cc: undefined as unknown as number },
      }),
    ).rejects.toThrow("Missing soil analysis data for NL 2026 Fosfaatgebruiksnorm")
  })

  it("should throw when no fosfaat norms are available for the detected class", async () => {
    await expect(
      calculateNL2026FosfaatGebruiksNorm(
        {
          farm: { has_grazing_intention: true },
          field: { b_id: "1", b_centroid: [5.0, 52.0], b_bufferstrip: false },
          cultivations: [{ b_lu_catalogue: "nl_265" } as NL2026NormsInputForCultivation],
          soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        },
        {},
      ),
    ).rejects.toThrow("No phosphate norms found for class Arm.")
  })

  const matrix: Array<{
    name: string
    b_lu_catalogue: string
    a_p_cc: number
    a_p_al: number
    expectedSource: string
    expectedNorm: number
  }> = [
    {
      name: "grasland <0.8 arm",
      b_lu_catalogue: "nl_265",
      a_p_cc: 0.7,
      a_p_al: 20,
      expectedSource: "Grasland: Arm",
      expectedNorm: 120,
    },
    {
      name: "grasland <0.8 laag",
      b_lu_catalogue: "nl_265",
      a_p_cc: 0.7,
      a_p_al: 45,
      expectedSource: "Grasland: Laag",
      expectedNorm: 105,
    },
    {
      name: "grasland <0.8 neutraal",
      b_lu_catalogue: "nl_265",
      a_p_cc: 0.7,
      a_p_al: 55,
      expectedSource: "Grasland: Neutraal",
      expectedNorm: 95,
    },
    {
      name: "grasland <0.8 ruim",
      b_lu_catalogue: "nl_265",
      a_p_cc: 0.7,
      a_p_al: 56,
      expectedSource: "Grasland: Ruim",
      expectedNorm: 90,
    },
    {
      name: "grasland <=1.4 arm",
      b_lu_catalogue: "nl_265",
      a_p_cc: 1.4,
      a_p_al: 20,
      expectedSource: "Grasland: Arm",
      expectedNorm: 120,
    },
    {
      name: "grasland <=1.4 laag",
      b_lu_catalogue: "nl_265",
      a_p_cc: 1.4,
      a_p_al: 30,
      expectedSource: "Grasland: Laag",
      expectedNorm: 105,
    },
    {
      name: "grasland <=1.4 neutraal",
      b_lu_catalogue: "nl_265",
      a_p_cc: 1.4,
      a_p_al: 45,
      expectedSource: "Grasland: Neutraal",
      expectedNorm: 95,
    },
    {
      name: "grasland <=1.4 ruim",
      b_lu_catalogue: "nl_265",
      a_p_cc: 1.4,
      a_p_al: 46,
      expectedSource: "Grasland: Ruim",
      expectedNorm: 90,
    },
    {
      name: "grasland =0.8 arm",
      b_lu_catalogue: "nl_265",
      a_p_cc: 0.8,
      a_p_al: 20,
      expectedSource: "Grasland: Arm",
      expectedNorm: 120,
    },
    {
      name: "grasland =0.8 laag",
      b_lu_catalogue: "nl_265",
      a_p_cc: 0.8,
      a_p_al: 30,
      expectedSource: "Grasland: Laag",
      expectedNorm: 105,
    },
    {
      name: "grasland =0.8 neutraal",
      b_lu_catalogue: "nl_265",
      a_p_cc: 0.8,
      a_p_al: 45,
      expectedSource: "Grasland: Neutraal",
      expectedNorm: 95,
    },
    {
      name: "grasland =0.8 ruim",
      b_lu_catalogue: "nl_265",
      a_p_cc: 0.8,
      a_p_al: 46,
      expectedSource: "Grasland: Ruim",
      expectedNorm: 90,
    },
    {
      name: "grasland <=2.4 laag",
      b_lu_catalogue: "nl_265",
      a_p_cc: 2.4,
      a_p_al: 20,
      expectedSource: "Grasland: Laag",
      expectedNorm: 105,
    },
    {
      name: "grasland <=2.4 neutraal",
      b_lu_catalogue: "nl_265",
      a_p_cc: 2.4,
      a_p_al: 30,
      expectedSource: "Grasland: Neutraal",
      expectedNorm: 95,
    },
    {
      name: "grasland <=2.4 ruim",
      b_lu_catalogue: "nl_265",
      a_p_cc: 2.4,
      a_p_al: 55,
      expectedSource: "Grasland: Ruim",
      expectedNorm: 90,
    },
    {
      name: "grasland <=2.4 hoog",
      b_lu_catalogue: "nl_265",
      a_p_cc: 2.4,
      a_p_al: 56,
      expectedSource: "Grasland: Hoog",
      expectedNorm: 75,
    },
    {
      name: "grasland <=3.4 neutraal",
      b_lu_catalogue: "nl_265",
      a_p_cc: 3.4,
      a_p_al: 20,
      expectedSource: "Grasland: Neutraal",
      expectedNorm: 95,
    },
    {
      name: "grasland <=3.4 ruim",
      b_lu_catalogue: "nl_265",
      a_p_cc: 3.4,
      a_p_al: 45,
      expectedSource: "Grasland: Ruim",
      expectedNorm: 90,
    },
    {
      name: "grasland <=3.4 hoog",
      b_lu_catalogue: "nl_265",
      a_p_cc: 3.4,
      a_p_al: 46,
      expectedSource: "Grasland: Hoog",
      expectedNorm: 75,
    },
    {
      name: "grasland >3.4 ruim",
      b_lu_catalogue: "nl_265",
      a_p_cc: 3.5,
      a_p_al: 30,
      expectedSource: "Grasland: Ruim",
      expectedNorm: 90,
    },
    {
      name: "grasland >3.4 hoog",
      b_lu_catalogue: "nl_265",
      a_p_cc: 3.5,
      a_p_al: 31,
      expectedSource: "Grasland: Hoog",
      expectedNorm: 75,
    },
    {
      name: "bouwland <0.8 arm",
      b_lu_catalogue: "nl_101",
      a_p_cc: 0.7,
      a_p_al: 45,
      expectedSource: "Bouwland: Arm",
      expectedNorm: 120,
    },
    {
      name: "bouwland <0.8 laag",
      b_lu_catalogue: "nl_101",
      a_p_cc: 0.7,
      a_p_al: 46,
      expectedSource: "Bouwland: Laag",
      expectedNorm: 80,
    },
    {
      name: "bouwland <=1.4 arm",
      b_lu_catalogue: "nl_101",
      a_p_cc: 1.4,
      a_p_al: 45,
      expectedSource: "Bouwland: Arm",
      expectedNorm: 120,
    },
    {
      name: "bouwland <=1.4 laag",
      b_lu_catalogue: "nl_101",
      a_p_cc: 1.4,
      a_p_al: 55,
      expectedSource: "Bouwland: Laag",
      expectedNorm: 80,
    },
    {
      name: "bouwland <=1.4 neutraal",
      b_lu_catalogue: "nl_101",
      a_p_cc: 1.4,
      a_p_al: 56,
      expectedSource: "Bouwland: Neutraal",
      expectedNorm: 70,
    },
    {
      name: "bouwland =0.8 arm",
      b_lu_catalogue: "nl_101",
      a_p_cc: 0.8,
      a_p_al: 45,
      expectedSource: "Bouwland: Arm",
      expectedNorm: 120,
    },
    {
      name: "bouwland =0.8 laag",
      b_lu_catalogue: "nl_101",
      a_p_cc: 0.8,
      a_p_al: 55,
      expectedSource: "Bouwland: Laag",
      expectedNorm: 80,
    },
    {
      name: "bouwland =0.8 neutraal",
      b_lu_catalogue: "nl_101",
      a_p_cc: 0.8,
      a_p_al: 56,
      expectedSource: "Bouwland: Neutraal",
      expectedNorm: 70,
    },
    {
      name: "bouwland <=2.4 arm",
      b_lu_catalogue: "nl_101",
      a_p_cc: 2.4,
      a_p_al: 30,
      expectedSource: "Bouwland: Arm",
      expectedNorm: 120,
    },
    {
      name: "bouwland <=2.4 laag",
      b_lu_catalogue: "nl_101",
      a_p_cc: 2.4,
      a_p_al: 45,
      expectedSource: "Bouwland: Laag",
      expectedNorm: 80,
    },
    {
      name: "bouwland <=2.4 neutraal",
      b_lu_catalogue: "nl_101",
      a_p_cc: 2.4,
      a_p_al: 55,
      expectedSource: "Bouwland: Neutraal",
      expectedNorm: 70,
    },
    {
      name: "bouwland <=2.4 ruim",
      b_lu_catalogue: "nl_101",
      a_p_cc: 2.4,
      a_p_al: 56,
      expectedSource: "Bouwland: Ruim",
      expectedNorm: 60,
    },
    {
      name: "bouwland <=3.4 arm",
      b_lu_catalogue: "nl_101",
      a_p_cc: 3.4,
      a_p_al: 20,
      expectedSource: "Bouwland: Arm",
      expectedNorm: 120,
    },
    {
      name: "bouwland <=3.4 laag",
      b_lu_catalogue: "nl_101",
      a_p_cc: 3.4,
      a_p_al: 30,
      expectedSource: "Bouwland: Laag",
      expectedNorm: 80,
    },
    {
      name: "bouwland <=3.4 neutraal",
      b_lu_catalogue: "nl_101",
      a_p_cc: 3.4,
      a_p_al: 45,
      expectedSource: "Bouwland: Neutraal",
      expectedNorm: 70,
    },
    {
      name: "bouwland <=3.4 ruim",
      b_lu_catalogue: "nl_101",
      a_p_cc: 3.4,
      a_p_al: 55,
      expectedSource: "Bouwland: Ruim",
      expectedNorm: 60,
    },
    {
      name: "bouwland <=3.4 hoog",
      b_lu_catalogue: "nl_101",
      a_p_cc: 3.4,
      a_p_al: 56,
      expectedSource: "Bouwland: Hoog",
      expectedNorm: 40,
    },
    {
      name: "bouwland >3.4 laag",
      b_lu_catalogue: "nl_101",
      a_p_cc: 3.5,
      a_p_al: 30,
      expectedSource: "Bouwland: Laag",
      expectedNorm: 80,
    },
    {
      name: "bouwland >3.4 neutraal",
      b_lu_catalogue: "nl_101",
      a_p_cc: 3.5,
      a_p_al: 45,
      expectedSource: "Bouwland: Neutraal",
      expectedNorm: 70,
    },
    {
      name: "bouwland >3.4 ruim",
      b_lu_catalogue: "nl_101",
      a_p_cc: 3.5,
      a_p_al: 55,
      expectedSource: "Bouwland: Ruim",
      expectedNorm: 60,
    },
    {
      name: "bouwland >3.4 hoog",
      b_lu_catalogue: "nl_101",
      a_p_cc: 3.5,
      a_p_al: 56,
      expectedSource: "Bouwland: Hoog",
      expectedNorm: 40,
    },
  ]

  it.each(matrix)("classifies phosphate class for %s", async (sample) => {
    const result = await calculateNL2026FosfaatGebruiksNorm({
      farm: { has_grazing_intention: true },
      field: { b_id: "1", b_centroid: [5.0, 52.0], b_bufferstrip: false },
      cultivations: [{ b_lu_catalogue: sample.b_lu_catalogue } as NL2026NormsInputForCultivation],
      soilAnalysis: { a_p_al: sample.a_p_al, a_p_cc: sample.a_p_cc },
    })

    expect(result.normSource).toBe(sample.expectedSource)
    expect(result.normValue).toBe(sample.expectedNorm)
  })
})
