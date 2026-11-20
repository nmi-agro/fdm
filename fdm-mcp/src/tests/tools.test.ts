/**
 * Tests for the tools: the list, annotations, structured results, paging and error mapping.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { TOOLS } from "../tools"
import { connect, ERAS, makeApp } from "./helpers"

const farm = (id: string) => ({
  b_id_farm: id,
  b_name_farm: `Bedrijf ${id}`,
  b_businessid_farm: null,
  b_address_farm: null,
  b_postalcode_farm: null,
})

const field = {
  b_id: "field-1",
  b_name: "Perceel Noord",
  b_id_farm: "farm-1",
  b_id_source: null,
  b_geometry: null,
  b_centroid: [5.2, 52.1] as [number, number],
  b_area: 3.5,
  b_perimeter: 840.2,
  b_bufferstrip: false,
  b_start: new Date("2023-01-01T00:00:00Z"),
  b_end: null,
  b_acquiring_method: "unknown",
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe.each(ERAS)("tools ($name)", (era) => {
  it("lists every tool in a fixed order with title, description, schemas and annotations", async () => {
    const { app } = makeApp()
    const client = await connect(app, { era })
    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name)).toEqual(TOOLS.map((tool) => tool.name))
    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy()
      expect(tool.description, tool.name).toBeTruthy()
      expect(tool.inputSchema.type, tool.name).toBe("object")
      expect(tool.outputSchema?.type, tool.name).toBe("object")
      expect(tool.annotations, tool.name).toBeDefined()
    }
    await client.close()
  })

  it("calls a read tool as the user of the API key and returns structured content", async () => {
    const getFarm = vi.fn().mockResolvedValue(farm("farm-1"))
    const { app } = makeApp({ getFarm })
    const client = await connect(app, { era })
    const result = await client.callTool({ name: "get_farm", arguments: { b_id_farm: "farm-1" } })
    expect(result.isError).toBeFalsy()
    expect(result.structuredContent).toEqual(farm("farm-1"))
    expect(getFarm).toHaveBeenCalledWith(expect.anything(), "user-1", "farm-1")
    await client.close()
  })
})

describe("server identity", () => {
  it("presents itself with the configured application name", async () => {
    const { app } = makeApp({}, { config: { appName: "MINAS2" } })
    const client = await connect(app)
    expect(client.getServerVersion()).toMatchObject({ name: "minas2", title: "MINAS2" })
    expect(client.getInstructions()).toContain("MINAS2")
    await client.close()
  })

  it("derives a slug for the programmatic server name", async () => {
    const { serverSlug } = await import("../mcp-server")
    expect(serverSlug("My App 2")).toBe("my-app-2")
    expect(serverSlug(" -- Mijn  Bedrijf! -- ")).toBe("mijn-bedrijf")
    expect(serverSlug("  ")).toBe("fdm")
  })
})

describe("tool annotations", () => {
  const external = Object.fromEntries(TOOLS.map((tool) => [tool.name, tool.external]))

  it("marks reads read-only, updates and deletes destructive, and updates idempotent", async () => {
    const { app } = makeApp()
    const client = await connect(app)
    const { tools } = await client.listTools()
    const annotations = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations]))
    expect(annotations.list_farms).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    expect(annotations.create_farm).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    })
    expect(annotations.update_field).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    })
    expect(annotations.delete_farm).toMatchObject({ readOnlyHint: false, destructiveHint: true })
    for (const tool of tools) {
      expect(tool.annotations?.openWorldHint, tool.name).toBe(external[tool.name])
    }
    await client.close()
  })
})

describe("paging", () => {
  it("returns pages of 50 with a cursor for the next page", async () => {
    const farms = Array.from({ length: 60 }, (_, i) => farm(`farm-${i}`))
    const { app } = makeApp({ getFarms: vi.fn().mockResolvedValue(farms) })
    const client = await connect(app)

    const first = await client.callTool({ name: "list_farms", arguments: {} })
    const page1 = first.structuredContent as { data: unknown[]; next_cursor: string; total: number }
    expect(page1.data).toHaveLength(50)
    expect(page1.total).toBe(60)
    expect(page1.next_cursor).toEqual(expect.any(String))

    const second = await client.callTool({
      name: "list_farms",
      arguments: { cursor: page1.next_cursor },
    })
    const page2 = second.structuredContent as { data: { b_id_farm: string }[]; next_cursor: null }
    expect(page2.data).toHaveLength(10)
    expect(page2.data[0].b_id_farm).toBe("farm-50")
    expect(page2.next_cursor).toBeNull()
    await client.close()
  })

  it("explains an invalid cursor", async () => {
    const { app } = makeApp({ getFarms: vi.fn().mockResolvedValue([]) })
    const client = await connect(app)
    const result = await client.callTool({ name: "list_farms", arguments: { cursor: "nonsense" } })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain("cursor is not valid")
    await client.close()
  })
})

describe("results and errors", () => {
  it("returns a structured confirmation for a delete", async () => {
    const removeFarm = vi.fn().mockResolvedValue(undefined)
    const { app } = makeApp({ removeFarm })
    const client = await connect(app)
    const result = await client.callTool({
      name: "delete_farm",
      arguments: { b_id_farm: "farm-1" },
    })
    expect(result.isError).toBeFalsy()
    expect(result.structuredContent).toEqual({ deleted: true })
    expect(removeFarm).toHaveBeenCalledWith(expect.anything(), "user-1", "farm-1")
    await client.close()
  })

  it("returns a not-found message the model can act on", async () => {
    const { app } = makeApp({ getField: vi.fn().mockResolvedValue(undefined) })
    const client = await connect(app)
    const result = await client.callTool({ name: "get_field", arguments: { b_id: "field-x" } })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain("field-x")
    await client.close()
  })

  it("reports a permission denial without internal details", async () => {
    const denied = new Error("Exception for getFarm", {
      cause: new Error("Principal does not have permission to perform this action"),
    })
    const { app } = makeApp({ getFarm: vi.fn().mockRejectedValue(denied) })
    const client = await connect(app)
    const result = await client.callTool({ name: "get_farm", arguments: { b_id_farm: "farm-2" } })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain("do not have permission")
    expect(JSON.stringify(result.content)).not.toContain("Principal")
    await client.close()
  })

  it("hides the message of an unexpected error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const { app } = makeApp({
      getFarm: vi.fn().mockRejectedValue(new Error("connection to 10.0.0.1 refused")),
    })
    const client = await connect(app)
    const result = await client.callTool({ name: "get_farm", arguments: { b_id_farm: "farm-1" } })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain("unexpected error")
    expect(JSON.stringify(result.content)).not.toContain("10.0.0.1")
    await client.close()
  })

  it("reports a result that does not match the output schema without its data", async () => {
    const { app } = makeApp({
      getFarm: vi.fn().mockResolvedValue({ ...farm("farm-1"), b_name_farm: 987_654_321 }),
    })
    const client = await connect(app)
    const result = await client.callTool({ name: "get_farm", arguments: { b_id_farm: "farm-1" } })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain("unexpected error")
    expect(JSON.stringify(result.content)).not.toContain("987654321")
    await client.close()
  })

  it("rejects arguments that do not match the input schema without running the tool", async () => {
    const getField = vi.fn()
    const { app } = makeApp({ getField })
    const client = await connect(app)
    const result = await client.callTool({ name: "get_field", arguments: {} })
    expect(result.isError).toBe(true)
    expect(getField).not.toHaveBeenCalled()
    await client.close()
  })

  it("serialises dates as YYYY-MM-DD", async () => {
    const { app } = makeApp({ getField: vi.fn().mockResolvedValue(field) })
    const client = await connect(app)
    const result = await client.callTool({ name: "get_field", arguments: { b_id: "field-1" } })
    expect(result.isError).toBeFalsy()
    expect((result.structuredContent as { b_start: string }).b_start).toBe("2023-01-01")
    await client.close()
  })
})
