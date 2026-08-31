import type { Field } from "@nmi-agro/fdm-core"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { NitrogenStandard, NL2025NormsInput, NL2025NormsInputForCultivation } from "./types"
import * as GeoTiff from "../../../../shared/geotiff"
import {
  calculateNL2025StikstofGebruiksNorm,
  getRegion,
  isFieldInNVGebied,
} from "./stikstofgebruiksnorm"

vi.mock("../../../../shared/geotiff", async (importActual) => {
  const actual = await importActual<typeof import("../../../../shared/geotiff")>()
  return {
    ...actual,
    getGeoTiffValue: vi.fn(actual.getGeoTiffValue),
  }
})

describe("stikstofgebruiksnorm helpers", () => {
  it("should correctly identify a field in an NV Gebied", async () => {
    const centroidInNV: [number, number] = [5.654709, 51.987605]
    // Known point in NV Gebied
    const result = await isFieldInNVGebied(centroidInNV)
    expect(result).toBe(true)
  })

  it("should correctly identify a field not in an NV Gebied", async () => {
    const centroidOutsideNV: [number, number] = [5.1, 52.1] // Known point outside NV Gebied
    const result = await isFieldInNVGebied(centroidOutsideNV)
    expect(result).toBe(false)
  })

  it("should correctly identify a field not in an NV Gebied, but with single array response (see #205)", async () => {
    const centroidOutsideNV: [number, number] = [5.5527872994244785, 52.92595151470198] // Known point outside NV Gebied
    const result = await isFieldInNVGebied(centroidOutsideNV)
    expect(result).toBe(false)
  })

  it("should correctly identify the region for a field", async () => {
    const centroidInKlei: [number, number] = [5.64188724, 51.977587] // Known point in Klei
    const region = await getRegion(centroidInKlei)
    expect(region).toBe("klei")
  })
})

import * as StikstofData from "./stikstofgebruiksnorm-data"

describe("calculateNL2025StikstofGebruiksNorm", () => {
  it("should return the correct norm for grasland (beweiden)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: true },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571],
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: new Date(2025, 0, 1), // Current year cultivation
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(345)
    expect(result.normSource).toEqual("Grasland (beweiden).")
  })

  it("should return the correct norm for grasland (volledig maaien)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571],
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: new Date(2025, 0, 1), // Current year cultivation
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(385)
    expect(result.normSource).toEqual("Grasland (volledig maaien).")
  })

  it("should return 0 for buffer strips", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571],
        b_bufferstrip: true,
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(0)
    expect(result.normSource).toEqual("Bufferstrook: geen plaatsingsruimte")
  })

  it("should return the correct norm for potatoes", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571],
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2015", // Pootaardappel
          b_lu_variety: "Adora",
          b_lu_start: new Date(2025, 0, 1), // Current year cultivation
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(140)
    expect(result.normSource).toEqual("Akkerbouwgewas, pootaardappelen (hoge norm).")
  })

  it("should apply 0 korting if winterteelt is present in zand_nwc region (hoofdteelt 2025)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: true },
      field: {
        b_id: "1",
        b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265", // Grasland (is_winterteelt: true)
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)

    // The base norm for Grasland in zand_nwc is 200 in nv-gebied.
    expect(result.normValue).toBe(200)
    expect(result.normSource).toContain("Grasland (beweiden)")
  })

  it("should apply 0 korting if Tijdelijk grasland is present in zand_nwc region", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_266", // Tijdelijk grasland
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)

    // Tijdelijk grasland "van 1 jan tot minstens 15 mei" -> 90 (zand_nwc standard), 72 (zand_nwc nv_area)
    // Should have no korting applied
    expect(result.normValue).toBe(72)
    expect(result.normSource).toContain("Tijdelijk grasland.")
  })

  it("should apply 0 korting if vanggewas is present (sown <= Oct 1st)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025 hoofdteelt)
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_428", // Gele mosterd (is_vanggewas: true)
          b_lu_start: new Date(2024, 9, 1), // Oct 1st, 2024
          b_lu_end: new Date(2025, 1, 31),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    // The base norm for Vruchtgewassen in zand_nwc is 108. With vanggewas sown <= Oct 1st, korting should be 0.
    expect(result.normValue).toBe(108)
    expect(result.normSource).toEqual(
      "Vruchtgewassen, Landbouwstambonen, rijp zaad. Geen korting: vanggewas gezaaid uiterlijk 1 oktober",
    )
  })

  it("should apply 5 korting if vanggewas is present (sown Oct 2nd - Oct 14th)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025 hoofdteelt)
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_428", // Gele mosterd (is_vanggewas: true)
          b_lu_start: new Date(2024, 9, 5), // Oct 5th, 2024
          b_lu_end: new Date(2025, 1, 31),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    // The base norm for Vruchtgewassen in zand_nwc in nv-gebied is 108. With vanggewas sown Oct 2-14, korting should be 5.
    expect(result.normValue).toBe(103) // 108 - 5
    expect(result.normSource).toEqual(
      "Vruchtgewassen, Landbouwstambonen, rijp zaad. Korting: 5kg N/ha, vanggewas gezaaid tussen 2 t/m 14 oktober",
    )
  })

  it("should apply 10 korting if vanggewas is present (sown Oct 15th - Oct 31st)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025 hoofdteelt)
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_428", // Gele mosterd (is_vanggewas: true)
          b_lu_start: new Date(2024, 9, 20), // Oct 20th, 2024
          b_lu_end: new Date(2025, 1, 31),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    // The base norm for Vruchtgewassen in zand_nwc in nv-gebied is 108. With vanggewas sown Oct 15-31, korting should be 10.
    expect(result.normValue).toBe(98) // 108 - 10
    expect(result.normSource).toEqual(
      "Vruchtgewassen, Landbouwstambonen, rijp zaad. Korting: 10kg N/ha, vanggewas gezaaid tussen 15 t/m 31 oktober",
    )
  })

  it("should apply 20 korting if vanggewas is present (sown Nov 1st or later)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025 hoofdteelt)
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_428", // Gele mosterd (is_vanggewas: true)
          b_lu_start: new Date(2024, 10, 1), // Nov 1st, 2024
          b_lu_end: new Date(2025, 1, 31),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    // The base norm for Vruchtgewassen in zand_nwc in nv-gebied is 108. With vanggewas sown Nov 1st+, korting should be 20.
    expect(result.normValue).toBe(88) // 108 - 20
    expect(result.normSource).toEqual(
      "Vruchtgewassen, Landbouwstambonen, rijp zaad. Korting: 20kg N/ha, vanggewas gezaaid op of na 1 november",
    )
  })

  it("should apply 20 korting if no winterteelt or vanggewas is present in zand_nwc region", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025 hoofdteelt)
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_234", // Zomertarwe (not winterteelt or vanggewas)
          b_lu_start: new Date(2024, 5, 1),
          b_lu_end: new Date(2024, 8, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    // The base norm for Vruchtgewassen in zand_nwc in nv-gebied is 108. With no exception, korting should be 20.
    expect(result.normValue).toBe(88) // 108 - 20
    expect(result.normSource).toEqual(
      "Vruchtgewassen, Landbouwstambonen, rijp zaad. Korting: 20kg N/ha: geen vanggewas of winterteelt",
    )
  })

  it("should not apply korting if region is not sandy or loess, even without winterteelt/vanggewas", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.648307588666836, 51.96484772224782], // This centroid is in 'klei'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025 hoofdteelt)
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_234", // Zomertarwe (not winterteelt or vanggewas)
          b_lu_start: new Date(2024, 5, 1),
          b_lu_end: new Date(2025, 1, 31),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    // The base norm for Vruchtgewassen in klei is 135. Korting should not apply in non-sandy/loess regions.
    expect(result.normValue).toBe(135)
    expect(result.normSource).toEqual("Vruchtgewassen, Landbouwstambonen, rijp zaad.")
  })

  it("should return the correct norm for Gras voor industriële verwerking (eerste jaar)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_3805", // Gras voor industriële verwerking
          b_lu_start: new Date(2025, 0, 1), // Current year cultivation
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(30)
    expect(result.normSource).toEqual(
      "Akkerbouwgewassen, Gras voor industriële verwerking (inzaai in september en eerste jaar).",
    )
  })

  it("should return the correct norm for Gras voor industriële verwerking (volgende jaren)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_3805", // Gras voor industriële verwerking (current year)
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_3805", // Gras voor industriële verwerking (previous year)
          b_lu_start: new Date(2024, 0, 1),
          b_lu_end: new Date(2024, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(310)
    expect(result.normSource).toEqual(
      "Akkerbouwgewassen, Gras voor industriële verwerking (inzaai voor 15 mei en volgende jaren).",
    )
  })

  it("should return the correct norm for Graszaad, Engels raaigras (1e jaars)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_6750", // Graszaad, Engels raaigras
          b_lu_start: new Date(2025, 0, 1), // Current year cultivation
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(165)
    expect(result.normSource).toEqual("Akkerbouwgewassen, Graszaad, Engels raaigras (1e jaars).")
  })

  it("should return the correct norm for Graszaad, Engels raaigras (overjarig)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_6750", // Graszaad, Engels raaigras (current year)
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_6750", // Graszaad, Engels raaigras (previous year)
          b_lu_start: new Date(2024, 0, 1),
          b_lu_end: new Date(2024, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(200)
    expect(result.normSource).toEqual("Akkerbouwgewassen, Graszaad, Engels raaigras (overjarig).")
  })

  it("should return the correct norm for Akkerbouwgewassen, Roodzwenkgras (1e jaars)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_6784", // Akkerbouwgewassen, Roodzwenkgras
          b_lu_start: new Date(2025, 0, 1), // Current year cultivation
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(85)
    expect(result.normSource).toEqual("Akkerbouwgewassen, Roodzwenkgras (1e jaars).")
  })

  it("should return the correct norm for Akkerbouwgewassen, Roodzwenkgras (overjarig)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_6784", // Akkerbouwgewassen, Roodzwenkgras (current year)
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_6784", // Akkerbouwgewassen, Roodzwenkgras (previous year)
          b_lu_start: new Date(2024, 0, 1),
          b_lu_end: new Date(2024, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(115)
    expect(result.normSource).toEqual("Akkerbouwgewassen, Roodzwenkgras (overjarig).")
  })

  it("should return the correct norm for Winterui (1e jaars)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_1932", // Winterui, 1e jaars
          b_lu_start: new Date(2025, 0, 1), // Current year cultivation
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(170)
    expect(result.normSource).toEqual(
      "Akkerbouwgewassen, Ui overig, zaaiui of winterui. (1e jaars).",
    )
  })

  it("should return the correct norm for Winterui (2e jaars)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_1933", // Winterui, 2e jaars
          b_lu_start: new Date(2025, 0, 1), // Current year cultivation
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(170)
    expect(result.normSource).toEqual(
      "Akkerbouwgewassen, Ui overig, zaaiui of winterui. (2e jaars).",
    )
  })

  it("should return the correct norm for Bladgewassen, Spinazie (1e teelt)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2773", // Bladgewassen, Spinazie
          b_lu_start: new Date(2025, 4, 15), // May 15th, 2025 (hoofdteelt)
          b_lu_end: new Date(2025, 6, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(260)
    expect(result.normSource).toEqual("Bladgewassen, Spinazie (1e teelt).")
  })

  it("should return the correct norm for Bladgewassen, Slasoorten (1e teelt)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2767", // Bladgewassen, Slasoorten
          b_lu_start: new Date(2025, 4, 15), // May 15th, 2025 (hoofdteelt)
          b_lu_end: new Date(2025, 6, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(180)
    expect(result.normSource).toEqual("Bladgewassen, Slasoorten (1e teelt).")
  })

  it("should return the correct norm for Bladgewassen, Andijvie eerste teelt volgteelt (1e teelt)", async () => {
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2708", // Bladgewassen, Andijvie eerste teelt volgteelt
          b_lu_start: new Date(2025, 4, 15), // May 15th, 2025 (hoofdteelt)
          b_lu_end: new Date(2025, 6, 1),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(180)
    expect(result.normSource).toEqual("Bladgewassen, Andijvie eerste teelt volgteelt (1e teelt).")
  })

  describe("Tijdelijk grasland time-based matching", () => {
    const kleiCentroid: [number, number] = [5.6279889, 51.975571] // Klei region

    it("should select the highest norm (longest period) for full-year temporary grassland", async () => {
      // Matches "van 1 jan tot minstens 15 okt" -> 310 (Klei)
      const mockInput: NL2025NormsInput = {
        farm: {
          is_derogatie_bedrijf: false,
          has_grazing_intention: false,
        },
        field: { b_id: "1", b_centroid: kleiCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_266", // Tijdelijk grasland
            b_lu_start: new Date(2025, 0, 1), // Jan 1
            b_lu_end: new Date(2025, 11, 31), // Dec 31
          } as Partial<NL2025NormsInputForCultivation>,
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normValue).toBe(310) // Klei standard for "van 1 jan tot minstens 15 okt"
    })

    it("should select the correct norm for a period ending in May (tot minstens 15 mei)", async () => {
      // Matches "van 1 jan tot minstens 15 mei" -> 110 (Klei)
      // Should NOT match "tot minstens 15 augustus"
      const mockInput: NL2025NormsInput = {
        farm: {
          is_derogatie_bedrijf: false,
          has_grazing_intention: false,
        },
        field: { b_id: "1", b_centroid: kleiCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_266", // Tijdelijk grasland
            b_lu_start: new Date(2025, 0, 1), // Jan 1
            b_lu_end: new Date(2025, 4, 20), // May 20
          } as Partial<NL2025NormsInputForCultivation>,
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normValue).toBe(110) // Klei standard for "van 1 jan tot minstens 15 mei"
    })

    it("should select the correct norm for a late sown crop (vanaf 15 oktober)", async () => {
      // Matches "vanaf 15 oktober" -> 0 (Klei)
      const mockInput: NL2025NormsInput = {
        farm: {
          is_derogatie_bedrijf: false,
          has_grazing_intention: false,
        },
        field: { b_id: "1", b_centroid: kleiCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_266", // Tijdelijk grasland
            b_lu_start: new Date(2025, 9, 20), // Oct 20
            b_lu_end: new Date(2025, 11, 31), // Dec 31
          } as Partial<NL2025NormsInputForCultivation>,
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normValue).toBe(0) // Klei standard for "vanaf 15 oktober"
    })

    it("should handle start dates from previous year correctly (van 1 januari)", async () => {
      // Started in 2024, still present in 2025 until Aug 20.
      // Matches "van 1 jan tot minstens 15 aug" -> 250 (Klei)
      const mockInput: NL2025NormsInput = {
        farm: {
          is_derogatie_bedrijf: false,
          has_grazing_intention: false,
        },
        field: { b_id: "1", b_centroid: kleiCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_266", // Tijdelijk grasland
            b_lu_start: new Date(2024, 8, 1), // Sept 1, 2024
            b_lu_end: new Date(2025, 7, 20), // Aug 20, 2025
          } as Partial<NL2025NormsInputForCultivation>,
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normValue).toBe(250) // Klei standard for "van 1 jan tot minstens 15 aug"
    })

    it("should select the correct norm for a summer crop (vanaf 15 april tot minstens 15 oktober)", async () => {
      // Matches "vanaf 15 april tot minstens 15 oktober" -> 310 (Klei)
      const mockInput: NL2025NormsInput = {
        farm: {
          is_derogatie_bedrijf: false,
          has_grazing_intention: false,
        },
        field: { b_id: "1", b_centroid: kleiCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_266", // Tijdelijk grasland
            b_lu_start: new Date(2025, 3, 20), // April 20
            b_lu_end: new Date(2025, 9, 20), // Oct 20
          } as Partial<NL2025NormsInputForCultivation>,
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normValue).toBe(310)
    })

    it("should handle explicit zero values for period days/months (regression test for falsy bug)", async () => {
      // Mock data with explicit zero in period_start_month or period_start_day
      const mockData: NitrogenStandard[] = [
        {
          b_lu_catalogue_match: ["nl_zero_test"],
          cultivation_rvo_table2: "Zero Test Crop",
          norms: {
            klei: { standard: 100, nv_area: 80 },
            loess: { standard: 100, nv_area: 80 },
            veen: { standard: 100, nv_area: 80 },
            zand_nwc: { standard: 100, nv_area: 80 },
            zand_zuid: { standard: 100, nv_area: 80 },
          },
          sub_types: [
            {
              omschrijving: "zero_period",
              // Use explicit zero values that would fail with !! check
              period_start_month: 0 as any,
              period_start_day: 0 as any,
              period_end_month: 12,
              period_end_day: 31,
              norms: {
                klei: { standard: 200, nv_area: 160 },
                loess: { standard: 200, nv_area: 160 },
                veen: { standard: 200, nv_area: 160 },
                zand_nwc: { standard: 200, nv_area: 160 },
                zand_zuid: { standard: 200, nv_area: 160 },
              },
            },
          ],
        } as any,
      ]

      const spy = vi
        .spyOn(StikstofData, "nitrogenStandardsData", "get")
        .mockReturnValue(mockData as any)

      const mockInput: NL2025NormsInput = {
        farm: {
          is_derogatie_bedrijf: false,
          has_grazing_intention: false,
        },
        field: { b_id: "1", b_centroid: kleiCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_zero_test",
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 11, 31),
          } as Partial<NL2025NormsInputForCultivation>,
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)

      // Should match the 200 norm from the sub_type with zero-valued periods
      expect(result.normValue).toBe(200)
      expect(result.normSource).toContain("Zero Test Crop")

      spy.mockRestore()
    })
  })
})

const sandCentroid: [number, number] = [5.656346970245633, 51.987872886419524] // zand_nwc
const clayCentroid: [number, number] = [5.64188724, 51.977587] // klei

describe("calculateNL2025StikstofGebruiksNorm - Korting Logic", () => {
  describe("Grassland Renewal (Gras-na-Gras) - 50 kg N/ha", () => {
    it("should apply 50 discount on Sand (June 1 - Aug 31)", async () => {
      const mockInput: NL2025NormsInput = {
        farm: {
          is_derogatie_bedrijf: false,
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: sandCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 5, 15), // June 15
          },
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2025, 5, 16),
            b_lu_end: new Date(2025, 11, 31),
          },
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      // Expect korting of 50. Base might be 320 (zand_nwc, maaien).
      // 320 - 50 = 270.
      expect(result.normSource).toContain("Korting: 50kg N/ha: graslandvernieuwing")
    })

    it("should apply 50 discount on Clay (Derogation + NV: June 1 - Aug 31)", async () => {
      const mockInput: NL2025NormsInput = {
        farm: {
          is_derogatie_bedrijf: true,
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: clayCentroid, // Non-NV
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 7, 1), // Aug 1 (inside June 1 - Aug 31)
          },
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2025, 7, 2),
            b_lu_end: new Date(2025, 11, 31),
          },
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Korting: 50kg N/ha: graslandvernieuwing")
    })

    it("should not apply renewal discount for invalid renewal date on Sand", async () => {
      const mockInput: NL2025NormsInput = {
        farm: {
          is_derogatie_bedrijf: false,
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: sandCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 4, 15), // May 15 (Too early, outside June 1 - Aug 31)
          },
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2025, 4, 16),
            b_lu_end: new Date(2025, 11, 31),
          },
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normSource).not.toContain("graslandvernieuwing")
      expect(result.normValue).toBe(256)
    })
  })

  describe("Conditional Winter Crops (Beet & Maize with undersowing)", () => {
    it("should resolve correct year-specific cultivation when same crop code (e.g. nl_256) exists in consecutive years", async () => {
      const mockInput: NL2025NormsInput = {
        farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
        field: { b_id: "1", b_centroid: sandCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_256", // Sugar beet in 2024 harvested Nov 5 (>= Nov 1 -> exempt)
            b_lu_start: new Date(2024, 3, 1),
            b_lu_end: new Date(2024, 10, 5),
          },
          {
            b_lu_catalogue: "nl_256", // Sugar beet in 2025 (hoofdteelt 2025)
            b_lu_start: new Date(2025, 3, 1),
            b_lu_end: new Date(2025, 9, 10), // Oct 10, 2025
          },
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Geen korting: winterteelt aanwezig in voorafgaand jaar")
    })

    it("should apply 0 korting if sugar beet was harvested on or after Nov 1 in preceding year", async () => {
      const mockInput: NL2025NormsInput = {
        farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
        field: { b_id: "1", b_centroid: sandCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_256", // Sugar beet (hoofdteelt 2024)
            b_lu_start: new Date(2024, 3, 1),
            b_lu_end: new Date(2024, 10, 5), // Harvested Nov 5, 2024 (>= Nov 1)
          },
          {
            b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025)
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 5, 1),
          },
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Geen korting: winterteelt aanwezig in voorafgaand jaar")
    })

    it("should apply 20 korting if sugar beet was harvested before Nov 1 and no catch crop was grown", async () => {
      const mockInput: NL2025NormsInput = {
        farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
        field: { b_id: "1", b_centroid: sandCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_256", // Sugar beet (hoofdteelt 2024)
            b_lu_start: new Date(2024, 3, 1),
            b_lu_end: new Date(2024, 9, 10), // Harvested Oct 10, 2024 (< Nov 1)
          },
          {
            b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025)
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 5, 1),
          },
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Korting: 20kg N/ha: geen vanggewas of winterteelt")
    })

    it("should apply 0 korting if maize in preceding year had undersowing", async () => {
      const mockInput: NL2025NormsInput = {
        farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
        field: { b_id: "1", b_centroid: sandCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_316", // Grain maize (hoofdteelt 2024)
            b_lu_start: new Date(2024, 4, 1),
            b_lu_end: new Date(2024, 9, 15),
          },
          {
            b_lu_catalogue: "nl_428", // Undersown grass/catch crop
            b_lu_start: new Date(2024, 5, 1), // Sown during maize
            b_lu_end: new Date(2025, 1, 1), // Stands until Feb 1
          },
          {
            b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025)
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 5, 1),
          },
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Geen korting: winterteelt aanwezig in voorafgaand jaar")
    })

    it("should apply 20 korting if maize in preceding year had no undersowing and no catch crop", async () => {
      const mockInput: NL2025NormsInput = {
        farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
        field: { b_id: "1", b_centroid: sandCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_316", // Grain maize (hoofdteelt 2024) without undersowing
            b_lu_start: new Date(2024, 4, 1),
            b_lu_end: new Date(2024, 9, 15),
          },
          {
            b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025)
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 5, 1),
          },
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Korting: 20kg N/ha: geen vanggewas of winterteelt")
    })
  })

  describe("Cumulative kortingen", () => {
    it("should cumulate grassland renewal discount (50) with catch crop discount (20) when both apply on Sand", async () => {
      const mockInput: NL2025NormsInput = {
        farm: {
          is_derogatie_bedrijf: false,
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: sandCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_2014", // Potatoes in 2024 (hoofdteelt 2024, not a winter crop)
            b_lu_start: new Date(2024, 3, 1),
            b_lu_end: new Date(2024, 8, 1),
          },
          {
            b_lu_catalogue: "nl_265", // Grass 1 sown in spring 2025 (no crop over winter)
            b_lu_start: new Date(2025, 3, 1), // April 1, 2025
            b_lu_end: new Date(2025, 5, 15), // June 15, 2025
          },
          {
            b_lu_catalogue: "nl_265", // Grass 2 in 2025 (Grassland renewal on June 15)
            b_lu_start: new Date(2025, 5, 16),
            b_lu_end: new Date(2025, 11, 31),
          },
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      // Grassland (volledig maaien) base norm on zand_nwc NV area is 256.
      // 256 - (50 + 20) = 186.
      expect(result.normValue).toBe(186)
      expect(result.normSource).toContain("Korting: 50kg N/ha: graslandvernieuwing")
      expect(result.normSource).toContain("Korting: 20kg N/ha: geen vanggewas of winterteelt")
    })
  })

  describe("Grassland Destruction (Gras-naar-Bouwland) - 65 kg N/ha", () => {
    it("should apply 65 discount on Sand (Maize, Feb 1 - May 10)", async () => {
      const mockInput: NL2025NormsInput = {
        farm: {
          is_derogatie_bedrijf: false,
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: sandCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 1, 15), // Feb 15
          },
          {
            b_lu_catalogue: "nl_259", // Maize (Snijmais)
            b_lu_start: new Date(2025, 1, 16),
            b_lu_end: new Date(2025, 9, 1),
          },
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Korting: 65kg N/ha: graslandvernietiging")
    })

    it("should apply 65 discount on Clay for derogation farm (Consumption Potato, Feb 1 - May 31)", async () => {
      const mockInput: NL2025NormsInput = {
        farm: {
          is_derogatie_bedrijf: true,
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: clayCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 3, 15), // April 15
          },
          {
            b_lu_catalogue: "nl_2014", // Consumption Potato
            b_lu_variety: "Agria", // Low norm
            b_lu_start: new Date(2025, 3, 16),
            b_lu_end: new Date(2025, 9, 1),
          },
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Korting: 65kg N/ha: graslandvernietiging")
    })

    it("should NOT apply 65 destruction discount on Clay without derogation permit", async () => {
      const mockInput: NL2025NormsInput = {
        farm: {
          is_derogatie_bedrijf: false,
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: clayCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 3, 15), // April 15
          },
          {
            b_lu_catalogue: "nl_2014", // Consumption Potato
            b_lu_variety: "Agria", // Low norm
            b_lu_start: new Date(2025, 3, 16),
            b_lu_end: new Date(2025, 9, 1),
          },
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normSource).not.toContain("graslandvernietiging")
    })

    it("should NOT apply discount for Seed Potatoes", async () => {
      const mockInput: NL2025NormsInput = {
        farm: {
          is_derogatie_bedrijf: false,
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: sandCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 1, 15), // Feb 15
          },
          {
            b_lu_catalogue: "nl_2015", // Seed Potato
            b_lu_variety: "Adora",
            b_lu_start: new Date(2025, 1, 16),
            b_lu_end: new Date(2025, 9, 1),
          },
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normSource).not.toContain("graslandvernietiging")
    })

    it("should not apply destruction discount for invalid destruction date on Sand", async () => {
      const mockInput: NL2025NormsInput = {
        farm: {
          is_derogatie_bedrijf: false,
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: sandCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 5, 1), // June 1 (Too late)
          },
          {
            b_lu_catalogue: "nl_259", // Maize
            b_lu_start: new Date(2025, 5, 2),
            b_lu_end: new Date(2025, 9, 1),
          },
        ] as NL2025NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
      expect(result.normSource).not.toContain("graslandvernietiging")
      expect(result.normValue).toBe(368)
    })
  })
})

describe("calculateNL2025StikstofGebruiksNorm - Additional Korting Edge Cases", () => {
  afterEach(() => {
    vi.mocked(GeoTiff.getGeoTiffValue).mockClear()
  })

  // Helper to mock Region and NV status
  const setupMock = (regionCode: number, nvCode: number) => {
    vi.mocked(GeoTiff.getGeoTiffValue).mockImplementation(async (url: string) => {
      if (url.includes("grondsoorten")) return regionCode // 1=Klei, 4=Zand
      if (url.includes("nv.tiff")) return nvCode // 1=NV, 0=Non-NV
      return 0
    })
  }

  const sandCentroid: [number, number] = [5.656346970245633, 51.987872886419524]

  it("should apply 20 korting if vanggewas is removed before Feb 1st", async () => {
    setupMock(4, 0) // Sand, Non-NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: sandCentroid,
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2751", // Vruchtgewassen
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_428", // Gele mosterd (vanggewas)
          b_lu_start: new Date(2024, 9, 1), // Oct 1
          b_lu_end: new Date(2025, 0, 15), // Jan 15 (Removed before Feb 1)
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normSource).toContain("Korting: 20kg N/ha: vanggewas staat niet tot 1 februari")
  })

  it("should apply 0 korting if vanggewas is sown by October 1 (e.g. after early potatoes)", async () => {
    setupMock(4, 0) // Sand, Non-NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: sandCentroid,
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_1911", // Early potatoes (2024 hoofdteelt)
          b_lu_start: new Date(2024, 3, 1), // April 1, 2024
          b_lu_end: new Date(2024, 6, 5), // July 5, 2024
        } as Partial<NL2025NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025 hoofdteelt)
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 5, 1),
        } as Partial<NL2025NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_428", // Gele mosterd (sown July 10, after early potatoes and before Oct 1)
          b_lu_start: new Date(2024, 6, 10), // July 10 (Sown before Oct 1)
          b_lu_end: new Date(2025, 1, 15),
        } as Partial<NL2025NormsInputForCultivation>,
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normSource).toContain("Geen korting: vanggewas gezaaid uiterlijk 1 oktober")
  })

  it("should not apply 50 discount for Graslandvernieuwing on Clay (No Derogation) - Valid Date (Feb 10)", async () => {
    setupMock(1, 0) // Clay, Non-NV
    const mockInput: NL2025NormsInput = {
      farm: {
        is_derogatie_bedrijf: false,
        has_grazing_intention: false,
      },
      field: {
        b_id: "1",
        b_centroid: sandCentroid,
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265", // Grass
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 1, 10), // Feb 10
        },
        {
          b_lu_catalogue: "nl_265", // Grass
          b_lu_start: new Date(2025, 1, 11),
          b_lu_end: new Date(2025, 11, 31),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normSource).not.toContain("graslandvernieuwing")
  })

  it("should not apply discount or throw for Graslandvernieuwing on Clay (No Derogation) - Invalid Date (Jan 20)", async () => {
    setupMock(1, 0) // Clay, Non-NV
    const mockInput: NL2025NormsInput = {
      farm: {
        is_derogatie_bedrijf: false,
        has_grazing_intention: false,
      },
      field: {
        b_id: "1",
        b_centroid: sandCentroid,
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265", // Grass
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 0, 20), // Jan 20 (Too early, starts Feb 1)
        },
        {
          b_lu_catalogue: "nl_265", // Grass
          b_lu_start: new Date(2025, 0, 21),
          b_lu_end: new Date(2025, 11, 31),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normSource).not.toContain("graslandvernieuwing")
  })

  it("should apply 50 discount for Graslandvernieuwing on Clay (Derogation + NV) - Valid Date (Aug 15)", async () => {
    setupMock(1, 1) // Clay, NV
    const mockInput: NL2025NormsInput = {
      farm: {
        is_derogatie_bedrijf: true,
        has_grazing_intention: false,
      },
      field: {
        b_id: "1",
        b_centroid: sandCentroid,
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265", // Grass
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 7, 15), // Aug 15
        },
        {
          b_lu_catalogue: "nl_265", // Grass
          b_lu_start: new Date(2025, 7, 16),
          b_lu_end: new Date(2025, 11, 31),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normSource).toContain("Korting: 50kg N/ha: graslandvernieuwing")
  })

  it("should not apply discount or throw for Graslandvernieuwing on Clay (Derogation + NV) - Invalid Date (Sep 10)", async () => {
    setupMock(1, 1) // Clay, NV
    const mockInput: NL2025NormsInput = {
      farm: {
        is_derogatie_bedrijf: true,
        has_grazing_intention: false,
      },
      field: {
        b_id: "1",
        b_centroid: sandCentroid,
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265", // Grass
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 8, 10), // Sep 10 (Too late, ends Aug 31)
        },
        {
          b_lu_catalogue: "nl_265", // Grass
          b_lu_start: new Date(2025, 8, 11),
          b_lu_end: new Date(2025, 11, 31),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normSource).not.toContain("graslandvernieuwing")
  })

  it("should apply 65 discount for Graslandvernietiging on Clay (NV) for derogation farm - Valid Date (Mar 10)", async () => {
    setupMock(1, 1) // Clay, NV
    const mockInput: NL2025NormsInput = {
      farm: {
        is_derogatie_bedrijf: true,
        has_grazing_intention: false,
      },
      field: {
        b_id: "1",
        b_centroid: sandCentroid,
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

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normSource).toContain("Korting: 65kg N/ha: graslandvernietiging")
  })

  it("should not apply discount or throw for Graslandvernietiging on Clay (NV) - Invalid Date (Mar 20)", async () => {
    setupMock(1, 1) // Clay, NV
    const mockInput: NL2025NormsInput = {
      farm: {
        is_derogatie_bedrijf: false,
        has_grazing_intention: false,
      },
      field: {
        b_id: "1",
        b_centroid: sandCentroid,
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265", // Grass
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 2, 20), // Mar 20 (Too late, ends Mar 15)
        },
        {
          b_lu_catalogue: "nl_259", // Maize
          b_lu_start: new Date(2025, 2, 21),
          b_lu_end: new Date(2025, 9, 1),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normSource).not.toContain("graslandvernietiging")
  })
})

const centroid: [number, number] = [5.6, 52.0]

const regionNorms = (value: number) => ({
  klei: { standard: value, nv_area: value },
  loess: { standard: value, nv_area: value },
  veen: { standard: value, nv_area: value },
  zand_nwc: { standard: value, nv_area: value },
  zand_zuid: { standard: value, nv_area: value },
})

const setupGeoMock = (regionCode: number, nvCode: number) => {
  vi.spyOn(GeoTiff, "getGeoTiffValue").mockImplementation(async (url: string) => {
    if (url.includes("grondsoorten")) return regionCode
    if (url.includes("nv.tiff")) return nvCode
    return 0
  })
}

const baseInput = (
  cultivations: NL2025NormsInputForCultivation[],
  farm: NL2025NormsInput["farm"] = {
    is_derogatie_bedrijf: false,
    has_grazing_intention: false,
  },
): NL2025NormsInput => ({
  farm,
  field: { b_id: "field-1", b_centroid: centroid } as Field,
  cultivations,
  soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
})

const spyNitrogenStandards = (standards: unknown[]) =>
  vi.spyOn(StikstofData, "nitrogenStandardsData", "get").mockReturnValue(standards as any)

describe("NL2025 stikstof additional branch coverage", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("handles unknown NV codes and additional region mappings", async () => {
    vi.spyOn(GeoTiff, "getGeoTiffValue").mockResolvedValueOnce(9)
    await expect(isFieldInNVGebied(centroid)).resolves.toBe(false)

    vi.spyOn(GeoTiff, "getGeoTiffValue").mockResolvedValueOnce(2)
    await expect(getRegion(centroid)).resolves.toBe("loess")
    vi.spyOn(GeoTiff, "getGeoTiffValue").mockResolvedValueOnce(3)
    await expect(getRegion(centroid)).resolves.toBe("veen")
    vi.spyOn(GeoTiff, "getGeoTiffValue").mockResolvedValueOnce(5)
    await expect(getRegion(centroid)).resolves.toBe("zand_zuid")
    vi.spyOn(GeoTiff, "getGeoTiffValue").mockResolvedValueOnce(99)
    await expect(getRegion(centroid)).rejects.toThrow("Unknown region code")
  })

  it("throws when no matching nitrogen standard exists", async () => {
    setupGeoMock(1, 0)
    await expect(
      calculateNL2025StikstofGebruiksNorm(
        baseInput([
          {
            b_lu_catalogue: "nl_unknown",
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 8, 1),
          } as NL2025NormsInputForCultivation,
        ]),
      ),
    ).rejects.toThrow("No matching nitrogen standard found for b_lu_catalogue nl_unknown.")
  })

  it("uses potato fallback subtype 'overig' when variety is unknown", async () => {
    setupGeoMock(1, 0)
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_potato_test"],
        cultivation_rvo_table2: "Potato test",
        type: "aardappel",
        norms: regionNorms(0),
        sub_types: [
          { omschrijving: "vroeg", varieties: ["adora"], norms: regionNorms(120) },
          { omschrijving: "overig", norms: regionNorms(140) },
        ],
      } as unknown as NitrogenStandard,
    ])

    const result = await calculateNL2025StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_potato_test",
          b_lu_variety: "not-listed",
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 6, 1),
        } as NL2025NormsInputForCultivation,
      ]),
    )

    expect(result.normValue).toBe(140)
    expect(result.normSource).toBe("Potato test (overig).")
    dataSpy.mockRestore()
  })

  it("resolves luzerne and koolzaad subtypes from input details", async () => {
    setupGeoMock(1, 0)
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_luzerne_test"],
        cultivation_rvo_table2: "Akkerbouwgewassen, Luzerne",
        norms: regionNorms(0),
        sub_types: [
          { omschrijving: "eerste jaar", norms: regionNorms(100) },
          { omschrijving: "volgende jaren", norms: regionNorms(200) },
        ],
      },
      {
        b_lu_catalogue_match: ["nl_1922", "nl_1923"],
        cultivation_rvo_table2: "Akkerbouwgewassen, koolzaad",
        norms: regionNorms(0),
        sub_types: [
          { omschrijving: "winter", norms: regionNorms(170) },
          { omschrijving: "zomer", norms: regionNorms(140) },
        ],
      },
    ] as unknown as NitrogenStandard[])

    const luzerne = await calculateNL2025StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_luzerne_test",
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 10, 1),
        } as NL2025NormsInputForCultivation,
        {
          b_lu_catalogue: "nl_luzerne_test",
          b_lu_start: new Date(2024, 0, 1),
          b_lu_end: new Date(2024, 10, 1),
        } as NL2025NormsInputForCultivation,
      ]),
    )
    expect(luzerne.normSource).toBe("Akkerbouwgewassen, Luzerne (volgende jaren).")
    expect(luzerne.normValue).toBe(200)

    const koolzaad = await calculateNL2025StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_1923",
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 10, 1),
        } as NL2025NormsInputForCultivation,
      ]),
    )
    expect(koolzaad.normSource).toBe("Akkerbouwgewassen, koolzaad (zomer).")
    expect(koolzaad.normValue).toBe(140)

    dataSpy.mockRestore()
  })

  it("evaluates wrap-around period definitions while selecting the best matching subtype", async () => {
    setupGeoMock(1, 0)
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_2751"],
        cultivation_rvo_table2: "Wrap crop",
        norms: regionNorms(0),
        sub_types: [
          {
            omschrijving: "late",
            period_start_month: 11,
            period_start_day: 1,
            period_end_month: 2,
            period_end_day: 1,
            norms: regionNorms(300),
          },
          {
            omschrijving: "earlier",
            period_start_month: 10,
            period_start_day: 15,
            period_end_month: 2,
            period_end_day: 1,
            norms: regionNorms(280),
          },
          {
            omschrijving: "full-year",
            period_start_month: 1,
            period_start_day: 1,
            period_end_month: 12,
            period_end_day: 31,
            norms: regionNorms(260),
          },
        ],
      } as unknown as NitrogenStandard,
    ])

    const result = await calculateNL2025StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_2751",
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 11, 31),
        } as NL2025NormsInputForCultivation,
      ]),
    )
    expect(result.normValue).toBe(260)

    dataSpy.mockRestore()
  })

  it("throws for undefined applicable norms and missing region norms", async () => {
    setupGeoMock(5, 0) // zand_zuid
    const dataSpy = vi.spyOn(StikstofData, "nitrogenStandardsData", "get")

    dataSpy.mockReturnValueOnce([
      {
        b_lu_catalogue_match: ["nl_no_norm_match"],
        cultivation_rvo_table2: "No match crop",
        norms: regionNorms(100),
        sub_types: [
          {
            omschrijving: "wrap-no-match",
            period_start_month: 11,
            period_start_day: 1,
            period_end_month: 2,
            period_end_day: 1,
            norms: regionNorms(120),
          },
        ],
      } as unknown as NitrogenStandard,
    ] as any)

    await expect(
      calculateNL2025StikstofGebruiksNorm(
        baseInput([
          {
            b_lu_catalogue: "nl_no_norm_match",
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 6, 1),
          } as NL2025NormsInputForCultivation,
        ]),
      ),
    ).rejects.toThrow("Applicable norms object is undefined for No match crop in region zand_zuid.")

    dataSpy.mockReturnValueOnce([
      {
        b_lu_catalogue_match: ["nl_region_gap"],
        cultivation_rvo_table2: "Region gap crop",
        norms: { klei: { standard: 100, nv_area: 100 } },
      } as unknown as NitrogenStandard,
    ] as any)
    await expect(
      calculateNL2025StikstofGebruiksNorm(
        baseInput([
          {
            b_lu_catalogue: "nl_region_gap",
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 8, 1),
          } as NL2025NormsInputForCultivation,
        ]),
      ),
    ).rejects.toThrow("No norms found for region zand_zuid for Region gap crop.")
  })

  it("clamps negative norm values to zero after korting", async () => {
    setupGeoMock(4, 0) // zand_nwc, non-NV
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_floor_crop"],
        cultivation_rvo_table2: "Floor crop",
        norms: regionNorms(10),
      } as unknown as NitrogenStandard,
    ])

    const result = await calculateNL2025StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_234",
          b_lu_start: new Date(2024, 3, 1),
          b_lu_end: new Date(2024, 8, 1),
        } as NL2025NormsInputForCultivation,
        {
          b_lu_catalogue: "nl_floor_crop",
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 8, 1),
        } as NL2025NormsInputForCultivation,
      ]),
    )

    expect(result.normValue).toBe(0)
    expect(result.normSource).toContain("Korting: 20kg N/ha: geen vanggewas of winterteelt")
    dataSpy.mockRestore()
  })

  it("falls back from unmatched maize subtype and uses default cultivation dates", async () => {
    setupGeoMock(1, 0)
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_maize_custom"],
        cultivation_rvo_table2: "Akkerbouwgewassen, mais",
        norms: regionNorms(0),
        sub_types: [
          { omschrijving: "niet-derogatie", norms: regionNorms(111) },
          { omschrijving: "zonder-periode", norms: regionNorms(112) },
          { period_start_month: 1, period_end_month: 12, norms: regionNorms(160) },
          { period_start_month: 3, period_end_month: 11, norms: regionNorms(170) },
        ],
      } as unknown as NitrogenStandard,
    ])

    const result = await calculateNL2025StikstofGebruiksNorm(
      baseInput(
        [
          {
            b_lu_catalogue: "nl_maize_custom",
            b_lu_start: null,
            b_lu_end: null,
          } as unknown as NL2025NormsInputForCultivation,
        ],
        { is_derogatie_bedrijf: true, has_grazing_intention: false },
      ),
    )

    expect(result.normValue).toBe(160)
    expect(result.normSource).toBe("Akkerbouwgewassen, mais (derogatie).")
    dataSpy.mockRestore()
  })

  it("handles multiple matching standards and chooses the earliest matching period", async () => {
    setupGeoMock(1, 0)
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_multi_maize"],
        cultivation_rvo_table2: "Akkerbouwgewassen, mais",
        norms: regionNorms(0),
        sub_types: [
          {
            omschrijving: "",
            varieties: ["flag-second-operand"],
            period_start_month: 3,
            period_end_month: 11,
            norms: regionNorms(190),
          },
          {
            omschrijving: "later",
            period_start_month: 4,
            period_end_month: 10,
            norms: regionNorms(210),
          },
        ],
      } as unknown as NitrogenStandard,
      {
        b_lu_catalogue_match: ["nl_multi_maize"],
        cultivation_rvo_table2: "Fallback standard",
        norms: regionNorms(80),
      } as unknown as NitrogenStandard,
    ])

    const result = await calculateNL2025StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_multi_maize",
          b_lu_start: new Date(2025, 4, 1),
          b_lu_end: new Date(2025, 10, 30),
        } as NL2025NormsInputForCultivation,
      ]),
    )

    expect(result.normValue).toBe(190)
    expect(result.normSource).toBe("Akkerbouwgewassen, mais (geen derogatie).")
    dataSpy.mockRestore()
  })

  it("covers first-year subtype paths for luzerne, winter koolzaad and winterui", async () => {
    setupGeoMock(1, 0)
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_luzerne_first"],
        cultivation_rvo_table2: "Akkerbouwgewassen, Luzerne",
        norms: regionNorms(0),
        sub_types: [
          { omschrijving: "eerste jaar", norms: regionNorms(95) },
          { omschrijving: "volgende jaren", norms: regionNorms(180) },
        ],
      },
      {
        b_lu_catalogue_match: ["nl_1922", "nl_1923"],
        cultivation_rvo_table2: "Akkerbouwgewassen, koolzaad",
        norms: regionNorms(0),
        sub_types: [
          { omschrijving: "winter", norms: regionNorms(170) },
          { omschrijving: "zomer", norms: regionNorms(140) },
        ],
      },
      {
        b_lu_catalogue_match: ["nl_1932", "nl_1933"],
        cultivation_rvo_table2: "Akkerbouwgewassen, Ui overig, zaaiui of winterui.",
        norms: regionNorms(0),
        sub_types: [
          { omschrijving: "1e jaars", norms: regionNorms(120) },
          { omschrijving: "2e jaars", norms: regionNorms(110) },
        ],
      },
    ] as unknown as NitrogenStandard[])

    const luzerne = await calculateNL2025StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_luzerne_first",
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 10, 1),
        } as NL2025NormsInputForCultivation,
      ]),
    )
    expect(luzerne.normSource).toBe("Akkerbouwgewassen, Luzerne (eerste jaar).")

    const koolzaad = await calculateNL2025StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_1922",
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 10, 1),
        } as NL2025NormsInputForCultivation,
      ]),
    )
    expect(koolzaad.normSource).toBe("Akkerbouwgewassen, koolzaad (winter).")

    const winterui = await calculateNL2025StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_1932",
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 8, 1),
        } as NL2025NormsInputForCultivation,
      ]),
    )
    expect(winterui.normSource).toBe(
      "Akkerbouwgewassen, Ui overig, zaaiui of winterui. (1e jaars).",
    )
    dataSpy.mockRestore()
  })

  it("applies clay renewal korting on derogation farms outside NV areas", async () => {
    setupGeoMock(1, 0) // klei, non-NV
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_265"],
        cultivation_rvo_table2: "Grasland",
        type: "grasland",
        norms: regionNorms(260),
        sub_types: [{ omschrijving: "volledig maaien", norms: regionNorms(260) }],
      },
      {
        b_lu_catalogue_match: ["nl_266"],
        cultivation_rvo_table2: "Tijdelijk grasland",
        type: "grasland",
        norms: regionNorms(260),
        sub_types: [{ omschrijving: "volledig maaien", norms: regionNorms(260) }],
      },
    ] as unknown as NitrogenStandard[])

    const result = await calculateNL2025StikstofGebruiksNorm(
      baseInput(
        [
          {
            b_lu_catalogue: "nl_265",
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 6, 1),
          } as NL2025NormsInputForCultivation,
          {
            b_lu_catalogue: "nl_266",
            b_lu_start: new Date(2025, 6, 2),
            b_lu_end: new Date(2025, 11, 31),
          } as NL2025NormsInputForCultivation,
        ],
        { is_derogatie_bedrijf: true, has_grazing_intention: false },
      ),
    )

    expect(result.normValue).toBe(210)
    expect(result.normSource).toContain("Korting: 50kg N/ha: graslandvernieuwing")
    dataSpy.mockRestore()
  })

  it("applies clay destruction korting for maize in both NV and non-NV for derogation farms", async () => {
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_265"],
        cultivation_rvo_table2: "Grasland",
        type: "grasland",
        norms: regionNorms(260),
        sub_types: [{ omschrijving: "volledig maaien", norms: regionNorms(260) }],
      },
      {
        b_lu_catalogue_match: ["nl_maize_dest"],
        cultivation_rvo_table2: "Akkerbouwgewassen, mais",
        norms: regionNorms(220),
        sub_types: [
          { omschrijving: "geen derogatie", norms: regionNorms(220) },
          { omschrijving: "derogatie", norms: regionNorms(220) },
        ],
      },
    ] as unknown as NitrogenStandard[])

    setupGeoMock(1, 1)
    const nvResult = await calculateNL2025StikstofGebruiksNorm(
      baseInput(
        [
          {
            b_lu_catalogue: "nl_265",
            b_lu_start: new Date(2024, 3, 1),
            b_lu_end: new Date(2025, 1, 20),
          } as NL2025NormsInputForCultivation,
          {
            b_lu_catalogue: "nl_maize_dest",
            b_lu_start: new Date(2025, 2, 1),
            b_lu_end: new Date(2025, 9, 1),
          } as NL2025NormsInputForCultivation,
        ],
        { is_derogatie_bedrijf: true, has_grazing_intention: false },
      ),
    )
    expect(nvResult.normSource).toContain("Korting: 65kg N/ha: graslandvernietiging")

    setupGeoMock(1, 0)
    const nonNvResult = await calculateNL2025StikstofGebruiksNorm(
      baseInput(
        [
          {
            b_lu_catalogue: "nl_265",
            b_lu_start: new Date(2024, 3, 1),
            b_lu_end: new Date(2025, 3, 20),
          } as NL2025NormsInputForCultivation,
          {
            b_lu_catalogue: "nl_maize_dest",
            b_lu_start: new Date(2025, 4, 1),
            b_lu_end: new Date(2025, 9, 1),
          } as NL2025NormsInputForCultivation,
        ],
        { is_derogatie_bedrijf: true, has_grazing_intention: false },
      ),
    )
    expect(nonNvResult.normSource).toContain("Korting: 65kg N/ha: graslandvernietiging")
    dataSpy.mockRestore()
  })

  it("skips korting transitions with missing start or end dates", async () => {
    setupGeoMock(1, 0)
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_skip_main", "nl_265"],
        cultivation_rvo_table2: "Skip crop",
        norms: regionNorms(180),
      } as unknown as NitrogenStandard,
    ])

    const result = await calculateNL2025StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: null,
          b_lu_end: new Date(2025, 6, 1),
        } as unknown as NL2025NormsInputForCultivation,
        {
          b_lu_catalogue: "nl_skip_main",
          b_lu_start: new Date(2025, 6, 2),
          b_lu_end: null,
        } as unknown as NL2025NormsInputForCultivation,
        {
          b_lu_catalogue: "nl_skip_main",
          b_lu_start: new Date(2025, 7, 1),
          b_lu_end: new Date(2025, 9, 1),
        } as NL2025NormsInputForCultivation,
      ]),
    )

    expect(result.normValue).toBe(540)
    dataSpy.mockRestore()
  })

  it("does not apply korting for invalid clay renewal and destruction windows", async () => {
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_265"],
        cultivation_rvo_table2: "Grasland",
        type: "grasland",
        norms: regionNorms(260),
        sub_types: [{ omschrijving: "volledig maaien", norms: regionNorms(260) }],
      },
      {
        b_lu_catalogue_match: ["nl_maize_invalid"],
        cultivation_rvo_table2: "Akkerbouwgewassen, mais",
        norms: regionNorms(220),
        sub_types: [{ omschrijving: "geen derogatie", norms: regionNorms(220) }],
      },
    ] as unknown as NitrogenStandard[])

    setupGeoMock(1, 0)
    const renewalResult = await calculateNL2025StikstofGebruiksNorm(
      baseInput(
        [
          {
            b_lu_catalogue: "nl_265",
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 9, 1),
          } as NL2025NormsInputForCultivation,
          {
            b_lu_catalogue: "nl_265",
            b_lu_start: new Date(2025, 9, 2),
            b_lu_end: new Date(2025, 11, 31),
          } as NL2025NormsInputForCultivation,
        ],
        { is_derogatie_bedrijf: true, has_grazing_intention: false },
      ),
    )
    expect(renewalResult.normSource).not.toContain("graslandvernieuwing")

    setupGeoMock(1, 1)
    const destructionResult = await calculateNL2025StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: new Date(2024, 0, 1),
          b_lu_end: new Date(2025, 3, 20),
        } as NL2025NormsInputForCultivation,
        {
          b_lu_catalogue: "nl_maize_invalid",
          b_lu_start: new Date(2025, 4, 1),
          b_lu_end: new Date(2025, 9, 1),
        } as NL2025NormsInputForCultivation,
      ]),
    )
    expect(destructionResult.normSource).not.toContain("graslandvernietiging")

    dataSpy.mockRestore()
  })

  it("handles potato without variety and non-matching ui code branches", async () => {
    setupGeoMock(1, 0)
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_potato_novar"],
        cultivation_rvo_table2: "Potato no-variety",
        type: "aardappel",
        norms: regionNorms(0),
        sub_types: [{ omschrijving: "overig", norms: regionNorms(130) }],
      },
      {
        b_lu_catalogue_match: ["nl_ui_other", "nl_1932", "nl_1933"],
        cultivation_rvo_table2: "Akkerbouwgewassen, Ui overig, zaaiui of winterui.",
        norms: regionNorms(220),
        sub_types: [{ omschrijving: "1e jaars", norms: regionNorms(220) }],
      },
      {
        b_lu_catalogue_match: ["nl_kool_other_2025", "nl_1922", "nl_1923"],
        cultivation_rvo_table2: "Akkerbouwgewassen, koolzaad",
        norms: regionNorms(0),
        sub_types: [
          { omschrijving: "winter", norms: regionNorms(170) },
          { omschrijving: "zomer", norms: regionNorms(140) },
        ],
      },
    ] as unknown as NitrogenStandard[])

    const potato = await calculateNL2025StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_potato_novar",
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 8, 1),
        } as NL2025NormsInputForCultivation,
      ]),
    )
    expect(potato.normSource).toContain("(overig)")

    await expect(
      calculateNL2025StikstofGebruiksNorm(
        baseInput([
          {
            b_lu_catalogue: "nl_ui_other",
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 8, 1),
          } as NL2025NormsInputForCultivation,
        ]),
      ),
    ).rejects.toThrow("Applicable norms object is undefined")

    await expect(
      calculateNL2025StikstofGebruiksNorm(
        baseInput([
          {
            b_lu_catalogue: "nl_kool_other_2025",
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 8, 1),
          } as NL2025NormsInputForCultivation,
        ]),
      ),
    ).rejects.toThrow("Applicable norms object is undefined")

    dataSpy.mockRestore()
  })

  it("applies clay renewal korting for a pure grass-to-grass transition", async () => {
    setupGeoMock(1, 0) // klei, non-NV
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_265"],
        cultivation_rvo_table2: "Grasland",
        type: "grasland",
        norms: regionNorms(260),
        sub_types: [{ omschrijving: "volledig maaien", norms: regionNorms(260) }],
      },
    ] as unknown as NitrogenStandard[])

    const result = await calculateNL2025StikstofGebruiksNorm(
      baseInput(
        [
          {
            b_lu_catalogue: "nl_265",
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2025, 6, 1),
          } as NL2025NormsInputForCultivation,
          {
            b_lu_catalogue: "nl_265",
            b_lu_start: new Date(2025, 6, 2),
            b_lu_end: new Date(2025, 11, 31),
          } as NL2025NormsInputForCultivation,
        ],
        { is_derogatie_bedrijf: true, has_grazing_intention: false },
      ),
    )

    expect(result.normSource).toContain("Korting: 50kg N/ha: graslandvernieuwing")
    dataSpy.mockRestore()
  })
})

describe("calculateNL2025StikstofGebruiksNorm - Multi-Teelt & Compliance Tests", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const kleiCentroid: [number, number] = [5.64188724, 51.977587] // klei
  const sandCentroid: [number, number] = [5.656346970245633, 51.987872886419524] // zand_nwc (NV)

  it("should accumulate norms for wintertarwe + non-vlinderbloemige groenbemester (compliant dates)", async () => {
    setupGeoMock(4, 1) // Sand, NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: sandCentroid } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_233", // Wintertarwe (160 standard / 128 NV on zand_nwc)
          b_lu_start: new Date(2024, 9, 15), // Oct 15, 2024 (hoofdteelt 2025)
          b_lu_end: new Date(2025, 7, 10), // Aug 10, 2025
        },
        {
          b_lu_catalogue: "nl_428", // Groenbemester gele mosterd (50 standard / 40 NV on zand_nwc)
          b_lu_start: new Date(2025, 7, 15), // Aug 15, 2025 (< Sep 1)
          b_lu_end: new Date(2026, 1, 15), // Feb 15, 2026 (>= Feb 1)
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    // Wintertarwe: 128 (NV) + Groenbemester: 40 (NV) = 168 kg N/ha.
    expect(result.normValue).toBe(168)
    expect(result.normSource).toContain("Akkerbouwgewassen, wintertarwe (128 kg N/ha)")
    expect(result.normSource).toContain(
      "Groenbemesters, niet-vlinderbloemige (volgteelt na granen, graszaad of koolzaad, voetnoot 7a) (40 kg N/ha)",
    )
  })

  it("should grant 0 norm for groenbemester if sown on or after 1 September (footnote 7a)", async () => {
    setupGeoMock(1, 0) // Clay, non-NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: kleiCentroid } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_233", // Wintertarwe (245 on klei)
          b_lu_start: new Date(2024, 9, 15),
          b_lu_end: new Date(2025, 7, 10),
        },
        {
          b_lu_catalogue: "nl_428", // Groenbemester
          b_lu_start: new Date(2025, 8, 2), // Sep 2, 2025 (>= Sep 1 -> 0 norm)
          b_lu_end: new Date(2026, 1, 15),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(245)
    expect(result.normSource).toContain(
      "Groenbemesters, niet-vlinderbloemige (geen extra ruimte: gezaaid op of na 1 september, voetnoot 7a) (0 kg N/ha)",
    )
  })

  it("should grant 0 norm for groenbemester if destroyed before 1 February (footnote 7a)", async () => {
    setupGeoMock(1, 0) // Clay, non-NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: kleiCentroid } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_233", // Wintertarwe (245 on klei)
          b_lu_start: new Date(2024, 9, 15),
          b_lu_end: new Date(2025, 7, 10),
        },
        {
          b_lu_catalogue: "nl_428", // Groenbemester
          b_lu_start: new Date(2025, 7, 15), // Aug 15
          b_lu_end: new Date(2025, 11, 1), // Dec 1, 2025 (< Feb 1, 2026 -> 0 norm)
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(245)
    expect(result.normSource).toContain(
      "Groenbemesters, niet-vlinderbloemige (geen extra ruimte: vernietigd vóór 1 februari, voetnoot 7a) (0 kg N/ha)",
    )
  })

  it("should grant 50% groenbemester norm on sand after gras op bouwland (footnote 7a)", async () => {
    setupGeoMock(4, 1) // Sand, NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: sandCentroid } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_266", // Tijdelijk grasland (van 1 jan tot minstens 15 aug -> 168 NV)
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 7, 15),
        },
        {
          b_lu_catalogue: "nl_428", // Groenbemester
          b_lu_start: new Date(2025, 7, 16), // Aug 16 (< Sep 1)
          b_lu_end: new Date(2026, 1, 15),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    // Tijdelijk grasland: 168 + Groenbemester 50% (40 * 0.5 = 20) = 188 kg N/ha
    expect(result.normValue).toBe(188)
    expect(result.normSource).toContain(
      "Groenbemesters, niet-vlinderbloemige (extra ruimte (50%) na gras op bouwland, voetnoot 7a) (20 kg N/ha)",
    )
  })

  it("should accumulate spinazie 1e teelt + spinazie volgteelt", async () => {
    setupGeoMock(1, 0) // Clay, non-NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: kleiCentroid } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2773", // Spinazie 1e teelt (260 on klei)
          b_lu_start: new Date(2025, 3, 1), // April 1
          b_lu_end: new Date(2025, 5, 15), // June 15 (hoofdteelt)
        },
        {
          b_lu_catalogue: "nl_2773", // Spinazie volgteelt (185 on klei)
          b_lu_start: new Date(2025, 6, 1), // July 1
          b_lu_end: new Date(2025, 8, 15), // Sep 15
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    // 260 + 185 = 445 kg N/ha
    expect(result.normValue).toBe(445)
    expect(result.normSource).toContain("Bladgewassen, Spinazie (1e teelt) (260 kg N/ha)")
    expect(result.normSource).toContain("Bladgewassen, Spinazie (volgteelt) (185 kg N/ha)")
  })

  it("should accumulate graszaad hoofdteelt + graszaad volgteelt", async () => {
    setupGeoMock(1, 0) // Clay, non-NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: kleiCentroid } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_1915", // Rietzwenkgras (140 on klei)
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 6, 31),
        },
        {
          b_lu_catalogue: "nl_1915", // Rietzwenkgras volgteelt (60 on klei)
          b_lu_start: new Date(2025, 7, 1),
          b_lu_end: new Date(2025, 11, 31),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    // 140 + 60 = 200 kg N/ha
    expect(result.normValue).toBe(200)
    expect(result.normSource).toContain("Akkerbouwgewassen, Rietzwenkgras (140 kg N/ha)")
    expect(result.normSource).toContain("Akkerbouwgewassen, Rietzwenkgras, volgteelt (60 kg N/ha)")
  })

  it("should grant 0 norm for groenbemester and tijdelijk grasland following maize (footnotes 2 & 6)", async () => {
    setupGeoMock(1, 0) // Clay, non-NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: kleiCentroid } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_259", // Mais (185 on klei, geen derogatie)
          b_lu_start: new Date(2025, 4, 1),
          b_lu_end: new Date(2025, 8, 30),
        },
        {
          b_lu_catalogue: "nl_428", // Groenbemester after maize
          b_lu_start: new Date(2025, 9, 1),
          b_lu_end: new Date(2026, 1, 15),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    // Mais 185 + Groenbemester 0 = 185 kg N/ha
    expect(result.normValue).toBe(185)
    expect(result.normSource).toContain("Akkerbouwgewassen, mais (geen derogatie) (185 kg N/ha)")
    expect(result.normSource).toContain(
      "Groenbemesters, niet-vlinderbloemige (geen extra ruimte na maïs, voetnoot 2/6) (0 kg N/ha)",
    )
  })

  it("should grant 0 norm with preceding crop explanation even if sown on or after 1 September", async () => {
    setupGeoMock(1, 0) // Clay, non-NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: kleiCentroid } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2014", // Consumptieaardappelen (not cereals/rapeseed/grass seed)
          b_lu_start: new Date(2025, 3, 1),
          b_lu_end: new Date(2025, 7, 30),
        },
        {
          b_lu_catalogue: "nl_428", // Groenbemester sown after 1 Sep following potatoes
          b_lu_start: new Date(2025, 8, 5), // Sep 5, 2025
          b_lu_end: new Date(2026, 1, 15),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(250) // Potato norm only
    expect(result.normSource).toContain(
      "Groenbemesters, niet-vlinderbloemige (geen extra ruimte: niet geteeld na granen, graszaad of koolzaad, voetnoot 7a) (0 kg N/ha)",
    )
  })

  it("should return norm 0 for groene braak (nl_6794) under Geen plaatsingsruimte", async () => {
    setupGeoMock(1, 0) // Clay, non-NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: kleiCentroid } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_6794", // Groene braak
          b_lu_start: new Date(2025, 4, 15),
          b_lu_end: new Date(2025, 6, 15),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(0)
    expect(result.normSource).toContain("Geen plaatsingsruimte")
  })

  it("should return norm 0 without throwing for nature codes nl_332 and nl_335", async () => {
    setupGeoMock(1, 0) // Clay, non-NV
    const mockInput332: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: kleiCentroid } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_332", // natuurlijk grasland, hoofdfunctie natuur
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 11, 31),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result332 = await calculateNL2025StikstofGebruiksNorm(mockInput332)
    expect(result332.normValue).toBe(0)
    expect(result332.normSource).toContain("Geen plaatsingsruimte")

    const mockInput335: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: kleiCentroid } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_335", // natuurterreinen
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 11, 31),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result335 = await calculateNL2025StikstofGebruiksNorm(mockInput335)
    expect(result335.normValue).toBe(0)
    expect(result335.normSource).toContain("Geen plaatsingsruimte")
  })

  it("should grant 0 norm for groenbemester with footnote 7a when there is no preceding crop", async () => {
    setupGeoMock(1, 0) // Clay, non-NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: kleiCentroid } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_428", // Groenbemester gele mosterd
          b_lu_start: new Date(2025, 7, 15), // Aug 15, 2025 (< Sep 1)
          b_lu_end: new Date(2026, 1, 15), // Feb 15, 2026 (>= Feb 1)
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(0)
    expect(result.normSource).toContain(
      "Groenbemesters, niet-vlinderbloemige (geen extra ruimte: geen voorafgaande teelt, voetnoot 7a)",
    )
  })

  it("should evaluate Footnote 7b (Graszaadstoppel) before Sep 16 and on/after Sep 16", async () => {
    setupGeoMock(1, 0) // Clay, non-NV
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_graszaad_stoppel"],
        cultivation_rvo_table2: "Graszaadstoppel ter vernietiging in najaar of vroege voorjaar",
        type: "groenbemester",
        norms: regionNorms(60),
      } as unknown as NitrogenStandard,
    ])

    // Sown before Sep 16 (Sep 10) -> qualifies for norm
    const inputBefore = baseInput([
      {
        b_lu_catalogue: "nl_graszaad_stoppel",
        b_lu_start: new Date(2025, 8, 10),
        b_lu_end: new Date(2026, 1, 1),
      } as NL2025NormsInputForCultivation,
    ])
    const resultBefore = await calculateNL2025StikstofGebruiksNorm(inputBefore)
    expect(resultBefore.normValue).toBe(60)
    expect(resultBefore.normSource).toContain("(graszaadstoppel, voetnoot 7b)")

    // Sown on or after Sep 16 (Sep 20) -> 0 norm
    const inputAfter = baseInput([
      {
        b_lu_catalogue: "nl_graszaad_stoppel",
        b_lu_start: new Date(2025, 8, 20),
        b_lu_end: new Date(2026, 1, 1),
      } as NL2025NormsInputForCultivation,
    ])
    const resultAfter = await calculateNL2025StikstofGebruiksNorm(inputAfter)
    expect(resultAfter.normValue).toBe(0)
    expect(resultAfter.normSource).toContain(
      "(geen extra ruimte: niet voldaan aan voorwaarden graszaadstoppel, voetnoot 7b)",
    )

    dataSpy.mockRestore()
  })

  it("should filter out cultivations starting after the norm year", async () => {
    setupGeoMock(1, 0) // Clay, non-NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: kleiCentroid } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_233", // Wintertarwe
          b_lu_start: new Date(2025, 2, 1),
          b_lu_end: new Date(2025, 7, 1),
        },
        {
          b_lu_catalogue: "nl_233",
          b_lu_start: new Date(2026, 2, 1), // Started after 2025
          b_lu_end: new Date(2026, 7, 1),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(245)
    expect(result.normSource).toBe("Akkerbouwgewassen, wintertarwe.")
  })

  it("should fallback to groene braak when cultivations array is empty", async () => {
    setupGeoMock(1, 0) // Clay, non-NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: kleiCentroid } as Field,
      cultivations: [],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(0)
    expect(result.normSource).toContain("Geen plaatsingsruimte")
  })

  it("should set norm 0 with (heringezaaid) for multiple grass crops in the same year", async () => {
    setupGeoMock(1, 0) // Clay, non-NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: kleiCentroid } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265", // Grasland
          b_lu_start: new Date(2025, 2, 1),
          b_lu_end: new Date(2025, 5, 1),
        },
        {
          b_lu_catalogue: "nl_265", // Grasland herinzaai
          b_lu_start: new Date(2025, 5, 2),
          b_lu_end: new Date(2025, 9, 1),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    expect(result.normSource).toContain("(heringezaaid)")
  })

  it("should exclude previous grass catch crop from grassland destruction discount", async () => {
    setupGeoMock(4, 0) // zand_nwc, non-NV
    const mockInput: NL2025NormsInput = {
      farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
      field: { b_id: "1", b_centroid: sandCentroid } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265", // Grassland
          b_lu_start: new Date(2024, 7, 15), // August 2024 -> catch crop (month >= 7)
          b_lu_end: new Date(2025, 1, 15), // Feb 15, 2025
        },
        {
          b_lu_catalogue: "nl_259", // Mais
          b_lu_start: new Date(2025, 3, 1),
          b_lu_end: new Date(2025, 8, 1),
        },
      ] as NL2025NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
    // Catch crop is skipped in grassland destruction check, so no 65kg discount is applied
    expect(result.normSource).not.toContain("Korting: 65kg N/ha: scheuren grasland")
  })

  it("should fallback to standard with subtypes when isVolgteelt is true but no volgteelt standard exists", async () => {
    setupGeoMock(1, 0)
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_hoofd_only"],
        cultivation_rvo_table2: "Hoofdteelt gewas",
        norms: regionNorms(95),
        sub_types: [
          {
            omschrijving: "specifiek",
            period_start_month: 1,
            period_end_month: 12,
            norms: regionNorms(95),
          },
        ],
      } as unknown as NitrogenStandard,
      {
        b_lu_catalogue_match: ["nl_preceding"],
        cultivation_rvo_table2: "Preceding gewas",
        norms: regionNorms(100),
      } as unknown as NitrogenStandard,
    ])

    const result = await calculateNL2025StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_preceding",
          b_lu_start: new Date(2025, 2, 1),
          b_lu_end: new Date(2025, 5, 1),
        } as NL2025NormsInputForCultivation,
        {
          b_lu_catalogue: "nl_hoofd_only",
          b_lu_start: new Date(2025, 5, 2),
          b_lu_end: new Date(2025, 9, 1),
        } as NL2025NormsInputForCultivation,
      ]),
    )

    expect(result.normValue).toBe(195)
    dataSpy.mockRestore()
  })

  it("should handle subtype sort with undefined period_start_day and period_end_day", async () => {
    setupGeoMock(1, 0)
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_subtype_null_days"],
        cultivation_rvo_table2: "Subtype null days crop",
        norms: regionNorms(0),
        sub_types: [
          {
            omschrijving: "vroeg",
            period_start_month: 3,
            period_start_day: undefined,
            period_end_month: 6,
            period_end_day: undefined,
            norms: regionNorms(130),
          },
          {
            omschrijving: "laat",
            period_start_month: 3,
            period_start_day: undefined,
            period_end_month: 10,
            period_end_day: undefined,
            norms: regionNorms(150),
          },
        ],
      } as unknown as NitrogenStandard,
    ])

    const result = await calculateNL2025StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_subtype_null_days",
          b_lu_start: new Date(2025, 2, 1),
          b_lu_end: new Date(2025, 10, 15),
        } as NL2025NormsInputForCultivation,
      ]),
    )

    expect(result.normValue).toBe(150)
    dataSpy.mockRestore()
  })
})
