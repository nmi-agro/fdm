/**
 * Tests for rate limits and the audit context: MCP calls share the per-key buckets of the REST
 * API, and changes are recorded with audit channel `mcp`.
 */
import { getAuditContext } from "@nmi-agro/fdm-core"
import { afterEach, describe, expect, it, vi } from "vitest"
import { connect, makeApp, rateLimitCounts } from "./helpers"

afterEach(() => {
  for (const key of Object.keys(rateLimitCounts)) delete rateLimitCounts[key]
})

const farm = {
  b_id_farm: "farm-1",
  b_name_farm: "Proefbedrijf",
  b_businessid_farm: null,
  b_address_farm: null,
  b_postalcode_farm: null,
}

describe("rate limits", () => {
  it("counts a tool call in the bucket of its operation, under the same key as REST", async () => {
    const { app, fdm } = makeApp({
      getFarm: vi.fn().mockResolvedValue(farm),
      updateFarm: vi.fn().mockResolvedValue(farm),
    })
    const client = await connect(app)
    await client.callTool({
      name: "update_farm",
      arguments: { b_id_farm: "farm-1", b_name_farm: "Nieuw" },
    })
    expect(fdm.values).toHaveBeenCalledWith(expect.objectContaining({ key: "fdm-api:key-1:write" }))
    await client.close()
  })

  it("counts protocol requests such as tools/list in the general bucket", async () => {
    const { app, fdm } = makeApp()
    const client = await connect(app)
    fdm.values.mockClear()
    await client.listTools()
    expect(fdm.values).toHaveBeenCalledWith(
      expect.objectContaining({ key: "fdm-api:key-1:general" }),
    )
    await client.close()
  })

  it("counts every other message of a batch that also holds a tool call", async () => {
    const { app, fdm } = makeApp({
      getFarm: vi.fn().mockResolvedValue(farm),
      updateFarm: vi.fn().mockResolvedValue(farm),
    })
    const read = (id: number) => ({
      jsonrpc: "2.0",
      id,
      method: "resources/read",
      params: { uri: "fdm://farms/farm-1" },
    })
    await app.request("/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "x-api-key": "key",
      },
      body: JSON.stringify([
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          // A write tool, so its own count goes to the write bucket and not to the general one.
          params: { name: "update_farm", arguments: { b_id_farm: "farm-1", b_name_farm: "Nieuw" } },
        },
        read(2),
        read(3),
      ]),
    })
    const generalCounts = fdm.values.mock.calls.filter(
      ([row]: [{ key: string }]) => row.key === "fdm-api:key-1:general",
    )
    expect(generalCounts).toHaveLength(2)
  })

  it("returns a tool error with the seconds to wait when the bucket is full", async () => {
    const getFarm = vi.fn()
    const { app } = makeApp({ getFarm })
    const client = await connect(app)
    rateLimitCounts["fdm-api:key-1:general"] = 121
    const result = await client.callTool({ name: "get_farm", arguments: { b_id_farm: "farm-1" } })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toMatch(/Retry after \d+ s/)
    expect(getFarm).not.toHaveBeenCalled()
    await client.close()
  })

  it("answers 429 with Retry-After when protocol requests exceed the general bucket", async () => {
    const { app } = makeApp()
    rateLimitCounts["fdm-api:key-1:general"] = 121
    const res = await app.request("/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "x-api-key": "key",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    })
    expect(res.status).toBe(429)
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0)
  })
})

describe("audit context", () => {
  it("runs tools with audit channel mcp and the API key as credential", async () => {
    let audit: unknown
    const getFarm = vi.fn(async () => {
      audit = getAuditContext()
      return farm
    })
    const { app } = makeApp({ getFarm })
    const client = await connect(app)
    const result = await client.callTool({ name: "get_farm", arguments: { b_id_farm: "farm-1" } })
    expect(result.isError).toBeFalsy()
    expect(audit).toEqual({ channel: "mcp", credential_id: "key-1" })
    await client.close()
  })
})
