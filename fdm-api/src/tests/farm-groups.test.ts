import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FdmApiServices } from "../index"
import { createFdmApi } from "../index"

const mockAuth = {
  api: {
    verifyApiKey: vi.fn(),
  },
} as any

const mockFdm = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ count: 1, lastRequest: Date.now() }]),
} as any

const config = { appName: "Test App", appUrl: "https://test.example.com" }

function validKey() {
  mockAuth.api.verifyApiKey.mockResolvedValue({
    valid: true,
    error: null,
    key: { id: "key-1", referenceId: "user-1", name: "Test key" },
  })
}

function makeApp(services: Partial<FdmApiServices> = {}) {
  return createFdmApi(mockFdm, mockAuth, config, services)
}

const headers = { "x-api-key": "valid" }
const jsonHeaders = { ...headers, "content-type": "application/json" }

/** Mimics the BaseError produced by fdm-core's handleError. */
function coreError(cause: string) {
  return new Error("Exception", { cause: new Error(cause) })
}

const group = {
  b_id_group: "group-1",
  b_id_organization: "org-1",
  b_name_group: "Project A",
  b_id_farms: ["farm-1", "farm-2"],
  memberships: [
    { b_id_farm: "farm-1", b_group_joined: new Date("2020-01-01T00:00:00Z"), b_group_leaved: null },
    {
      b_id_farm: "farm-2",
      b_group_joined: new Date("2021-02-03T00:00:00Z"),
      b_group_leaved: new Date("2030-12-31T00:00:00Z"),
    },
  ],
  created: new Date(),
  updated: null,
}

describe("GET /organizations/{organization_id}/farm-groups", () => {
  beforeEach(() => validKey())

  it("returns 401 without an API key", async () => {
    const res = await makeApp().request("/organizations/org-1/farm-groups")
    expect(res.status).toBe(401)
    expect((await res.json()).type).toContain("/problems/unauthorized")
  })

  it("returns a paginated list and does not leak internal fields", async () => {
    const listFarmGroups = vi.fn().mockResolvedValue([group, { ...group, b_id_group: "group-2" }])
    const res = await makeApp({ listFarmGroups }).request(
      "/organizations/org-1/farm-groups?limit=1&offset=1",
      { headers },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(2)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toEqual({
      b_id_group: "group-2",
      b_id_organization: "org-1",
      b_name_group: "Project A",
      b_id_farms: ["farm-1", "farm-2"],
      memberships: [
        { b_id_farm: "farm-1", b_group_joined: "2020-01-01", b_group_leaved: null },
        { b_id_farm: "farm-2", b_group_joined: "2021-02-03", b_group_leaved: "2030-12-31" },
      ],
    })
    expect(listFarmGroups).toHaveBeenCalledWith(mockFdm, "user-1", "org-1")
  })

  it("returns 403 when the principal is not a member of the organization", async () => {
    const listFarmGroups = vi.fn().mockRejectedValue(new Error("Permission denied"))
    const res = await makeApp({ listFarmGroups }).request("/organizations/org-1/farm-groups", {
      headers,
    })
    expect(res.status).toBe(403)
    expect((await res.json()).type).toContain("forbidden")
  })
})

describe("POST /organizations/{organization_id}/farm-groups", () => {
  beforeEach(() => validKey())

  it("creates a group and returns 201 with a Location header", async () => {
    const createFarmGroup = vi.fn().mockResolvedValue("group-1")
    const getFarmGroup = vi.fn().mockResolvedValue({ ...group, b_id_farms: [] })
    const res = await makeApp({ createFarmGroup, getFarmGroup }).request(
      "/organizations/org-1/farm-groups",
      { method: "POST", headers: jsonHeaders, body: JSON.stringify({ b_name_group: "Project A" }) },
    )
    expect(res.status).toBe(201)
    expect(res.headers.get("location")).toContain("/farm-groups/group-1")
    expect((await res.json()).b_id_farms).toEqual([])
    expect(createFarmGroup).toHaveBeenCalledWith(mockFdm, "user-1", "org-1", "Project A")
  })

  it("returns 400 for an empty name", async () => {
    const res = await makeApp().request("/organizations/org-1/farm-groups", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ b_name_group: "" }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).type).toContain("validation-failed")
  })

  it("returns 409 when the name already exists", async () => {
    const createFarmGroup = vi
      .fn()
      .mockRejectedValue(
        coreError("A farm group with this name already exists in the organization"),
      )
    const res = await makeApp({ createFarmGroup }).request("/organizations/org-1/farm-groups", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ b_name_group: "Project A" }),
    })
    expect(res.status).toBe(409)
    expect((await res.json()).type).toContain("conflict")
  })

  it("returns 415 without a JSON content type", async () => {
    const res = await makeApp().request("/organizations/org-1/farm-groups", {
      method: "POST",
      headers,
      body: "name",
    })
    expect(res.status).toBe(415)
  })
})

describe("GET /farm-groups/{b_id_group}", () => {
  beforeEach(() => validKey())

  it("returns the group with its member farms", async () => {
    const getFarmGroup = vi.fn().mockResolvedValue(group)
    const res = await makeApp({ getFarmGroup }).request("/farm-groups/group-1", { headers })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.b_id_farms).toEqual(["farm-1", "farm-2"])
    expect(body.created).toBeUndefined()
  })

  it("returns 404 when the group does not exist", async () => {
    const getFarmGroup = vi.fn().mockRejectedValue(coreError("Farm group not found"))
    const res = await makeApp({ getFarmGroup }).request("/farm-groups/missing", { headers })
    expect(res.status).toBe(404)
  })

  it("returns 403 when access is denied", async () => {
    const getFarmGroup = vi.fn().mockRejectedValue(new Error("Permission denied"))
    const res = await makeApp({ getFarmGroup }).request("/farm-groups/group-1", { headers })
    expect(res.status).toBe(403)
  })
})

describe("PATCH /farm-groups/{b_id_group}", () => {
  beforeEach(() => validKey())

  it("renames the group", async () => {
    const renameFarmGroup = vi.fn().mockResolvedValue(undefined)
    const getFarmGroup = vi.fn().mockResolvedValue({ ...group, b_name_group: "Renamed" })
    const res = await makeApp({ renameFarmGroup, getFarmGroup }).request("/farm-groups/group-1", {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ b_name_group: "Renamed" }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).b_name_group).toBe("Renamed")
    expect(renameFarmGroup).toHaveBeenCalledWith(mockFdm, "user-1", "group-1", "Renamed")
  })

  it("returns 409 when the name is in use", async () => {
    const renameFarmGroup = vi.fn().mockRejectedValue(coreError("already exists"))
    const res = await makeApp({ renameFarmGroup }).request("/farm-groups/group-1", {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ b_name_group: "Taken" }),
    })
    expect(res.status).toBe(409)
  })

  it("returns 400 for an invalid body", async () => {
    const res = await makeApp().request("/farm-groups/group-1", {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

describe("DELETE /farm-groups/{b_id_group}", () => {
  beforeEach(() => validKey())

  it("returns 204", async () => {
    const removeFarmGroup = vi.fn().mockResolvedValue(undefined)
    const res = await makeApp({ removeFarmGroup }).request("/farm-groups/group-1", {
      method: "DELETE",
      headers,
    })
    expect(res.status).toBe(204)
    expect(removeFarmGroup).toHaveBeenCalledWith(mockFdm, "user-1", "group-1")
  })

  it("returns 403 when access is denied", async () => {
    const removeFarmGroup = vi.fn().mockRejectedValue(new Error("Permission denied"))
    const res = await makeApp({ removeFarmGroup }).request("/farm-groups/group-1", {
      method: "DELETE",
      headers,
    })
    expect(res.status).toBe(403)
  })
})

describe("farm group membership", () => {
  beforeEach(() => validKey())

  it("POST records a joining and returns the group", async () => {
    const addFarmToGroup = vi.fn().mockResolvedValue(undefined)
    const getFarmGroup = vi.fn().mockResolvedValue(group)
    const res = await makeApp({ addFarmToGroup, getFarmGroup }).request(
      "/farm-groups/group-1/farms",
      { method: "POST", headers: jsonHeaders, body: JSON.stringify({ b_id_farm: "farm-1" }) },
    )
    expect(res.status).toBe(201)
    expect(addFarmToGroup).toHaveBeenCalledWith(mockFdm, "user-1", "group-1", "farm-1", undefined)
  })

  it("POST records the dates chosen by the caller", async () => {
    const addFarmToGroup = vi.fn().mockResolvedValue(undefined)
    const removeFarmFromGroup = vi.fn().mockResolvedValue(undefined)
    const getFarmGroup = vi.fn().mockResolvedValue(group)
    const res = await makeApp({ addFarmToGroup, removeFarmFromGroup, getFarmGroup }).request(
      "/farm-groups/group-1/farms",
      {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          b_id_farm: "farm-1",
          b_group_joined: "2020-03-01",
          b_group_leaved: "2021-03-01",
        }),
      },
    )
    expect(res.status).toBe(201)
    expect(addFarmToGroup).toHaveBeenCalledWith(
      mockFdm,
      "user-1",
      "group-1",
      "farm-1",
      new Date("2020-03-01"),
    )
    expect(removeFarmFromGroup).toHaveBeenCalledWith(
      mockFdm,
      "user-1",
      "group-1",
      "farm-1",
      new Date("2021-03-01"),
    )
  })

  it("POST returns 400 when the end date is not after the start date", async () => {
    const res = await makeApp().request("/farm-groups/group-1/farms", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        b_id_farm: "farm-1",
        b_group_joined: "2021-03-01",
        b_group_leaved: "2021-03-01",
      }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).type).toContain("validation-failed")
  })

  it("POST returns 400 for a date that is not YYYY-MM-DD", async () => {
    const res = await makeApp().request("/farm-groups/group-1/farms", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ b_id_farm: "farm-1", b_group_joined: "01-03-2020" }),
    })
    expect(res.status).toBe(400)
  })

  it("POST returns 409 when the farm already is part of the group from a later date", async () => {
    const addFarmToGroup = vi
      .fn()
      .mockRejectedValue(coreError("Farm already is part of the group from a later date"))
    const res = await makeApp({ addFarmToGroup }).request("/farm-groups/group-1/farms", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ b_id_farm: "farm-1", b_group_joined: "2010-01-01" }),
    })
    expect(res.status).toBe(409)
  })

  it("POST returns 422 for a farm outside the organization", async () => {
    const addFarmToGroup = vi
      .fn()
      .mockRejectedValue(coreError("Farm does not belong to the organization of the group"))
    const res = await makeApp({ addFarmToGroup }).request("/farm-groups/group-1/farms", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ b_id_farm: "farm-x" }),
    })
    expect(res.status).toBe(422)
  })

  it("POST returns 400 without b_id_farm", async () => {
    const res = await makeApp().request("/farm-groups/group-1/farms", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it("DELETE passes the end date chosen by the caller", async () => {
    const removeFarmFromGroup = vi.fn().mockResolvedValue(undefined)
    const res = await makeApp({ removeFarmFromGroup }).request(
      "/farm-groups/group-1/farms/farm-1?b_group_leaved=2021-03-01",
      { method: "DELETE", headers },
    )
    expect(res.status).toBe(204)
    expect(removeFarmFromGroup).toHaveBeenCalledWith(
      mockFdm,
      "user-1",
      "group-1",
      "farm-1",
      new Date("2021-03-01"),
    )
  })

  it("DELETE returns 409 when the membership already has an end date", async () => {
    const removeFarmFromGroup = vi
      .fn()
      .mockRejectedValue(coreError("The membership already has an end date"))
    const res = await makeApp({ removeFarmFromGroup }).request(
      "/farm-groups/group-1/farms/farm-1",
      { method: "DELETE", headers },
    )
    expect(res.status).toBe(409)
  })

  it("DELETE records a leaving and returns 204", async () => {
    const removeFarmFromGroup = vi.fn().mockResolvedValue(undefined)
    const res = await makeApp({ removeFarmFromGroup }).request(
      "/farm-groups/group-1/farms/farm-1",
      { method: "DELETE", headers },
    )
    expect(res.status).toBe(204)
    expect(removeFarmFromGroup).toHaveBeenCalledWith(
      mockFdm,
      "user-1",
      "group-1",
      "farm-1",
      undefined,
    )
  })
})

describe("GET /farms?b_id_group", () => {
  beforeEach(() => validKey())

  it("lists only the farms of the group", async () => {
    const farm = (id: string) => ({
      b_id_farm: id,
      b_name_farm: id,
      b_businessid_farm: null,
      b_address_farm: null,
      b_postalcode_farm: null,
      roles: [],
    })
    const getFarms = vi.fn().mockResolvedValue([farm("farm-1"), farm("farm-3")])
    const getFarmGroup = vi.fn().mockResolvedValue(group)
    const res = await makeApp({ getFarms, getFarmGroup }).request("/farms?b_id_group=group-1", {
      headers,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.map((f: { b_id_farm: string }) => f.b_id_farm)).toEqual(["farm-1"])
  })
})

describe("PATCH /farm-groups/{b_id_group}/farms/{b_id_farm}", () => {
  beforeEach(() => validKey())

  it("changes the dates of a period and returns the group", async () => {
    const updateFarmGroupMembership = vi.fn().mockResolvedValue(undefined)
    const getFarmGroup = vi.fn().mockResolvedValue(group)
    const res = await makeApp({ updateFarmGroupMembership, getFarmGroup }).request(
      "/farm-groups/group-1/farms/farm-1",
      {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({
          b_group_joined: "2020-01-01",
          new_b_group_joined: "2019-06-01",
          new_b_group_leaved: null,
        }),
      },
    )
    expect(res.status).toBe(200)
    expect(updateFarmGroupMembership).toHaveBeenCalledWith(
      mockFdm,
      "user-1",
      "group-1",
      "farm-1",
      new Date("2020-01-01"),
      { b_group_joined: new Date("2019-06-01"), b_group_leaved: null },
    )
  })

  it("returns 409 when the period overlaps another period", async () => {
    const updateFarmGroupMembership = vi
      .fn()
      .mockRejectedValue(coreError("The period overlaps another period of the farm in the group"))
    const res = await makeApp({ updateFarmGroupMembership }).request(
      "/farm-groups/group-1/farms/farm-1",
      {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ b_group_joined: "2020-01-01", new_b_group_leaved: "2030-01-01" }),
      },
    )
    expect(res.status).toBe(409)
  })

  it("returns 404 when no period starts on that date", async () => {
    const updateFarmGroupMembership = vi
      .fn()
      .mockRejectedValue(coreError("Farm group membership not found"))
    const res = await makeApp({ updateFarmGroupMembership }).request(
      "/farm-groups/group-1/farms/farm-1",
      {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ b_group_joined: "2020-01-01", new_b_group_leaved: "2030-01-01" }),
      },
    )
    expect(res.status).toBe(404)
  })

  it("returns 400 for a missing start date and 401 without a key", async () => {
    const bad = await makeApp().request("/farm-groups/group-1/farms/farm-1", {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({}),
    })
    expect(bad.status).toBe(400)
    const noKey = await makeApp().request("/farm-groups/group-1/farms/farm-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ b_group_joined: "2020-01-01" }),
    })
    expect(noKey.status).toBe(401)
  })
})
