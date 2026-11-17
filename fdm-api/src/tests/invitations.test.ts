import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FdmApiServices } from "../index"
import { createFdmApi } from "../index"

const mockAuth = { api: { verifyApiKey: vi.fn() } } as any
const mockFdm = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ count: 1, lastRequest: Date.now() }]),
} as any
const config = { appName: "Test App", appUrl: "https://test.example.com" }
const headers = { "x-api-key": "valid" }

function validKey() {
  mockAuth.api.verifyApiKey.mockResolvedValue({
    valid: true,
    error: null,
    key: { id: "key-1", referenceId: "user-1", name: "Test key" },
  })
}

function makeApp(services: Partial<FdmApiServices> = {}) {
  return createFdmApi(mockFdm, mockAuth, config, {
    countFieldsOfFarms: async () => ({}),
    ...services,
  })
}

/** Builds an error the way fdm-core wraps it: a generic message with the original as cause. */
function coreError(message: string) {
  return new Error("Exception for acceptInvitation", { cause: new Error(message) })
}

describe("GET /invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  it("returns the pending farm invitations of the key owner", async () => {
    const listPendingInvitationsForUser = vi.fn().mockResolvedValue([
      {
        invitation_id: "inv-1",
        resource: "farm",
        resource_id: "farm-1",
        role: "advisor",
        farm_name: "De Hoeve",
        org_name: null,
        can_accept: true,
        expires: new Date("2026-11-10T12:00:00Z"),
      },
      {
        invitation_id: "inv-2",
        resource: "field",
        resource_id: "f-1",
        role: "advisor",
        farm_name: null,
        org_name: null,
        can_accept: true,
        expires: new Date("2026-11-10T12:00:00Z"),
      },
    ])
    const app = makeApp({ listPendingInvitationsForUser })
    const res = await app.request("/invitations", { headers })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      {
        invitation_id: "inv-1",
        b_id_farm: "farm-1",
        b_name_farm: "De Hoeve",
        role: "advisor",
        organization_name: null,
        can_accept: true,
        expires: "2026-11-10",
      },
    ])
    expect(listPendingInvitationsForUser).toHaveBeenCalledWith(mockFdm, "user-1", true)
  })

  it("returns 401 without an API key", async () => {
    const app = makeApp({ listPendingInvitationsForUser: vi.fn() })
    const res = await app.request("/invitations")
    expect(res.status).toBe(401)
  })
})

describe.each([
  ["accept", "acceptInvitation"],
  ["decline", "declineInvitation"],
] as const)("POST /invitations/:invitation_id/%s", (action, service) => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  const request = (app: ReturnType<typeof makeApp>) =>
    app.request(`/invitations/inv-1/${action}`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
    })

  it("responds to the invitation as the key owner", async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const res = await request(makeApp({ [service]: fn }))
    expect(res.status).toBe(204)
    expect(fn).toHaveBeenCalledWith(mockFdm, "inv-1", "user-1")
  })

  it.each([
    ["Invitation not found", 404, "not-found"],
    ["Invitation is already accepted", 409, "conflict"],
    ["Invitation has expired", 409, "conflict"],
    ["This invitation is not for you", 403, "forbidden"],
    ["Email must be verified before accepting an invitation", 422, "unprocessable-entity"],
  ])("maps '%s' to %i", async (message, status, slug) => {
    const fn = vi.fn().mockRejectedValue(coreError(message))
    const res = await request(makeApp({ [service]: fn }))
    expect(res.status).toBe(status)
    expect((await res.json()).type).toContain(slug)
  })

  it("returns 500 for an unexpected error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fn = vi.fn().mockRejectedValue(new Error("Database down"))
    const res = await request(makeApp({ [service]: fn }))
    expect(res.status).toBe(500)
  })

  it("returns 401 without an API key", async () => {
    const app = makeApp({ [service]: vi.fn() })
    const res = await app.request(`/invitations/inv-1/${action}`, { method: "POST" })
    expect(res.status).toBe(401)
  })
})
