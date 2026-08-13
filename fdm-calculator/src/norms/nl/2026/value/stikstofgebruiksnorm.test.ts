import type { Field } from "@nmi-agro/fdm-core"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { NitrogenStandard, NL2026NormsInput, NL2026NormsInputForCultivation } from "./types"
import * as GeoTiff from "../../../../shared/geotiff"
import { calculateNL2026StikstofGebruiksNorm } from "./stikstofgebruiksnorm"
import * as StikstofData from "./stikstofgebruiksnorm-data"

describe("calculateNL2026StikstofGebruiksNorm", () => {
  it("should return the correct norm for grasland (beweiden)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: true },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571],
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: new Date(2026, 0, 1), // Current year cultivation
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(345)
    expect(result.normSource).toEqual("Grasland (beweiden).")
  })

  it("should return the correct norm for grasland (volledig maaien)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571],
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: new Date(2026, 0, 1), // Current year cultivation
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(385)
    expect(result.normSource).toEqual("Grasland (volledig maaien).")
  })

  it("should return 0 for buffer strips", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571],
        b_bufferstrip: true,
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(0)
    expect(result.normSource).toEqual("Bufferstrook: geen plaatsingsruimte")
  })

  it("should return the correct norm for potatoes", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571],
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2015", // Pootaardappel
          b_lu_variety: "Adora",
          b_lu_start: new Date(2026, 0, 1), // Current year cultivation
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(140)
    expect(result.normSource).toEqual("Akkerbouwgewas, pootaardappelen (hoge norm).")
  })

  it("should apply 0 korting if winterteelt is present in zand_nwc region (hoofdteelt 2026)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: true },
      field: {
        b_id: "1",
        b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_265", // Grasland (is_winterteelt: true)
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)

    // The base norm for Grasland in zand_nwc is 200 in nv-gebied.
    expect(result.normValue).toBe(200)
    expect(result.normSource).toContain("Grasland (beweiden)")
  })

  it("should apply 0 korting if Tijdelijk grasland is present in zand_nwc region", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_266", // Tijdelijk grasland
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)

    // Tijdelijk grasland "van 1 jan tot minstens 15 mei" -> 90 (zand_nwc standard), 72 (zand_nwc nv_area)
    // Should have no korting applied
    expect(result.normValue).toBe(72)
    expect(result.normSource).toContain("Tijdelijk grasland.")
  })

  it("should apply 0 korting if vanggewas is present (sown <= Oct 1st)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2751", // Vruchtgewassen (2026 hoofdteelt)
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_428", // Gele mosterd (is_vanggewas: true)
          b_lu_start: new Date(2025, 9, 1), // Oct 1st, 2025
          b_lu_end: new Date(2026, 1, 31),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    // The base norm for Vruchtgewassen in zand_nwc is 108. With vanggewas sown <= Oct 1st, korting should be 0.
    expect(result.normValue).toBe(108)
    expect(result.normSource).toEqual(
      "Vruchtgewassen, Landbouwstambonen, rijp zaad. Geen korting: vanggewas gezaaid uiterlijk 1 oktober",
    )
  })

  it("should apply 5 korting if vanggewas is present (sown Oct 2nd - Oct 14th)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2751", // Vruchtgewassen (2026 hoofdteelt)
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_428", // Gele mosterd (is_vanggewas: true)
          b_lu_start: new Date(2025, 9, 5), // Oct 5th, 2025
          b_lu_end: new Date(2026, 1, 31),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    // The base norm for Vruchtgewassen in zand_nwc in nv-gebied is 108. With vanggewas sown Oct 2-14, korting should be 5.
    expect(result.normValue).toBe(103) // 108 - 5
    expect(result.normSource).toEqual(
      "Vruchtgewassen, Landbouwstambonen, rijp zaad. Korting: 5kg N/ha, vanggewas gezaaid tussen 2 t/m 14 oktober",
    )
  })

  it("should apply 10 korting if vanggewas is present (sown Oct 15th - Oct 31st)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2751", // Vruchtgewassen (2026 hoofdteelt)
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_428", // Gele mosterd (is_vanggewas: true)
          b_lu_start: new Date(2025, 9, 20), // Oct 20th, 2025
          b_lu_end: new Date(2026, 1, 31),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    // The base norm for Vruchtgewassen in zand_nwc in nv-gebied is 108. With vanggewas sown Oct 15-31, korting should be 10.
    expect(result.normValue).toBe(98) // 108 - 10
    expect(result.normSource).toEqual(
      "Vruchtgewassen, Landbouwstambonen, rijp zaad. Korting: 10kg N/ha, vanggewas gezaaid tussen 15 t/m 31 oktober",
    )
  })

  it("should apply 20 korting if vanggewas is present (sown Nov 1st or later)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2751", // Vruchtgewassen (2026 hoofdteelt)
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_428", // Gele mosterd (is_vanggewas: true)
          b_lu_start: new Date(2025, 10, 1), // Nov 1st, 2025
          b_lu_end: new Date(2026, 1, 31),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    // The base norm for Vruchtgewassen in zand_nwc in nv-gebied is 108. With vanggewas sown Nov 1st+, korting should be 20.
    expect(result.normValue).toBe(88) // 108 - 20
    expect(result.normSource).toEqual(
      "Vruchtgewassen, Landbouwstambonen, rijp zaad. Korting: 20kg N/ha, vanggewas gezaaid op of na 1 november",
    )
  })

  it("should apply 20 korting if no winterteelt or vanggewas is present in zand_nwc region", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2751", // Vruchtgewassen (2026 hoofdteelt)
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_234", // Zomertarwe (not winterteelt or vanggewas)
          b_lu_start: new Date(2024, 5, 1),
          b_lu_end: new Date(2024, 8, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    // The base norm for Vruchtgewassen in zand_nwc in nv-gebied is 108. With no exception, korting should be 20.
    expect(result.normValue).toBe(88) // 108 - 20
    expect(result.normSource).toEqual(
      "Vruchtgewassen, Landbouwstambonen, rijp zaad. Korting: 20kg N/ha: geen vanggewas of winterteelt",
    )
  })

  it("should not apply korting if region is not sandy or loess, even without winterteelt/vanggewas", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.648307588666836, 51.96484772224782], // This centroid is in 'klei'
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2751", // Vruchtgewassen (2026 hoofdteelt)
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_234", // Zomertarwe (not winterteelt or vanggewas)
          b_lu_start: new Date(2024, 5, 1),
          b_lu_end: new Date(2026, 1, 31),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    // The base norm for Vruchtgewassen in klei is 135. Korting should not apply in non-sandy/loess regions.
    expect(result.normValue).toBe(135)
    expect(result.normSource).toEqual("Vruchtgewassen, Landbouwstambonen, rijp zaad.")
  })

  it("should return the correct norm for Gras voor industriële verwerking (eerste jaar)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_3805", // Gras voor industriële verwerking
          b_lu_start: new Date(2026, 0, 1), // Current year cultivation
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(30)
    expect(result.normSource).toEqual(
      "Akkerbouwgewassen, Gras voor industriële verwerking (inzaai in september en eerste jaar).",
    )
  })

  it("should return the correct norm for Gras voor industriële verwerking (volgende jaren)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_3805", // Gras voor industriële verwerking (current year)
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_3805", // Gras voor industriële verwerking (previous year)
          b_lu_start: new Date(2024, 0, 1),
          b_lu_end: new Date(2024, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(310)
    expect(result.normSource).toEqual(
      "Akkerbouwgewassen, Gras voor industriële verwerking (inzaai voor 15 mei en volgende jaren).",
    )
  })

  it("should return the correct norm for Graszaad, Engels raaigras (1e jaars)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_6750", // Graszaad, Engels raaigras
          b_lu_start: new Date(2026, 0, 1), // Current year cultivation
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(165)
    expect(result.normSource).toEqual("Akkerbouwgewassen, Graszaad, Engels raaigras (1e jaars).")
  })

  it("should return the correct norm for Graszaad, Engels raaigras (overjarig)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_6750", // Graszaad, Engels raaigras (current year)
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_6750", // Graszaad, Engels raaigras (previous year)
          b_lu_start: new Date(2024, 0, 1),
          b_lu_end: new Date(2024, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(200)
    expect(result.normSource).toEqual("Akkerbouwgewassen, Graszaad, Engels raaigras (overjarig).")
  })

  it("should return the correct norm for Akkerbouwgewassen, Roodzwenkgras (1e jaars)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_6784", // Akkerbouwgewassen, Roodzwenkgras
          b_lu_start: new Date(2026, 0, 1), // Current year cultivation
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(85)
    expect(result.normSource).toEqual("Akkerbouwgewassen, Roodzwenkgras (1e jaars).")
  })

  it("should return the correct norm for Akkerbouwgewassen, Roodzwenkgras (overjarig)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_6784", // Akkerbouwgewassen, Roodzwenkgras (current year)
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
        {
          b_lu_catalogue: "nl_6784", // Akkerbouwgewassen, Roodzwenkgras (previous year)
          b_lu_start: new Date(2024, 0, 1),
          b_lu_end: new Date(2024, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(115)
    expect(result.normSource).toEqual("Akkerbouwgewassen, Roodzwenkgras (overjarig).")
  })

  it("should return the correct norm for Winterui (1e jaars)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_1932", // Winterui, 1e jaars
          b_lu_start: new Date(2026, 0, 1), // Current year cultivation
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(170)
    expect(result.normSource).toEqual(
      "Akkerbouwgewassen, Ui overig, zaaiui of winterui. (1e jaars).",
    )
  })

  it("should return the correct norm for Winterui (2e jaars)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_1933", // Winterui, 2e jaars
          b_lu_start: new Date(2026, 0, 1), // Current year cultivation
          b_lu_end: new Date(2026, 5, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(170)
    expect(result.normSource).toEqual(
      "Akkerbouwgewassen, Ui overig, zaaiui of winterui. (2e jaars).",
    )
  })

  it("should return the correct norm for Bladgewassen, Spinazie (1e teelt)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2773", // Bladgewassen, Spinazie
          b_lu_start: new Date(2026, 4, 15), // May 15th, 2026 (hoofdteelt)
          b_lu_end: new Date(2026, 6, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(260)
    expect(result.normSource).toEqual("Bladgewassen, Spinazie (1e teelt).")
  })

  it("should return the correct norm for Bladgewassen, Slasoorten (1e teelt)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2767", // Bladgewassen, Slasoorten
          b_lu_start: new Date(2026, 4, 15), // May 15th, 2026 (hoofdteelt)
          b_lu_end: new Date(2026, 6, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(180)
    expect(result.normSource).toEqual("Bladgewassen, Slasoorten (1e teelt).")
  })

  it("should return the correct norm for Bladgewassen, Andijvie eerste teelt volgteelt (1e teelt)", async () => {
    const mockInput: NL2026NormsInput = {
      farm: { has_grazing_intention: false },
      field: {
        b_id: "1",
        b_centroid: [5.6279889, 51.975571], // Klei region
      } as Field,
      cultivations: [
        {
          b_lu_catalogue: "nl_2708", // Bladgewassen, Andijvie eerste teelt volgteelt
          b_lu_start: new Date(2026, 4, 15), // May 15th, 2026 (hoofdteelt)
          b_lu_end: new Date(2026, 6, 1),
        } as Partial<NL2026NormsInputForCultivation>,
      ] as NL2026NormsInputForCultivation[],
      soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
    }

    const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
    expect(result.normValue).toBe(180)
    expect(result.normSource).toEqual("Bladgewassen, Andijvie eerste teelt volgteelt (1e teelt).")
  })

  describe("Tijdelijk grasland time-based matching", () => {
    const kleiCentroid: [number, number] = [5.6279889, 51.975571] // Klei region

    it("should select the highest norm (longest period) for full-year temporary grassland", async () => {
      // Matches "van 1 jan tot minstens 15 okt" -> 310 (Klei)
      const mockInput: NL2026NormsInput = {
        farm: { has_grazing_intention: false },
        field: { b_id: "1", b_centroid: kleiCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_266", // Tijdelijk grasland
            b_lu_start: new Date(2026, 0, 1), // Jan 1
            b_lu_end: new Date(2026, 11, 31), // Dec 31
          } as Partial<NL2026NormsInputForCultivation>,
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normValue).toBe(310) // Klei standard for "van 1 jan tot minstens 15 okt"
    })

    it("should select the correct norm for a period ending in May (tot minstens 15 mei)", async () => {
      // Matches "van 1 jan tot minstens 15 mei" -> 110 (Klei)
      // Should NOT match "tot minstens 15 augustus"
      const mockInput: NL2026NormsInput = {
        farm: { has_grazing_intention: false },
        field: { b_id: "1", b_centroid: kleiCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_266", // Tijdelijk grasland
            b_lu_start: new Date(2026, 0, 1), // Jan 1
            b_lu_end: new Date(2026, 4, 20), // May 20
          } as Partial<NL2026NormsInputForCultivation>,
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normValue).toBe(110) // Klei standard for "van 1 jan tot minstens 15 mei"
    })

    it("should select the correct norm for a late sown crop (vanaf 15 oktober)", async () => {
      // Matches "vanaf 15 oktober" -> 0 (Klei)
      const mockInput: NL2026NormsInput = {
        farm: { has_grazing_intention: false },
        field: { b_id: "1", b_centroid: kleiCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_266", // Tijdelijk grasland
            b_lu_start: new Date(2026, 9, 20), // Oct 20
            b_lu_end: new Date(2026, 11, 31), // Dec 31
          } as Partial<NL2026NormsInputForCultivation>,
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normValue).toBe(0) // Klei standard for "vanaf 15 oktober"
    })

    it("should handle start dates from previous year correctly (van 1 januari)", async () => {
      // Started in 2025, still present in 2026 until Aug 20.
      // Matches "van 1 jan tot minstens 15 aug" -> 250 (Klei)
      const mockInput: NL2026NormsInput = {
        farm: { has_grazing_intention: false },
        field: { b_id: "1", b_centroid: kleiCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_266", // Tijdelijk grasland
            b_lu_start: new Date(2025, 8, 1), // Sept 1, 2025
            b_lu_end: new Date(2026, 7, 20), // Aug 20, 2026
          } as Partial<NL2026NormsInputForCultivation>,
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normValue).toBe(250) // Klei standard for "van 1 jan tot minstens 15 aug"
    })

    it("should select the correct norm for a summer crop (vanaf 15 april tot minstens 15 oktober)", async () => {
      // Matches "vanaf 15 april tot minstens 15 oktober" -> 310 (Klei)
      const mockInput: NL2026NormsInput = {
        farm: { has_grazing_intention: false },
        field: { b_id: "1", b_centroid: kleiCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_266", // Tijdelijk grasland
            b_lu_start: new Date(2026, 3, 20), // April 20
            b_lu_end: new Date(2026, 9, 20), // Oct 20
          } as Partial<NL2026NormsInputForCultivation>,
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normValue).toBe(310)
    })

    it("should handle explicit zero values for period days/months (regression test for falsy bug)", async () => {
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

      const mockInput: NL2026NormsInput = {
        farm: { has_grazing_intention: false },
        field: { b_id: "1", b_centroid: kleiCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_zero_test",
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 11, 31),
          } as Partial<NL2026NormsInputForCultivation>,
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }
      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normValue).toBe(200)
      expect(result.normSource).toContain("Zero Test Crop")

      spy.mockRestore()
    })
  })
})

const sandCentroid: [number, number] = [5.656346970245633, 51.987872886419524] // zand_nwc
const clayCentroid: [number, number] = [5.64188724, 51.977587] // klei

describe("calculateNL2026StikstofGebruiksNorm - Korting Logic", () => {
  describe("Grassland Renewal (Gras-na-Gras) - 50 kg N/ha", () => {
    it("should apply 50 discount on Sand (June 1 - Aug 31)", async () => {
      const mockInput: NL2026NormsInput = {
        farm: {
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: sandCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 5, 15), // June 15
          },
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2026, 5, 16),
            b_lu_end: new Date(2026, 11, 31),
          },
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Korting: 50kg N/ha: graslandvernieuwing")
    })

    it("should apply 50 discount on Clay (Feb 1 - Sep 15)", async () => {
      const mockInput: NL2026NormsInput = {
        farm: {
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: clayCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 5, 15),
          },
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2026, 5, 16),
            b_lu_end: new Date(2026, 11, 31),
          },
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Korting: 50kg N/ha: graslandvernieuwing")
    })

    it("should throw error for invalid renewal date on Sand", async () => {
      const mockInput: NL2026NormsInput = {
        farm: {
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: sandCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 4, 15), // May 15 (Too early)
          },
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2026, 4, 16),
            b_lu_end: new Date(2026, 11, 31),
          },
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      await expect(calculateNL2026StikstofGebruiksNorm(mockInput)).rejects.toThrow(
        "Graslandvernieuwing op zand- en lössgrond is alleen toegestaan tussen 1 juni en 31 augustus.",
      )
    })
  })

  describe("Conditional Winter Crops (Beet & Maize with undersowing)", () => {
    it("should calculate normValue and exact normSource for 2026 maize as hoofdteelt", async () => {
      const mockInput: NL2026NormsInput = {
        farm: { has_grazing_intention: false },
        field: { b_id: "1", b_centroid: clayCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_259", // Maize (2026 hoofdteelt)
            b_lu_start: new Date(2026, 4, 1),
            b_lu_end: new Date(2026, 9, 15),
          },
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normValue).toBe(185)
      expect(result.normSource).toEqual("Akkerbouwgewassen, mais.")
    })

    it("should apply 0 korting if sugar beet was harvested on or after Nov 1 in preceding year", async () => {
      const mockInput: NL2026NormsInput = {
        farm: { has_grazing_intention: false },
        field: { b_id: "1", b_centroid: sandCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_256", // Sugar beet (hoofdteelt 2025)
            b_lu_start: new Date(2025, 3, 1),
            b_lu_end: new Date(2025, 10, 5), // Harvested Nov 5, 2025 (>= Nov 1)
          },
          {
            b_lu_catalogue: "nl_2751", // Vruchtgewassen (2026)
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 5, 1),
          },
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Geen korting: winterteelt aanwezig in voorafgaand jaar")
    })

    it("should apply 20 korting if sugar beet was harvested before Nov 1 and no catch crop was grown", async () => {
      const mockInput: NL2026NormsInput = {
        farm: { has_grazing_intention: false },
        field: { b_id: "1", b_centroid: sandCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_256", // Sugar beet (hoofdteelt 2025)
            b_lu_start: new Date(2025, 3, 1),
            b_lu_end: new Date(2025, 9, 10), // Harvested Oct 10, 2025 (< Nov 1)
          },
          {
            b_lu_catalogue: "nl_2751", // Vruchtgewassen (2026)
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 5, 1),
          },
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Korting: 20kg N/ha: geen vanggewas of winterteelt")
    })

    it("should apply 0 korting if maize in preceding year had undersowing", async () => {
      const mockInput: NL2026NormsInput = {
        farm: { has_grazing_intention: false },
        field: { b_id: "1", b_centroid: sandCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_316", // Grain maize (hoofdteelt 2025)
            b_lu_start: new Date(2025, 4, 1),
            b_lu_end: new Date(2025, 9, 15),
          },
          {
            b_lu_catalogue: "nl_428", // Undersown grass/catch crop
            b_lu_start: new Date(2025, 5, 1), // Sown during maize
            b_lu_end: new Date(2026, 1, 1), // Stands until Feb 1
          },
          {
            b_lu_catalogue: "nl_2751", // Vruchtgewassen (2026)
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 5, 1),
          },
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Geen korting: winterteelt aanwezig in voorafgaand jaar")
    })

    it("should apply 20 korting if maize in preceding year had no undersowing and no catch crop", async () => {
      const mockInput: NL2026NormsInput = {
        farm: { has_grazing_intention: false },
        field: { b_id: "1", b_centroid: sandCentroid } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_316", // Grain maize (hoofdteelt 2025) without undersowing
            b_lu_start: new Date(2025, 4, 1),
            b_lu_end: new Date(2025, 9, 15),
          },
          {
            b_lu_catalogue: "nl_2751", // Vruchtgewassen (2026)
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 5, 1),
          },
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Korting: 20kg N/ha: geen vanggewas of winterteelt")
    })
  })

  describe("Grassland Destruction (Gras-naar-Bouwland) - 65 kg N/ha", () => {
    it("should apply 65 discount on Sand (Maize, Feb 1 - May 10)", async () => {
      const mockInput: NL2026NormsInput = {
        farm: {
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: sandCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 1, 15), // Feb 15
          },
          {
            b_lu_catalogue: "nl_259", // Maize (Snijmais)
            b_lu_start: new Date(2026, 1, 16),
            b_lu_end: new Date(2026, 9, 1),
          },
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Korting: 65kg N/ha: graslandvernietiging")
    })

    it("should NOT apply discount if previous crop was a Catch Crop (sown in Autumn)", async () => {
      const mockInput: NL2026NormsInput = {
        farm: {
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: sandCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_266", // Tijdelijk Grass
            b_lu_start: new Date(2025, 9, 1), // Oct 1, 2025 (Autumn) -> Catch Crop
            b_lu_end: new Date(2026, 1, 15), // Feb 15
          },
          {
            b_lu_catalogue: "nl_259", // Maize
            b_lu_start: new Date(2026, 1, 16),
            b_lu_end: new Date(2026, 9, 1),
          },
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normSource).not.toContain("graslandvernietiging")
    })

    it("should NOT apply discount for Seed Potatoes", async () => {
      const mockInput: NL2026NormsInput = {
        farm: {
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: sandCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 1, 15), // Feb 15
          },
          {
            b_lu_catalogue: "nl_2015", // Seed Potato
            b_lu_variety: "Adora",
            b_lu_start: new Date(2026, 1, 16),
            b_lu_end: new Date(2026, 9, 1),
          },
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normSource).not.toContain("graslandvernietiging")
    })

    it("should throw error for invalid destruction date on Sand", async () => {
      const mockInput: NL2026NormsInput = {
        farm: {
          has_grazing_intention: false,
        },
        field: {
          b_id: "1",
          b_centroid: sandCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 5, 1), // June 1 (Too late)
          },
          {
            b_lu_catalogue: "nl_259", // Maize
            b_lu_start: new Date(2026, 5, 2),
            b_lu_end: new Date(2026, 9, 1),
          },
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      await expect(calculateNL2026StikstofGebruiksNorm(mockInput)).rejects.toThrow(
        "Graslandvernietiging op zand- en lössgrond is alleen toegestaan tussen 1 februari en 10 mei.",
      )
    })

    it("should apply 65 discount on Sand (Consumption Potato, Feb 1 - May 10)", async () => {
      const mockInput: NL2026NormsInput = {
        farm: { has_grazing_intention: false },
        field: {
          b_id: "1",
          b_centroid: sandCentroid,
        } as Field,
        cultivations: [
          {
            b_lu_catalogue: "nl_265", // Grass
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 2, 15), // March 15
          },
          {
            b_lu_catalogue: "nl_2014", // Consumption Potato
            b_lu_variety: "Agria",
            b_lu_start: new Date(2026, 2, 16),
            b_lu_end: new Date(2026, 9, 1),
          },
        ] as NL2026NormsInputForCultivation[],
        soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
      }

      const result = await calculateNL2026StikstofGebruiksNorm(mockInput)
      expect(result.normSource).toContain("Korting: 65kg N/ha: graslandvernietiging")
    })
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

const baseInput = (cultivations: NL2026NormsInputForCultivation[]): NL2026NormsInput => ({
  farm: { has_grazing_intention: false },
  field: { b_id: "field-1", b_centroid: centroid } as Field,
  cultivations,
  soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
})

const spyNitrogenStandards = (standards: unknown[]) =>
  vi.spyOn(StikstofData, "nitrogenStandardsData", "get").mockReturnValue(standards as any)

describe("NL2026 stikstof additional branch coverage", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("throws when no matching nitrogen standard exists", async () => {
    setupGeoMock(1, 0)
    await expect(
      calculateNL2026StikstofGebruiksNorm(
        baseInput([
          {
            b_lu_catalogue: "nl_unknown",
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 8, 1),
          } as NL2026NormsInputForCultivation,
        ]),
      ),
    ).rejects.toThrow("No matching nitrogen standard found for b_lu_catalogue nl_unknown.")
  })

  it("uses potato fallback subtype 'overig'", async () => {
    setupGeoMock(1, 0)
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_2015"],
        cultivation_rvo_table2: "Potato test",
        type: "aardappel",
        norms: regionNorms(0),
        sub_types: [
          { omschrijving: "vroeg", varieties: ["adora"], norms: regionNorms(120) },
          { omschrijving: "overig", norms: regionNorms(140) },
        ],
      } as unknown as NitrogenStandard,
    ])

    const result = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_2015",
          b_lu_variety: "not-listed",
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 6, 1),
        } as unknown as NL2026NormsInputForCultivation,
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

    const luzerne = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_luzerne_test",
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 10, 1),
        } as NL2026NormsInputForCultivation,
        {
          b_lu_catalogue: "nl_luzerne_test",
          b_lu_start: new Date(2025, 0, 1),
          b_lu_end: new Date(2025, 10, 1),
        } as NL2026NormsInputForCultivation,
      ]),
    )
    expect(luzerne.normSource).toBe("Akkerbouwgewassen, Luzerne (volgende jaren).")
    expect(luzerne.normValue).toBe(200)

    const koolzaad = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_1922",
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 10, 1),
        } as NL2026NormsInputForCultivation,
      ]),
    )
    expect(koolzaad.normSource).toBe("Akkerbouwgewassen, koolzaad (winter).")
    expect(koolzaad.normValue).toBe(170)

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

    const result = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_2751",
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 11, 31),
        } as NL2026NormsInputForCultivation,
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
      calculateNL2026StikstofGebruiksNorm(
        baseInput([
          {
            b_lu_catalogue: "nl_no_norm_match",
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 6, 1),
          } as NL2026NormsInputForCultivation,
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
      calculateNL2026StikstofGebruiksNorm(
        baseInput([
          {
            b_lu_catalogue: "nl_region_gap",
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 8, 1),
          } as NL2026NormsInputForCultivation,
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

    const result = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_234",
          b_lu_start: new Date(2025, 3, 1),
          b_lu_end: new Date(2025, 8, 1),
        } as NL2026NormsInputForCultivation,
        {
          b_lu_catalogue: "nl_floor_crop",
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 8, 1),
        } as NL2026NormsInputForCultivation,
      ]),
    )

    expect(result.normValue).toBe(0)
    expect(result.normSource).toContain("Korting: 20kg N/ha: geen vanggewas of winterteelt")
    dataSpy.mockRestore()
  })

  it("falls back from unmatched subtype descriptions and uses default cultivation dates", async () => {
    setupGeoMock(1, 0)
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_luzerne_custom"],
        cultivation_rvo_table2: "Akkerbouwgewassen, Luzerne",
        norms: regionNorms(0),
        sub_types: [
          { omschrijving: "volgende jaren", norms: regionNorms(111) },
          { omschrijving: "zonder-periode", norms: regionNorms(112) },
          { period_start_month: 1, period_end_month: 12, norms: regionNorms(165) },
          { period_start_month: 3, period_end_month: 11, norms: regionNorms(175) },
        ],
      } as unknown as NitrogenStandard,
    ])

    const result = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_luzerne_custom",
          b_lu_start: null,
          b_lu_end: null,
        } as unknown as NL2026NormsInputForCultivation,
      ]),
    )

    expect(result.normValue).toBe(165)
    expect(result.normSource).toBe("Akkerbouwgewassen, Luzerne (eerste jaar).")
    dataSpy.mockRestore()
  })

  it("handles multiple matching standards and chooses the earliest matching period", async () => {
    setupGeoMock(1, 0)
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_multi_luzerne"],
        cultivation_rvo_table2: "Akkerbouwgewassen, Luzerne",
        norms: regionNorms(0),
        sub_types: [
          {
            omschrijving: "",
            varieties: ["flag-second-operand"],
            period_start_month: 3,
            period_end_month: 11,
            norms: regionNorms(195),
          },
          {
            omschrijving: "later",
            period_start_month: 4,
            period_end_month: 10,
            norms: regionNorms(215),
          },
        ],
      } as unknown as NitrogenStandard,
      {
        b_lu_catalogue_match: ["nl_multi_luzerne"],
        cultivation_rvo_table2: "Fallback standard",
        norms: regionNorms(80),
      } as unknown as NitrogenStandard,
    ])

    const result = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_multi_luzerne",
          b_lu_start: new Date(2026, 4, 1),
          b_lu_end: new Date(2026, 10, 30),
        } as NL2026NormsInputForCultivation,
      ]),
    )

    expect(result.normValue).toBe(195)
    expect(result.normSource).toBe("Akkerbouwgewassen, Luzerne (eerste jaar).")
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
      {
        b_lu_catalogue_match: ["nl_2015"],
        cultivation_rvo_table2: "Akkerbouwgewas, pootaardappelen",
        type: "aardappel",
        norms: regionNorms(0),
        sub_types: [{ omschrijving: "overig", norms: regionNorms(130) }],
      },
    ] as unknown as NitrogenStandard[])

    const luzerne = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_luzerne_first",
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 10, 1),
        } as NL2026NormsInputForCultivation,
      ]),
    )
    expect(luzerne.normSource).toBe("Akkerbouwgewassen, Luzerne (eerste jaar).")

    const koolzaad = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_1922",
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 10, 1),
        } as NL2026NormsInputForCultivation,
      ]),
    )
    expect(koolzaad.normSource).toBe("Akkerbouwgewassen, koolzaad (winter).")

    const winterui = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_1932",
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 8, 1),
        } as NL2026NormsInputForCultivation,
      ]),
    )
    expect(winterui.normSource).toBe("Akkerbouwgewassen, Ui overig, zaaiui of winterui. (1e jaars).")

    const potatoNoVariety = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_2015",
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 7, 1),
        } as NL2026NormsInputForCultivation,
      ]),
    )
    expect(potatoNoVariety.normSource).toContain("(overig)")
    dataSpy.mockRestore()
  })

  it("applies clay renewal korting for grass transitions", async () => {
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

    const result = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 6, 1),
        } as NL2026NormsInputForCultivation,
        {
          b_lu_catalogue: "nl_266",
          b_lu_start: new Date(2026, 6, 2),
          b_lu_end: new Date(2026, 11, 31),
        } as NL2026NormsInputForCultivation,
      ]),
    )

    expect(result.normValue).toBe(210)
    expect(result.normSource).toContain("Korting: 50kg N/ha: graslandvernieuwing")
    dataSpy.mockRestore()
  })

  it("applies clay destruction korting for maize in both NV and non-NV", async () => {
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_265"],
        cultivation_rvo_table2: "Grasland",
        type: "grasland",
        norms: regionNorms(260),
        sub_types: [{ omschrijving: "volledig maaien", norms: regionNorms(260) }],
      },
      {
        b_lu_catalogue_match: ["nl_maize_dest_2026"],
        cultivation_rvo_table2: "Akkerbouwgewassen, mais",
        norms: regionNorms(220),
      },
    ] as unknown as NitrogenStandard[])

    setupGeoMock(1, 1)
    const nvResult = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: new Date(2025, 3, 1),
          b_lu_end: new Date(2026, 1, 20),
        } as NL2026NormsInputForCultivation,
        {
          b_lu_catalogue: "nl_maize_dest_2026",
          b_lu_start: new Date(2026, 2, 1),
          b_lu_end: new Date(2026, 9, 1),
        } as NL2026NormsInputForCultivation,
      ]),
    )
    expect(nvResult.normSource).toContain("Korting: 65kg N/ha: graslandvernietiging")

    setupGeoMock(1, 0)
    const nonNvResult = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: new Date(2025, 3, 1),
          b_lu_end: new Date(2026, 3, 20),
        } as NL2026NormsInputForCultivation,
        {
          b_lu_catalogue: "nl_maize_dest_2026",
          b_lu_start: new Date(2026, 4, 1),
          b_lu_end: new Date(2026, 9, 1),
        } as NL2026NormsInputForCultivation,
      ]),
    )
    expect(nonNvResult.normSource).toContain("Korting: 65kg N/ha: graslandvernietiging")
    dataSpy.mockRestore()
  })

  it("skips korting transitions with missing start or end dates", async () => {
    setupGeoMock(1, 0)
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_skip_main_2026", "nl_265"],
        cultivation_rvo_table2: "Skip crop",
        norms: regionNorms(180),
      } as unknown as NitrogenStandard,
    ])

    const result = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: null,
          b_lu_end: new Date(2026, 6, 1),
        } as unknown as NL2026NormsInputForCultivation,
        {
          b_lu_catalogue: "nl_skip_main_2026",
          b_lu_start: new Date(2026, 6, 2),
          b_lu_end: null,
        } as unknown as NL2026NormsInputForCultivation,
        {
          b_lu_catalogue: "nl_skip_main_2026",
          b_lu_start: new Date(2026, 7, 1),
          b_lu_end: new Date(2026, 9, 1),
        } as NL2026NormsInputForCultivation,
      ]),
    )

    expect(result.normValue).toBe(180)
    dataSpy.mockRestore()
  })

  it("throws for invalid clay renewal and destruction windows", async () => {
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_265"],
        cultivation_rvo_table2: "Grasland",
        type: "grasland",
        norms: regionNorms(260),
        sub_types: [{ omschrijving: "volledig maaien", norms: regionNorms(260) }],
      },
      {
        b_lu_catalogue_match: ["nl_maize_invalid_2026"],
        cultivation_rvo_table2: "Akkerbouwgewassen, mais",
        norms: regionNorms(220),
      },
    ] as unknown as NitrogenStandard[])

    setupGeoMock(1, 0)
    await expect(
      calculateNL2026StikstofGebruiksNorm(
        baseInput([
          {
            b_lu_catalogue: "nl_265",
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 10, 1),
          } as NL2026NormsInputForCultivation,
          {
            b_lu_catalogue: "nl_265",
            b_lu_start: new Date(2026, 10, 2),
            b_lu_end: new Date(2026, 11, 31),
          } as NL2026NormsInputForCultivation,
        ]),
      ),
    ).rejects.toThrow("Graslandvernieuwing op klei- en veengrond is alleen toegestaan")

    setupGeoMock(1, 0)
    await expect(
      calculateNL2026StikstofGebruiksNorm(
        baseInput([
          {
            b_lu_catalogue: "nl_265",
            b_lu_start: new Date(2025, 0, 1),
            b_lu_end: new Date(2026, 5, 20),
          } as NL2026NormsInputForCultivation,
          {
            b_lu_catalogue: "nl_maize_invalid_2026",
            b_lu_start: new Date(2026, 6, 1),
            b_lu_end: new Date(2026, 9, 1),
          } as NL2026NormsInputForCultivation,
        ]),
      ),
    ).rejects.toThrow("Graslandvernietiging op klei- en veengrond (niet NV-gebied)")

    dataSpy.mockRestore()
  })

  it("handles potato without variety and non-matching ui code branches", async () => {
    setupGeoMock(1, 0)
    const dataSpy = spyNitrogenStandards([
      {
        b_lu_catalogue_match: ["nl_potato_novar_2026"],
        cultivation_rvo_table2: "Potato no-variety",
        type: "aardappel",
        norms: regionNorms(0),
        sub_types: [{ omschrijving: "overig", norms: regionNorms(130) }],
      },
      {
        b_lu_catalogue_match: ["nl_ui_other_2026", "nl_1932", "nl_1933"],
        cultivation_rvo_table2: "Akkerbouwgewassen, Ui overig, zaaiui of winterui.",
        norms: regionNorms(220),
        sub_types: [{ omschrijving: "1e jaars", norms: regionNorms(220) }],
      },
      {
        b_lu_catalogue_match: ["nl_kool_other_2026", "nl_1922", "nl_1923"],
        cultivation_rvo_table2: "Akkerbouwgewassen, koolzaad",
        norms: regionNorms(0),
        sub_types: [
          { omschrijving: "winter", norms: regionNorms(170) },
          { omschrijving: "zomer", norms: regionNorms(140) },
        ],
      },
    ] as unknown as NitrogenStandard[])

    const potato = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_potato_novar_2026",
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 8, 1),
        } as NL2026NormsInputForCultivation,
      ]),
    )
    expect(potato.normSource).toContain("(overig)")

    await expect(
      calculateNL2026StikstofGebruiksNorm(
        baseInput([
          {
            b_lu_catalogue: "nl_ui_other_2026",
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 8, 1),
          } as NL2026NormsInputForCultivation,
        ]),
      ),
    ).rejects.toThrow("Applicable norms object is undefined")

    await expect(
      calculateNL2026StikstofGebruiksNorm(
        baseInput([
          {
            b_lu_catalogue: "nl_kool_other_2026",
            b_lu_start: new Date(2026, 0, 1),
            b_lu_end: new Date(2026, 8, 1),
          } as NL2026NormsInputForCultivation,
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

    const result = await calculateNL2026StikstofGebruiksNorm(
      baseInput([
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: new Date(2026, 0, 1),
          b_lu_end: new Date(2026, 6, 1),
        } as NL2026NormsInputForCultivation,
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: new Date(2026, 6, 2),
          b_lu_end: new Date(2026, 11, 31),
        } as NL2026NormsInputForCultivation,
      ]),
    )

    expect(result.normSource).toContain("Korting: 50kg N/ha: graslandvernieuwing")
    dataSpy.mockRestore()
  })
})
