import { afterEach, describe, expect, it, vi } from "vitest"
import type * as brpModule from "./catalogues/brp"
import {
  aggregateCultivationCatalogueInfoBrp,
  aggregateCultivationCatalogueInfoBrpInternal,
  getCatalogueBrp,
} from "./catalogues/brp"
import {
  aggregateCultivationCatalogueInfo,
  getCultivationCatalogue,
  getCultivationCatalogueBuildingContext,
  getLastCultivationAvailabilityYear,
  LAST_CULTIVATION_AVAILABILITY_YEAR,
} from "./index"

vi.mock("./catalogues/brp", async (importOriginal: () => Promise<typeof brpModule>) => {
  const original = await importOriginal()
  return {
    ...original,
    aggregateCultivationCatalogueInfoBrp: vi.fn(original.aggregateCultivationCatalogueInfoBrp),
  }
})

describe("aggregateCultivationCatalogueInfo", () => {
  it("should skip b_lu_ya that cannot be parsed", async () => {
    const buildingContext = await getCultivationCatalogueBuildingContext()
    const catalogue = await aggregateCultivationCatalogueInfoBrpInternal(buildingContext, [
      {
        b_lu_ya: "",
        b_lu_harvestable: "multiple",
        b_lu_croprotation: "cereal",
        b_lu_harvestcat: "HC050",
      } as any,
    ])
    expect(catalogue.b_lu_ya_min).toBeUndefined()
    expect(catalogue.b_lu_ya_max).toBeUndefined()
  })

  it("should forward any errors in collection from one catalogue", async () => {
    vi.mocked(aggregateCultivationCatalogueInfoBrp).mockRejectedValueOnce("Failed to read JSON")
    await expect(aggregateCultivationCatalogueInfo(undefined as any)).rejects.toThrow(
      "Failed to read JSON",
    )
  })
})

describe("getCultivationCatalogue", () => {
  it("should return the BRP catalogue when catalogueName is 'brp'", async () => {
    const buildingContext = await getCultivationCatalogueBuildingContext()
    const aggregatedInfo = await aggregateCultivationCatalogueInfo(buildingContext)
    const expectedCatalogue = await getCatalogueBrp(buildingContext, aggregatedInfo)
    const actualCatalogue = await getCultivationCatalogue("brp")
    expect(actualCatalogue).toEqual(expectedCatalogue)
  })

  it("should throw an error when an invalid catalogueName is provided", async () => {
    await expect(
      // @ts-expect-error
      getCultivationCatalogue("invalid-catalogue"),
    ).rejects.toThrowError("catalogue invalid-catalogue is not recognized")
  })

  it("should return a non-empty array for 'brp' catalogue", async () => {
    const catalogue = await getCultivationCatalogue("brp")
    expect(Array.isArray(catalogue)).toBe(true)
    expect(catalogue.length).toBeGreaterThan(0)
  })

  it("should check if all items in the brp catalogue have the correct source", async () => {
    const catalogue = await getCultivationCatalogue("brp")
    for (const item of catalogue) {
      expect(item.b_lu_source).toBe("brp")
    }
  })

  it("should check if all items in the brp catalogue have the correct b_lu_harvestable values", async () => {
    const catalogue = await getCultivationCatalogue("brp")
    for (const item of catalogue) {
      expect(["once", "multiple", "none"]).toContain(item.b_lu_harvestable)
    }
  })

  it("should not have any items with an empty b_lu_ya array", async () => {
    const catalogue = await getCultivationCatalogue("brp")
    for (const item of catalogue) {
      expect(item.b_lu_ya === null || item.b_lu_ya.length > 0).toBe(true)
    }
  })
})

describe("getCatalogueBrp", () => {
  it("should return an array of CatalogueCultivationItem", async () => {
    const buildingContext = await getCultivationCatalogueBuildingContext()
    const aggregatedInfo = await aggregateCultivationCatalogueInfo(buildingContext)
    const catalogue = await getCatalogueBrp(buildingContext, aggregatedInfo)
    expect(Array.isArray(catalogue)).toBe(true)
    for (const item of catalogue) {
      expect(typeof item).toBe("object")
      expect(item).toHaveProperty("b_lu_source")
      expect(item).toHaveProperty("b_lu_catalogue")
      expect(item).toHaveProperty("b_lu_name")
      expect(item).toHaveProperty("b_lu_name_en")
      expect(item).toHaveProperty("b_lu_harvestable")
      expect(item).toHaveProperty("b_lu_hcat3")
      expect(item).toHaveProperty("b_lu_hcat3_name")
      expect(item).toHaveProperty("b_lu_croprotation")
      expect(item).toHaveProperty("b_lu_harvestcat")
      expect(item).toHaveProperty("b_lu_yield")
      expect(item).toHaveProperty("b_lu_dm")
      expect(item).toHaveProperty("b_lu_hi")
      expect(item).toHaveProperty("b_lu_n_harvestable")
      expect(item).toHaveProperty("b_lu_n_residue")
      expect(item).toHaveProperty("b_lu_p_harvestable")
      expect(item).toHaveProperty("b_lu_p_residue")
      expect(item).toHaveProperty("b_n_fixation")
      expect(item).toHaveProperty("b_lu_ya")
      expect(item).toHaveProperty("hash")
    }
  })

  it("should return at least one item", async () => {
    const buildingContext = await getCultivationCatalogueBuildingContext()
    const aggregatedInfo = await aggregateCultivationCatalogueInfo(buildingContext)
    const catalogue = await getCatalogueBrp(buildingContext, aggregatedInfo)
    expect(catalogue.length).toBeGreaterThan(0)
  })

  it("should not set any b_lu_ya to null if aggregated info is available", async () => {
    const buildingContext = await getCultivationCatalogueBuildingContext()
    const aggregatedInfo = await aggregateCultivationCatalogueInfo(buildingContext)
    const catalogue = await getCatalogueBrp(buildingContext, aggregatedInfo)
    expect(catalogue.some((cultivation) => cultivation.b_lu_ya === null)).toBe(true)
  })

  it("should not set any b_lu_ya to null if aggregated info is missing", async () => {
    const buildingContext = await getCultivationCatalogueBuildingContext()
    const catalogue = await getCatalogueBrp(buildingContext, {})
    expect(catalogue.some((cultivation) => cultivation.b_lu_ya === null)).toBe(false)
  })
})

describe("getLastCultivationAvailabilityYear", () => {
  it("should return LAST_CULTIVATION_AVAILABILITY_YEAR", async () => {
    await expect(getLastCultivationAvailabilityYear()).resolves.toBe(
      LAST_CULTIVATION_AVAILABILITY_YEAR,
    )
  })
})

describe("getCatalogueBrp with phosphate contents from the NMI API", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const getBrp = async (options?: { nmiApiKey?: string }) => {
    const buildingContext = await getCultivationCatalogueBuildingContext()
    return getCatalogueBrp(buildingContext, {}, options)
  }

  const nmiResponse = (cultivations: unknown[]) =>
    new Response(JSON.stringify({ success: true, status: 200, data: { cultivations } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })

  it("should not call the NMI API and return null phosphate contents without a key", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const catalogue = await getBrp()

    expect(fetchMock).not.toHaveBeenCalled()
    for (const item of catalogue) {
      expect(item.b_lu_p_harvestable).toBeNull()
      expect(item.b_lu_p_residue).toBeNull()
    }
  })

  it("should add the phosphate contents per BRP code when a key is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      nmiResponse([
        { b_lu: "NL_265", b_lu_brp: 265, b_p_harvestable: 9.8, b_p_residue: 0 },
        { b_lu: "FAO_1-01b", b_lu_brp: null, b_p_harvestable: 8 },
      ]),
    )
    vi.stubGlobal("fetch", fetchMock)

    const catalogue = await getBrp({ nmiApiKey: "test-key" })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.nmi-agro.nl/lookup/cultivations?b_region=nl",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      }),
    )
    const grassland = catalogue.find((item) => item.b_lu_catalogue === "nl_265")
    expect(grassland?.b_lu_p_harvestable).toBe(9.8)
    expect(grassland?.b_lu_p_residue).toBe(0)

    const other = catalogue.find((item) => item.b_lu_catalogue !== "nl_265")
    expect(other?.b_lu_p_harvestable).toBeNull()
    expect(other?.b_lu_p_residue).toBeNull()
  })

  it("should use null for missing or invalid phosphate contents", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          nmiResponse([{ b_lu_brp: 265, b_p_harvestable: "unknown", b_p_residue: -1 }]),
        ),
    )

    const catalogue = await getBrp({ nmiApiKey: "test-key" })
    const grassland = catalogue.find((item) => item.b_lu_catalogue === "nl_265")

    expect(grassland?.b_lu_p_harvestable).toBeNull()
    expect(grassland?.b_lu_p_residue).toBeNull()
  })

  it("should throw when the NMI API request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 })))

    await expect(getBrp({ nmiApiKey: "invalid-key" })).rejects.toThrowError(
      /Failed to fetch NMI cultivations lookup: 401/,
    )
  })

  it("should throw a clear error when the NMI API request times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError")),
    )

    await expect(getBrp({ nmiApiKey: "test-key" })).rejects.toThrowError(
      /Fetching NMI cultivations lookup timed out after 30000ms/,
    )
  })

  it("should rethrow other network errors from the NMI API request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))

    await expect(getBrp({ nmiApiKey: "test-key" })).rejects.toThrowError("fetch failed")
  })

  it("should throw when the NMI API response has an unexpected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    )

    await expect(getBrp({ nmiApiKey: "test-key" })).rejects.toThrowError(
      /Unexpected response shape/,
    )
  })

  it("should pass the key through getCultivationCatalogue", async () => {
    const fetchMock = vi.fn().mockResolvedValue(nmiResponse([]))
    vi.stubGlobal("fetch", fetchMock)

    await getCultivationCatalogue("brp", { nmiApiKey: "test-key" })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
