import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { SoilParameterEstimatesInput, SoilParameterEstimatesResponse } from "./types"
import { requestSoilParameterEstimates } from "./index"

const mockEstimatesData: SoilParameterEstimatesResponse = {
  a_al_ox: 1,
  a_c_of: 1,
  a_ca_co: 1,
  a_ca_co_po: 1,
  a_caco3_if: 1,
  a_cec_co: 1,
  a_clay_mi: 1,
  a_cn_fr: 1,
  a_com_fr: 1,
  a_cu_cc: 1,
  a_density_sa: 1,
  a_fe_ox: 1,
  a_k_cc: 1,
  a_k_co: 1,
  a_k_co_po: 1,
  a_mg_cc: 1,
  a_mg_co: 1,
  a_mg_co_po: 1,
  a_n_pmn: 1,
  a_n_rt: 1,
  a_p_al: 1,
  a_p_cc: 1,
  a_p_ox: 1,
  a_p_rt: 1,
  a_p_sg: 1,
  a_p_wa: 1,
  a_ph_cc: 1,
  a_s_rt: 1,
  a_sand_mi: 1,
  a_silt_mi: 1,
  a_som_loi: 1,
  a_zn_cc: 1,
  b_soiltype_agr: "dekzand",
  b_gwl_class: "IIb",
  b_gwl_ghg: 1,
  b_gwl_glg: 1,
  b_c_st03: 1,
  b_som_potential: 1,
  b_c_st03_potential: 1,
  b_c_delta: 1,
  cultivations: [{ year: 2024, b_lu_brp: 265 }],
  cultivations_advanced: [],
  a_source: "nl-other-nmi",
  a_depth_upper: 0,
  a_depth_lower: undefined,
}

describe("requestSoilParameterEstimates", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.mocked(fetch).mockClear()
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  it("should throw an error if nmiApiKey is not provided", async () => {
    const input: SoilParameterEstimatesInput = {
      a_lat: 52.4,
      a_lon: 4.3,
      nmiApiKey: undefined,
    }

    await expect(requestSoilParameterEstimates(input)).rejects.toThrow(
      "Please provide a NMI API key",
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it("should successfully fetch soil parameter estimates from NMI API", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockEstimatesData }),
    } as Response)

    const input: SoilParameterEstimatesInput = {
      a_lat: 52.4,
      a_lon: 4.3,
      nmiApiKey: "mock-api-key",
    }

    const result = await requestSoilParameterEstimates(input)

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://api.nmi-agro.nl/estimates?"),
      expect.objectContaining({ method: "GET" }),
    )
    expect(result.cultivations).toEqual([{ year: 2024, b_lu_brp: 265 }])
  })

  it("should throw an error if the NMI API request fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
    } as Response)

    const input: SoilParameterEstimatesInput = {
      a_lat: 52.4,
      a_lon: 4.3,
      nmiApiKey: "mock-api-key",
    }

    await expect(requestSoilParameterEstimates(input)).rejects.toThrow("Request to NMI API failed")
  })

  it("should throw an error if the NMI API response fails validation", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { invalid: true } }),
    } as Response)

    const input: SoilParameterEstimatesInput = {
      a_lat: 52.4,
      a_lon: 4.3,
      nmiApiKey: "mock-api-key",
    }

    await expect(requestSoilParameterEstimates(input)).rejects.toThrow(
      "Invalid response from NMI API",
    )
  })

  it("should throw an error if the NMI API response has no data", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: null }),
    } as Response)

    const input: SoilParameterEstimatesInput = {
      a_lat: 52.4,
      a_lon: 4.3,
      nmiApiKey: "mock-api-key",
    }

    await expect(requestSoilParameterEstimates(input)).rejects.toThrow(
      "Invalid response from NMI API: missing data",
    )
  })

  it("should throw a timeout error if the request is aborted", async () => {
    vi.mocked(fetch).mockImplementationOnce(() => {
      const abortError = new Error("The operation was aborted")
      abortError.name = "AbortError"
      return Promise.reject(abortError)
    })

    const input: SoilParameterEstimatesInput = {
      a_lat: 52.4,
      a_lon: 4.3,
      nmiApiKey: "mock-api-key",
    }

    await expect(requestSoilParameterEstimates(input)).rejects.toThrow(
      "De aanvraag naar de NMI Estimates API is verlopen (timeout).",
    )
  })
})
