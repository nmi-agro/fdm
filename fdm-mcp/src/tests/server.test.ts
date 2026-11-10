/**
 * Unit tests for the server building blocks: the analytics filter, the server factory, cursors,
 * the output validation of tool results, and the error paths of resources and the HTTP endpoint.
 */
import { ApiError } from "@nmi-agro/fdm-api"
import { defineOperation } from "@nmi-agro/fdm-api/operations"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { scrubEvent } from "../analytics"
import { decodeCursor, encodeCursor } from "../cursor"
import { createServerFactory, logRejectedRequest } from "../index"
import { listTool } from "../tools"
import { connect, makeApp, makeMockFdm, rateLimitCounts } from "./helpers"

afterEach(() => {
  vi.restoreAllMocks()
  for (const key of Object.keys(rateLimitCounts)) delete rateLimitCounts[key]
})

describe("cursors", () => {
  it("round-trips an offset", () => {
    expect(decodeCursor(encodeCursor(150))).toBe(150)
    expect(decodeCursor(undefined)).toBe(0)
    expect(decodeCursor("")).toBe(0)
  })

  it.each([
    Buffer.from(JSON.stringify({ o: -1 })).toString("base64url"),
    Buffer.from(JSON.stringify({ o: "5" })).toString("base64url"),
  ])("refuses a cursor with an invalid offset", (cursor) => {
    expect(() => decodeCursor(cursor)).toThrow(ApiError)
  })
})

describe("analytics filter", () => {
  it("drops exception events", () => {
    expect(scrubEvent({ event: "$exception", properties: {} })).toBeNull()
  })

  it("removes arguments, results and error messages", () => {
    const event = scrubEvent({
      event: "$mcp_tool_call",
      properties: {
        $mcp_tool_name: "get_farm",
        $mcp_parameters: { b_id_farm: "farm-1" },
        $mcp_response: { b_name_farm: "Bedrijf" },
        $mcp_error_message: "Farm 'farm-1' not found.",
        $exception_list: [],
      },
    })
    expect(event?.properties).toEqual({ $mcp_tool_name: "get_farm" })
  })
})

describe("server factory", () => {
  it("refuses a request without a principal", () => {
    const factory = createServerFactory({ appName: "Test" }, makeMockFdm(), {} as never)
    expect(() => factory({})).toThrow(ApiError)
  })

  it("logs rejected requests without their content", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    logRejectedRequest(new Error("header mismatch"))
    expect(warn).toHaveBeenCalledWith("[fdm-mcp] request rejected: header mismatch")
  })
})

describe("output validation", () => {
  it("reports every item that does not match the schema once, without data", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {})
    const farms = [1, 2].map((i) => ({
      b_id_farm: `farm-${i}`,
      b_name_farm: 987_654_321,
      b_businessid_farm: null,
      b_address_farm: null,
      b_postalcode_farm: null,
    }))
    const { app } = makeApp({ getFarms: vi.fn().mockResolvedValue(farms) })
    const client = await connect(app)
    const result = await client.callTool({ name: "list_farms", arguments: {} })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).not.toContain("987654321")
    const line = log.mock.calls.map((call) => String(call[0])).find((l) => l.includes("list_farms"))
    expect(line).toContain("output-schema at data.*.b_name_farm")
    await client.close()
  })
})

describe("list tools", () => {
  it("adds the cursor to an input schema with refinements", async () => {
    const listRange = defineOperation({
      name: "listRange",
      kind: "read",
      bucket: "general",
      input: z
        .object({ from: z.number(), to: z.number() })
        .refine((value) => value.from <= value.to, { message: "from after to" }),
      output: z.array(z.number()),
      run: async (_ctx, { from, to }) =>
        Array.from({ length: to - from + 1 }, (_value, index) => from + index),
    })
    const tool = listTool(listRange, { name: "list_range", title: "List", description: "d" })
    const ctx = { fdm: makeMockFdm(), services: {} as never, principal: {} as never }
    const result = (await tool.run(ctx, tool.input.parse({ from: 1, to: 60 }))) as {
      data: number[]
      next_cursor: string | null
    }
    expect(result.data).toHaveLength(50)
    expect(result.next_cursor).not.toBeNull()
    expect(() => tool.input.parse({ from: 5, to: 1 })).toThrow()
  })
})

describe("protocol requests", () => {
  it("counts a JSON-RPC batch without tool calls once in the general bucket", async () => {
    const { app, fdm } = makeApp()
    await app.request("/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "x-api-key": "key",
      },
      body: JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }]),
    })
    expect(fdm.values).toHaveBeenCalledTimes(1)
    expect(fdm.values).toHaveBeenCalledWith(
      expect.objectContaining({ key: "fdm-api:key-1:general" }),
    )
  })
})

describe("resource errors", () => {
  it("refuses a resource read over the general rate limit, counted once per request", async () => {
    const getFarm = vi.fn()
    const { app } = makeApp({ getFarm })
    const client = await connect(app)
    rateLimitCounts["fdm-api:key-1:general"] = 121
    await expect(client.readResource({ uri: "fdm://farms/farm-1" })).rejects.toThrow()
    expect(getFarm).not.toHaveBeenCalled()
    await client.close()
  })

  it("reports an unexpected failure as an internal error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const { app } = makeApp({ getField: vi.fn().mockRejectedValue(new Error("down")) })
    const client = await connect(app)
    await expect(client.readResource({ uri: "fdm://fields/field-1" })).rejects.toThrow()
    await client.close()
  })
})

describe("HTTP limits and analytics settings", () => {
  it("refuses a body larger than 5 MB with 413", async () => {
    const { app } = makeApp()
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "key" },
      body: `{"padding":"${"x".repeat(5 * 1024 * 1024)}"}`,
    })
    expect(res.status).toBe(413)
  })

  it("sends the server build to PostHog when it is configured", async () => {
    const { PostHog } = await import("@posthog/mcp")
    const posthog = new PostHog("phc_test", { host: "https://posthog.test", flushAt: 1000 })
    const { app } = makeApp({}, { config: { analytics: { posthog, serverBuild: "abc123" } } })
    const client = await connect(app)
    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name)).toContain("get_more_tools")
    await client.close()
    await posthog.shutdown(100)
  })
})
