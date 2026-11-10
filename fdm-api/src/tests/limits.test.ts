/**
 * Tests for the usage limits that protect the API against misuse (src/limits.ts):
 * - at most 500 fields per farm: new fields beyond it are refused, and farm-level reads and
 *   calculations on larger farms are refused;
 * - at most 10 new farms per user in a 24-hour window, across all API keys.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FdmApiServices } from "../index"
import { createFdmApi } from "../index"
import { countFieldsOfFarms, USAGE_LIMITS } from "../limits"

const config = { appName: "Test App", appUrl: "https://test.example.com" }
const headers = { "x-api-key": "valid", "content-type": "application/json" }

/** Counters per rate-limit key; the mock database returns the count stored for the key. */
let counts: Record<string, number>
let lastKey = ""

const mockFdm = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn(function (this: unknown, row: { key: string }) {
    lastKey = row.key
    return this
  }),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  returning: vi.fn(async () => [{ count: counts[lastKey] ?? 1, lastRequest: Date.now() }]),
  transaction: vi.fn(async (handler: (tx: unknown) => unknown) => handler(mockFdm)),
} as any

const mockAuth = {
  api: {
    verifyApiKey: vi.fn().mockResolvedValue({
      valid: true,
      error: null,
      key: { id: "key-1", referenceId: "user-1", name: "Test key" },
    }),
  },
} as any

function makeApp(fieldCounts: Record<string, number>, services: Partial<FdmApiServices> = {}) {
  return createFdmApi(mockFdm, mockAuth, config, {
    countFieldsOfFarms: vi.fn(async (_fdm, ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, fieldCounts[id] ?? 0])),
    ),
    ...services,
  })
}

beforeEach(() => {
  counts = {}
  lastKey = ""
  vi.clearAllMocks()
})

const field = {
  b_id: "field-new",
  b_name: "Nieuw perceel",
  b_id_farm: "farm-1",
  b_id_source: null,
  b_geometry: null,
  b_centroid: [5.2, 52.1] as [number, number],
  b_area: 1,
  b_perimeter: 400,
  b_bufferstrip: false,
  b_start: new Date("2024-01-01T00:00:00Z"),
  b_end: null,
  b_acquiring_method: "unknown",
}

const createFieldBody = JSON.stringify({
  b_name: "Nieuw perceel",
  b_geometry: {
    type: "Polygon",
    coordinates: [
      [
        [5.0, 52.0],
        [5.1, 52.0],
        [5.1, 52.1],
        [5.0, 52.1],
        [5.0, 52.0],
      ],
    ],
  },
  b_start: "2024-01-01",
  b_acquiring_method: "purchase",
})

describe("maximum farm size", () => {
  it("refuses a new field when the farm already has the maximum number of fields", async () => {
    const addField = vi.fn()
    const app = makeApp({ "farm-1": USAGE_LIMITS.maxFieldsPerFarm }, { addField })
    const res = await app.request("/farms/farm-1/fields", {
      method: "POST",
      headers,
      body: createFieldBody,
    })
    expect(res.status).toBe(422)
    expect(res.headers.get("content-type")).toContain("application/problem+json")
    expect((await res.json()).type).toContain("unprocessable-entity")
    expect(addField).not.toHaveBeenCalled()
  })

  it("adds a field while the farm stays within the maximum", async () => {
    const app = makeApp(
      { "farm-1": USAGE_LIMITS.maxFieldsPerFarm - 1 },
      {
        addField: vi.fn().mockResolvedValue("field-new"),
        getField: vi.fn().mockResolvedValue(field),
      },
    )
    const res = await app.request("/farms/farm-1/fields", {
      method: "POST",
      headers,
      body: createFieldBody,
    })
    expect(res.status).toBe(201)
  })

  it("refuses farm-level reads for a farm larger than the maximum", async () => {
    const getFields = vi.fn().mockResolvedValue([])
    const app = makeApp({ "farm-1": USAGE_LIMITS.maxFieldsPerFarm + 1 }, { getFields })
    const res = await app.request("/farms/farm-1/fields", { headers })
    expect(res.status).toBe(422)
    expect(getFields).not.toHaveBeenCalled()
  })

  it("allows farm-level reads for a farm at the maximum", async () => {
    const app = makeApp(
      { "farm-1": USAGE_LIMITS.maxFieldsPerFarm },
      { getFields: vi.fn().mockResolvedValue([]) },
    )
    const res = await app.request("/farms/farm-1/fields", { headers })
    expect(res.status).toBe(200)
  })

  it("refuses farm-level calculations for a farm larger than the maximum", async () => {
    const collectInputForNitrogenBalance = vi.fn()
    const app = makeApp({ "farm-1": USAGE_LIMITS.maxFieldsPerFarm + 1 }, {
      collectInputForNitrogenBalance,
    } as any)
    const res = await app.request(
      "/farms/farm-1/calculations/nitrogen-balance?start=2025-01-01&end=2025-12-31",
      { headers },
    )
    expect(res.status).toBe(422)
    expect(collectInputForNitrogenBalance).not.toHaveBeenCalled()
  })

  it("refuses an aggregation when one of its farms is larger than the maximum", async () => {
    const getFarmMeasureSummary = vi.fn()
    const app = makeApp({ "farm-b": USAGE_LIMITS.maxFieldsPerFarm + 1 }, {
      getFarmIdsOfOrganization: vi.fn().mockResolvedValue(["farm-a", "farm-b"]),
      getFarmMeasureSummary,
    } as any)
    const res = await app.request("/organizations/org-1/measures?year=2026", { headers })
    expect(res.status).toBe(422)
    expect((await res.json()).detail).toContain("farm-b")
    expect(getFarmMeasureSummary).not.toHaveBeenCalled()
  })

  it("does not limit field-level reads on a large farm", async () => {
    const countFields = vi.fn()
    const app = createFdmApi(mockFdm, mockAuth, config, {
      countFieldsOfFarms: countFields,
      getField: vi.fn().mockResolvedValue(field),
    })
    const res = await app.request("/fields/field-new", { headers })
    expect(res.status).toBe(200)
    expect(countFields).not.toHaveBeenCalled()
  })
})

describe("farms created per day", () => {
  const createFarmServices = {
    addFarm: vi.fn().mockResolvedValue("farm-new"),
    enableFertilizerCatalogue: vi.fn().mockResolvedValue(undefined),
    enableCultivationCatalogue: vi.fn().mockResolvedValue(undefined),
    enableMeasureCatalogue: vi.fn().mockResolvedValue(undefined),
    getFertilizersFromCatalogue: vi.fn().mockResolvedValue([]),
    addFertilizer: vi.fn(),
    getFarm: vi.fn().mockResolvedValue({
      b_id_farm: "farm-new",
      b_name_farm: "Nieuw bedrijf",
      b_businessid_farm: null,
      b_address_farm: null,
      b_postalcode_farm: null,
    }),
  }

  it("counts farm creations per user, not per API key", async () => {
    const app = makeApp({}, createFarmServices)
    const res = await app.request("/farms", {
      method: "POST",
      headers,
      body: JSON.stringify({ b_name_farm: "Nieuw bedrijf" }),
    })
    expect(res.status).toBe(201)
    expect(mockFdm.values).toHaveBeenCalledWith(
      expect.objectContaining({ key: "fdm-api:farms-created:user-1" }),
    )
  })

  it("refuses a farm over the daily maximum with 429 and Retry-After", async () => {
    counts["fdm-api:farms-created:user-1"] = USAGE_LIMITS.maxFarmsCreatedPerDay + 1
    const addFarm = vi.fn()
    const app = makeApp({}, { ...createFarmServices, addFarm })
    const res = await app.request("/farms", {
      method: "POST",
      headers,
      body: JSON.stringify({ b_name_farm: "Nieuw bedrijf" }),
    })
    expect(res.status).toBe(429)
    expect((await res.json()).type).toContain("rate-limit-exceeded")
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0)
    expect(addFarm).not.toHaveBeenCalled()
  })
})

describe("countFieldsOfFarms", () => {
  it("does not query the database for an empty list", async () => {
    const fdm = { select: vi.fn() } as any
    expect(await countFieldsOfFarms(fdm, [])).toEqual({})
    expect(fdm.select).not.toHaveBeenCalled()
  })

  it("returns the number of fields per farm", async () => {
    const fdm = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        { b_id_farm: "farm-1", fields: 3 },
        { b_id_farm: "farm-2", fields: "501" },
      ]),
    } as any
    expect(await countFieldsOfFarms(fdm, ["farm-1", "farm-2"])).toEqual({
      "farm-1": 3,
      "farm-2": 501,
    })
  })
})
