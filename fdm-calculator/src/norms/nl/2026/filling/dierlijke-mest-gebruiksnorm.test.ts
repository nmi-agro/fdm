import type { Fertilizer, FertilizerApplication } from "@nmi-agro/fdm-core"
import { describe, expect, it } from "vitest"
import type { NL2026NormsFillingInput } from "./types"
import { calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./dierlijke-mest-gebruiksnorm"

describe("calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm", () => {
  const mockFertilizers = [
    {
      p_id: "1",
      p_id_catalogue: "1",
      p_type_rvo: "11",
      p_n_rt: 0.5,
    },
    {
      p_id: "2",
      p_id_catalogue: "2",
      p_type_rvo: "12",
    },
    {
      p_id: "3",
      p_id_catalogue: "3",
      p_type_rvo: "200", // Not in table11Mestcodes
    },
    {
      p_id: "4",
      p_id_catalogue: "4",
      // No p_type_rvo
    },
    {
      p_id: "5",
      p_id_catalogue: "5",
      p_type_rvo: "115", // Not relevant for nitrates directive
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
      p_app_amount: 20000,
    },
  ] as unknown as FertilizerApplication[]

  it("should calculate the norm filling for a single application", () => {
    const result = calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm({
      applications: [mockApplications[0]],
      fertilizers: mockFertilizers,
      cultivations: [],
      has_organic_certification: false,
      has_grazing_intention: false,
      fosfaatgebruiksnorm: 0,
      b_centroid: [0, 0],
    } as NL2026NormsFillingInput)

    expect(result.normFilling).toBe(5)
    expect(result.applicationFilling).toEqual([
      {
        p_app_id: "app1",
        normFilling: 5,
      },
    ])
  })

  it("should calculate the norm filling for multiple applications", () => {
    const result = calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm({
      applications: mockApplications,
      fertilizers: mockFertilizers,
      cultivations: [],
      has_organic_certification: false,
      has_grazing_intention: false,
      fosfaatgebruiksnorm: 0,
      b_centroid: [0, 0],
    } as NL2026NormsFillingInput)

    expect(result.normFilling).toBe(85) // 5 + 80
    expect(result.applicationFilling).toEqual([
      {
        p_app_id: "app1",
        normFilling: 5,
      },
      {
        p_app_id: "app2",
        normFilling: 80,
      },
    ])
  })

  it("should return zero filling for fertilizers not relevant to the nitrates directive", () => {
    const result = calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm({
      applications: [
        {
          p_app_id: "app3",
          p_id: "app3",
          p_id_catalogue: "5",
          p_app_amount: 10,
        } as unknown as FertilizerApplication,
      ],
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
        p_app_id: "app3",
        normFilling: 0,
      },
    ])
  })

  it("should throw an error if a fertilizer is not found", () => {
    expect(() =>
      calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm({
        applications: [
          {
            p_app_id: "app4",
            p_id: "app4",
            p_id_catalogue: "999",
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
    ).toThrow("Fertilizer 999 not found for application app4")
  })

  it("should throw an error if a fertilizer has no p_type_rvo", () => {
    expect(() =>
      calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm({
        applications: [
          {
            p_app_id: "app5",
            p_id: "app5",
            p_id_catalogue: "4",
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
    ).toThrow("Fertilizer 4 has no p_type_rvo")
  })

  it("should throw an error if a fertilizer has an unknown p_type_rvo", () => {
    expect(() =>
      calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm({
        applications: [
          {
            p_app_id: "app6",
            p_id: "app6",
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

  describe("Renure applications (RVO codes 130-134) spillover above 80 kg N/ha", () => {
    const renureFertilizers = [
      {
        p_id: "6",
        p_id_catalogue: "6",
        p_type_rvo: "132", // Renure - Mineralenconcentraat
        p_n_rt: 10.0, // 10 g N/kg = 10 kg N / ton
      },
    ] as unknown as Fertilizer[]

    it("should exclude Renure N below or at threshold (<= 80 kg N/ha)", () => {
      // 5000 kg * 10 g/kg / 1000 = 50 kg N/ha (below threshold of 80)
      const resultBelow = calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm({
        applications: [
          {
            p_app_id: "app_below",
            p_id_catalogue: "6",
            p_app_amount: 5000,
          } as unknown as FertilizerApplication,
        ],
        fertilizers: renureFertilizers,
        cultivations: [],
        has_organic_certification: false,
        has_grazing_intention: false,
        fosfaatgebruiksnorm: 0,
        b_centroid: [0, 0],
      } as NL2026NormsFillingInput)

      expect(resultBelow.normFilling).toBe(0)
      expect(resultBelow.applicationFilling).toEqual([{ p_app_id: "app_below", normFilling: 0 }])

      // 8000 kg * 10 g/kg / 1000 = 80 kg N/ha (exactly threshold of 80)
      const resultExact = calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm({
        applications: [
          {
            p_app_id: "app_exact",
            p_id_catalogue: "6",
            p_app_amount: 8000,
          } as unknown as FertilizerApplication,
        ],
        fertilizers: renureFertilizers,
        cultivations: [],
        has_organic_certification: false,
        has_grazing_intention: false,
        fosfaatgebruiksnorm: 0,
        b_centroid: [0, 0],
      } as NL2026NormsFillingInput)

      expect(resultExact.normFilling).toBe(0)
      expect(resultExact.applicationFilling).toEqual([{ p_app_id: "app_exact", normFilling: 0 }])
    })

    it("should include Renure N above threshold (> 80 kg N/ha) in animal manure filling", () => {
      // 10000 kg * 10 g/kg / 1000 = 100 kg N/ha -> 100 - 80 = 20 kg N/ha spillover
      const result = calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm({
        applications: [
          {
            p_app_id: "app_above",
            p_id_catalogue: "6",
            p_app_amount: 10000,
          } as unknown as FertilizerApplication,
        ],
        fertilizers: renureFertilizers,
        cultivations: [],
        has_organic_certification: false,
        has_grazing_intention: false,
        fosfaatgebruiksnorm: 0,
        b_centroid: [0, 0],
      } as NL2026NormsFillingInput)

      expect(result.normFilling).toBe(20)
      expect(result.applicationFilling).toEqual([{ p_app_id: "app_above", normFilling: 20 }])
    })

    it("should calculate Renure N spillover cumulatively across multiple applications", () => {
      // Application 1: 5000 kg * 10 g/kg / 1000 = 50 kg N/ha (cumulative: 50 -> 0 excess)
      // Application 2: 5000 kg * 10 g/kg / 1000 = 50 kg N/ha (cumulative: 100 -> 20 excess)
      // Application 3: 3000 kg * 10 g/kg / 1000 = 30 kg N/ha (cumulative: 130 -> 30 excess)
      const result = calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm({
        applications: [
          { p_app_id: "app1", p_id_catalogue: "6", p_app_amount: 5000 },
          { p_app_id: "app2", p_id_catalogue: "6", p_app_amount: 5000 },
          { p_app_id: "app3", p_id_catalogue: "6", p_app_amount: 3000 },
        ] as unknown as FertilizerApplication[],
        fertilizers: renureFertilizers,
        cultivations: [],
        has_organic_certification: false,
        has_grazing_intention: false,
        fosfaatgebruiksnorm: 0,
        b_centroid: [0, 0],
      } as NL2026NormsFillingInput)

      expect(result.normFilling).toBe(50) // 0 + 20 + 30
      expect(result.applicationFilling).toEqual([
        { p_app_id: "app1", normFilling: 0 },
        { p_app_id: "app2", normFilling: 20 },
        { p_app_id: "app3", normFilling: 30 },
      ])
    })
  })

  it("should return zero filling when no applications are provided", () => {
    const result = calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm({
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

  it("should use default values when amount or nitrogen values are missing", () => {
    const result = calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm({
      applications: [
        {
          p_app_id: "app_defaults",
          p_id_catalogue: "defaults",
          p_app_amount: undefined,
        } as unknown as FertilizerApplication,
        {
          p_app_id: "app_renure_defaults",
          p_id_catalogue: "renure_defaults",
          p_app_amount: undefined,
        } as unknown as FertilizerApplication,
      ],
      fertilizers: [
        {
          p_id: "defaults",
          p_id_catalogue: "defaults",
          p_type_rvo: "11",
          p_n_rt: null,
        } as unknown as Fertilizer,
        {
          p_id: "renure_defaults",
          p_id_catalogue: "renure_defaults",
          p_type_rvo: "132",
          p_n_rt: null,
        } as unknown as Fertilizer,
      ],
      cultivations: [],
      has_organic_certification: false,
      has_grazing_intention: false,
      fosfaatgebruiksnorm: 0,
      b_centroid: [0, 0],
    } as NL2026NormsFillingInput)

    expect(result.normFilling).toBe(0)
    expect(result.applicationFilling).toEqual([
      { p_app_id: "app_defaults", normFilling: 0 },
      { p_app_id: "app_renure_defaults", normFilling: 0 },
    ])
  })
})
