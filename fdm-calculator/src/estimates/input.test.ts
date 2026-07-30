import type { Field, FdmType, PrincipalId } from "@nmi-agro/fdm-core"
import { getField } from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { collectInputForSoilParameterEstimates } from "./input"

vi.mock("@nmi-agro/fdm-core", async () => {
  const actual = await vi.importActual("@nmi-agro/fdm-core")
  return {
    ...actual,
    getField: vi.fn(),
  }
})

const mockedGetField = vi.mocked(getField)

// Minimal FdmType mock — collect functions don't use transactions
const mockFdm = {} as FdmType
const principal_id: PrincipalId = "test-principal"
const b_id = "field-1"

// Base field: centroid [lon, lat] = [5.2, 51.6]
const mockField: Field = {
  b_id,
  b_name: "Test field",
  b_id_farm: "farm-1",
  b_id_source: null,
  b_geometry: null,
  b_centroid: [5.2, 51.6],
  b_area: 10,
  b_perimeter: 400,
  b_start: new Date("2020-01-01"),
  b_end: null,
  b_acquiring_method: "unknown",
  b_bufferstrip: false,
}

describe("collectInputForSoilParameterEstimates", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("should return a_lat/a_lon from the field centroid", async () => {
    mockedGetField.mockResolvedValue(mockField)

    const result = await collectInputForSoilParameterEstimates(
      mockFdm,
      principal_id,
      b_id,
      "mock-api-key",
    )

    // b_centroid = [lon, lat]
    expect(result.a_lon).toBe(5.2)
    expect(result.a_lat).toBe(51.6)
  })

  it("should pass through the nmiApiKey", async () => {
    mockedGetField.mockResolvedValue(mockField)

    const result = await collectInputForSoilParameterEstimates(
      mockFdm,
      principal_id,
      b_id,
      "mock-api-key",
    )

    expect(result.nmiApiKey).toBe("mock-api-key")
  })

  it("should call getField with the correct arguments", async () => {
    mockedGetField.mockResolvedValue(mockField)

    await collectInputForSoilParameterEstimates(mockFdm, principal_id, b_id, "mock-api-key")

    expect(mockedGetField).toHaveBeenCalledWith(mockFdm, principal_id, b_id)
  })
})
