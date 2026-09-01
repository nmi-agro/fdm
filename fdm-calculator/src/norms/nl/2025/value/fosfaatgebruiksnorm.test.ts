import { createFdmServer, Field } from "@nmi-agro/fdm-core"
import { describe, expect, it, inject } from "vitest"
import type { NL2025NormsInput, NL2025NormsInputForCultivation } from "./types"
import { createId, pollLatestCachedResultForEntity } from "../../../../shared/test-util"
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

  it("should throw when soil analysis values are missing", async () => {
    const baseInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: true },
      field: { b_id: "1", b_centroid: [5.0, 52.0], b_bufferstrip: false },
      cultivations: [{ b_lu_catalogue: "nl_265" } as NL2025NormsInputForCultivation],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    await expect(
      calculateNL2025FosfaatGebruiksNorm({
        ...baseInput,
        soilAnalysis: { ...baseInput.soilAnalysis, a_p_al: null as unknown as number },
      }),
    ).rejects.toThrow("Missing soil analysis data for NL 2025 Fosfaatgebruiksnorm")
    await expect(
      calculateNL2025FosfaatGebruiksNorm({
        ...baseInput,
        soilAnalysis: { ...baseInput.soilAnalysis, a_p_al: undefined as unknown as number },
      }),
    ).rejects.toThrow("Missing soil analysis data for NL 2025 Fosfaatgebruiksnorm")
    await expect(
      calculateNL2025FosfaatGebruiksNorm({
        ...baseInput,
        soilAnalysis: { ...baseInput.soilAnalysis, a_p_cc: null as unknown as number },
      }),
    ).rejects.toThrow("Missing soil analysis data for NL 2025 Fosfaatgebruiksnorm")
    await expect(
      calculateNL2025FosfaatGebruiksNorm({
        ...baseInput,
        soilAnalysis: { ...baseInput.soilAnalysis, a_p_cc: undefined as unknown as number },
      }),
    ).rejects.toThrow("Missing soil analysis data for NL 2025 Fosfaatgebruiksnorm")
  })

  it("should throw when no fosfaat norms are available for the detected class", async () => {
    await expect(
      calculateNL2025FosfaatGebruiksNorm(
        {
          farm: { is_derogatie_bedrijf: false, has_grazing_intention: true },
          field: { b_id: "1", b_centroid: [5.0, 52.0], b_bufferstrip: false },
          cultivations: [{ b_lu_catalogue: "nl_265" } as NL2025NormsInputForCultivation],
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
    // Grasland branches
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

    // Bouwland branches
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
    const result = await calculateNL2025FosfaatGebruiksNorm({
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: true },
      field: { b_id: "1", b_centroid: [5.0, 52.0], b_bufferstrip: false },
      cultivations: [{ b_lu_catalogue: sample.b_lu_catalogue } as NL2025NormsInputForCultivation],
      soilAnalysis: { a_p_al: sample.a_p_al, a_p_cc: sample.a_p_cc },
    })

    expect(result.normSource).toBe(sample.expectedSource)
    expect(result.normValue).toBe(sample.expectedNorm)
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

    const cached = await pollLatestCachedResultForEntity(
      fdm,
      "calculateNL2025FosfaatGebruiksNorm",
      "field",
      b_id,
    )
    expect(cached).not.toBeNull()
  })
})
