import type { Fertilizer, FertilizerApplication } from "@nmi-agro/fdm-core"
import { describe, expect, it } from "vitest"
import type { NL2026NormsFillingInput } from "./types"
import { calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm } from "./renure-gebruiksnorm"

describe("calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm", () => {
  const mockFertilizers = [
    {
      p_id: "1",
      p_id_catalogue: "1",
      p_type_rvo: "132", // Renure - Mineralenconcentraat
      p_n_rt: 6.0,
    },
    {
      p_id: "2",
      p_id_catalogue: "2",
      p_type_rvo: "10", // Regular animal manure, not Renure
      p_n_rt: 6.4,
    },
    {
      p_id: "3",
      p_id_catalogue: "3",
      p_type_rvo: "200", // Not in table11Mestcodes
    },
  ] as unknown as Fertilizer[]

  const mockApplications = [
    {
      p_app_id: "app1",
      p_id: "app1",
      p_id_catalogue: "1",
      p_app_amount: 10000,
    },
    {
      p_app_id: "app2",
      p_id: "app2",
      p_id_catalogue: "2",
      p_app_amount: 10000,
    },
  ] as unknown as FertilizerApplication[]

  it("should calculate the norm filling for a Renure application", () => {
    const result = calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm({
      applications: [mockApplications[0]],
      fertilizers: mockFertilizers,
      cultivations: [],
      has_organic_certification: false,
      has_grazing_intention: false,
      fosfaatgebruiksnorm: 0,
      b_centroid: [0, 0],
    } as NL2026NormsFillingInput)

    expect(result.normFilling).toBe(60)
    expect(result.applicationFilling).toEqual([
      {
        p_app_id: "app1",
        normFilling: 60,
      },
    ])
  })

  it("should return zero filling for non-Renure fertilizers", () => {
    const result = calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm({
      applications: [mockApplications[1]],
      fertilizers: mockFertilizers,
      cultivations: [],
      has_organic_certification: false,
      has_grazing_intention: false,
      fosfaatgebruiksnorm: 0,
      b_centroid: [0, 0],
    } as NL2026NormsFillingInput)

    expect(result.normFilling).toBe(0)
    expect(result.applicationFilling).toEqual([
      {
        p_app_id: "app2",
        normFilling: 0,
      },
    ])
  })

  it("should throw an error if a fertilizer has an unknown p_type_rvo", () => {
    expect(() =>
      calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm({
        applications: [
          {
            p_app_id: "app3",
            p_id: "app3",
            p_id_catalogue: "3",
            p_app_amount: 10,
          } as unknown as FertilizerApplication,
        ],
        fertilizers: mockFertilizers,
        cultivations: [],
        has_organic_certification: false,
        has_grazing_intention: false,
        fosfaatgebruiksnorm: 0,
        b_centroid: [0, 0],
      } as NL2026NormsFillingInput),
    ).toThrow("Fertilizer 3 has unknown p_type_rvo 200")
  })

  it("should return zero filling when no applications are provided", () => {
    const result = calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm({
      applications: [],
      fertilizers: mockFertilizers,
      cultivations: [],
      has_organic_certification: false,
      has_grazing_intention: false,
      fosfaatgebruiksnorm: 0,
      b_centroid: [0, 0],
    } as NL2026NormsFillingInput)

    expect(result.normFilling).toBe(0)
    expect(result.applicationFilling).toEqual([])
  })

  it("should throw an error if a fertilizer is not found in the map", () => {
    expect(() =>
      calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm({
        applications: [
          {
            p_app_id: "app_missing",
            p_id: "app_missing",
            p_id_catalogue: "missing_id",
            p_app_amount: 10,
          } as unknown as FertilizerApplication,
        ],
        fertilizers: mockFertilizers,
        cultivations: [],
        has_organic_certification: false,
        has_grazing_intention: false,
        fosfaatgebruiksnorm: 0,
        b_centroid: [0, 0],
      } as NL2026NormsFillingInput),
    ).toThrow("Fertilizer missing_id not found for application app_missing")
  })

  it("should throw an error if a fertilizer has no p_type_rvo", () => {
    expect(() =>
      calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm({
        applications: [
          {
            p_app_id: "app_no_rvo",
            p_id: "app_no_rvo",
            p_id_catalogue: "no_rvo_id",
            p_app_amount: 10,
          } as unknown as FertilizerApplication,
        ],
        fertilizers: [
          {
            p_id: "no_rvo_id",
            p_id_catalogue: "no_rvo_id",
            p_type_rvo: null,
          } as unknown as Fertilizer,
        ],
        cultivations: [],
        has_organic_certification: false,
        has_grazing_intention: false,
        fosfaatgebruiksnorm: 0,
        b_centroid: [0, 0],
      } as NL2026NormsFillingInput),
    ).toThrow("Fertilizer no_rvo_id has no p_type_rvo")
  })
})
