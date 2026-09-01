import { createFdmServer, Field, getLatestCachedResultForEntity } from "@nmi-agro/fdm-core"
import { describe, expect, it, inject } from "vitest"
import type { NL2025NormsInput, NL2025NormsInputForCultivation } from "./types"
import { createId } from "../../../../shared/test-util"
import {
  calculateNL2025DierlijkeMestGebruiksNorm,
  getNL2025DierlijkeMestGebruiksNorm,
  isFieldInGWGBGebied,
  isFieldInNatura2000Gebied,
  isFieldInDerogatieVrijeZone,
} from "./dierlijke-mest-gebruiksnorm"

describe("calculateNL2025DierlijkeMestGebruiksNorm", () => {
  it("should return the default norm value", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.641351453912945, 51.97755938887036],
        b_bufferstrip: false,
      },
      cultivations: [],
      soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
    }
    const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
    expect(result.normValue).toBe(170)
    expect(result.normSource).toBe("Standaard - geen derogatie")
  })

  it("should handle null is_derogatie_bedrijf (regression test for falsy bug)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: {
        is_derogatie_bedrijf: null as any,
        has_grazing_intention: false,
      },
      field: {
        b_id: "1",
        b_centroid: [5.641351453912945, 51.97755938887036],
        b_bufferstrip: false,
      },
      cultivations: [],
      soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
    }
    const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
    expect(result.normValue).toBe(170)
    expect(result.normSource).toBe("Standaard - geen derogatie")
  })

  it("should handle 0 as is_derogatie_bedrijf (regression test for falsy bug)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: {
        is_derogatie_bedrijf: 0 as any,
        has_grazing_intention: false,
      },
      field: {
        b_id: "1",
        b_centroid: [5.641351453912945, 51.97755938887036],
        b_bufferstrip: false,
      },
      cultivations: [],
      soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
    }
    const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
    expect(result.normValue).toBe(170)
    expect(result.normSource).toBe("Standaard - geen derogatie")
  })

  it("should return the default norm value with derogation", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: true, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.641351453912945, 51.97755938887036],
        b_bufferstrip: false,
      },
      cultivations: [],
      soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
    }
    const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
    expect(result.normValue).toBe(200)
    expect(result.normSource).toBe("Derogatie")
  })

  it("should return the adjusted norm value for derogation in NV-gebied", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: true, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.654759168118452, 51.987887874110555],
        b_bufferstrip: false,
      },
      cultivations: [],
      soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
    }
    const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
    expect(result.normValue).toBe(190)
    expect(result.normSource).toBe("Derogatie - NV Gebied")
  })

  it("should return the default norm value without derogation in NV-gebied", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.654759168118452, 51.987887874110555],
        b_bufferstrip: false,
      },
      cultivations: [],
      soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
    }
    const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
    expect(result.normValue).toBe(170)
    expect(result.normSource).toBe("Standaard - geen derogatie")
  })

  it("should return the adjusted norm value for derogation in Grondwaterbeschermingsgebied", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: true, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [6.397701151566514, 52.56657210653102],
        b_bufferstrip: false,
      },
      cultivations: [],
      soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
    }
    const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
    expect(result.normValue).toBe(170)
    expect(result.normSource).toBe("Derogatie - Grondwaterbeschermingsgebied")
  })

  it("should return the default norm value for derogation outside Grondwaterbeschermingsgebied and inside NV-gebied, but with single array response (see #205)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: true, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.058131582583726, 52.50733333508596],
        b_bufferstrip: false,
      },
      cultivations: [],
      soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
    }
    const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
    expect(result.normValue).toBe(190)
    expect(result.normSource).toBe("Derogatie - NV Gebied")
  })

  it("should return the adjusted norm value for derogation in Natura 2000 gebied", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: true, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.804910408558418, 52.04532099948795], // Coordinates within a Natura 2000 area (Veluwe)
        b_bufferstrip: false,
      },
      cultivations: [],
      soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
    }
    const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
    expect(result.normValue).toBe(170)
    expect(result.normSource).toBe("Derogatie - Natura2000 Gebied")
  })

  it("should return the adjusted norm value for derogation in derogatie-vrije zone", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: true, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.698110435483986, 51.967321021267445],
        b_bufferstrip: false,
      },
      cultivations: [],
      soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
    }
    const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
    expect(result.normValue).toBe(170)
    expect(result.normSource).toBe("Derogatie - Derogatie-vrije zone")
  })

  it("should return 0 for buffer strips", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: true, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.641351453912945, 51.97755938887036],
        b_bufferstrip: true,
      },
      cultivations: [],
      soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
    }
    const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
    expect(result.normValue).toBe(0)
    expect(result.normSource).toBe("Bufferstrook: geen plaatsingsruimte")
  })

  describe("isFieldInDerogatieVrijeZone", () => {
    it("should return true for a location inside the derogatie-vrije zone", async () => {
      const locationInside: [number, number] = [5.698110435483986, 51.967321021267445]
      await expect(isFieldInDerogatieVrijeZone(locationInside)).resolves.toBe(true)
    })

    it("should return false for a location outside the derogatie-vrije zone", async () => {
      const locationOutside: [number, number] = [5.642031564776303, 51.9733216807388]
      await expect(isFieldInDerogatieVrijeZone(locationOutside)).resolves.toBe(false)
    })
  })

  it("should return false for unknown geotiff codes in GWBG and Natura helpers", async () => {
    const getUnknownGeoTiffValue = async () => 99
    await expect(isFieldInGWGBGebied([5.0, 52.0], getUnknownGeoTiffValue)).resolves.toBe(false)
    await expect(isFieldInNatura2000Gebied([5.0, 52.0], getUnknownGeoTiffValue)).resolves.toBe(
      false,
    )
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

    await getNL2025DierlijkeMestGebruiksNorm(fdm, inputs)

    // setCachedCalculation is fire-and-forget so we need to wait a bit to make sure it is called.
    await new Promise((resolve) => {
      setTimeout(resolve, 200)
    })

    const cached = await getLatestCachedResultForEntity(
      fdm,
      "calculateNL2025DierlijkeMestGebruiksNorm",
      "field",
      b_id,
    )
    expect(cached).not.toBeNull()
  })
})
