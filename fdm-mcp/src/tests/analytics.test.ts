/**
 * Tests for PostHog MCP analytics: events are tied to the user and never contain tool arguments,
 * results or error messages.
 */
import { PostHog } from "@posthog/mcp"
import { gunzipSync } from "node:zlib"
import { describe, expect, it, vi } from "vitest"
import { PRIVATE_EVENT_PROPERTIES } from "../analytics"
import { connect, makeApp } from "./helpers"

interface SentEvent {
  event: string
  distinct_id: string
  properties: Record<string, unknown>
}

/** A real posthog-node client whose network requests are captured instead of sent. */
function makePostHog() {
  const sent: SentEvent[] = []
  const posthog = new PostHog("phc_test", {
    host: "https://posthog.test",
    flushAt: 1,
    flushInterval: 0,
    disableGeoip: true,
    fetch: async (_url, options) => {
      const raw = options.body
      const text =
        typeof raw === "string"
          ? raw
          : gunzipSync(Buffer.from(await new Response(raw as BodyInit).arrayBuffer())).toString()
      const payload = JSON.parse(text) as { batch?: SentEvent[] }
      sent.push(...(payload.batch ?? []))
      return { status: 200, text: async () => "{}", json: async () => ({}) } as never
    },
  })
  return { posthog, sent }
}

describe("PostHog MCP analytics", () => {
  it("records tool calls for the user without arguments, results or error messages", async () => {
    const { posthog, sent } = makePostHog()
    const getFarm = vi.fn().mockResolvedValue({
      b_id_farm: "farm-1",
      b_name_farm: "Geheim bedrijf",
      b_businessid_farm: null,
      b_address_farm: null,
      b_postalcode_farm: null,
    })
    const { app } = makeApp(
      { getFarm, getField: vi.fn().mockResolvedValue(undefined) },
      { config: { analytics: { posthog } } },
    )
    const client = await connect(app)

    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name)).toContain("get_more_tools")

    const ok = await client.callTool({
      name: "get_farm",
      arguments: { b_id_farm: "farm-1", context: "Look up the farm of the user" },
    })
    expect(ok.isError).toBeFalsy()
    expect(getFarm).toHaveBeenCalledWith(expect.anything(), "user-1", "farm-1")

    const failed = await client.callTool({
      name: "get_field",
      arguments: { b_id: "field-secret", context: "Look up a field" },
    })
    expect(failed.isError).toBe(true)

    await client.close()
    await posthog.flush()
    await posthog.shutdown()

    const toolCalls = sent.filter((event) => event.event === "$mcp_tool_call")
    expect(toolCalls.length).toBeGreaterThanOrEqual(2)
    for (const event of toolCalls) {
      expect(event.distinct_id).toBe("user-1")
      for (const property of PRIVATE_EVENT_PROPERTIES) {
        expect(event.properties, property).not.toHaveProperty(property)
      }
    }
    expect(sent.some((event) => event.event === "$exception")).toBe(false)
    const everything = JSON.stringify(sent)
    expect(everything).not.toContain("Geheim bedrijf")
    expect(everything).not.toContain("field-secret")
    expect(toolCalls.map((event) => event.properties.$mcp_tool_name)).toEqual(
      expect.arrayContaining(["get_farm", "get_field"]),
    )
  })

  it("sends no analytics without a PostHog client", async () => {
    const { app } = makeApp()
    const client = await connect(app)
    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name)).not.toContain("get_more_tools")
    await client.close()
  })
})
