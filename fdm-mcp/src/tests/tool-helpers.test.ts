/**
 * Unit tests for the tool helpers: list tools, scoped tools and their validation.
 */
import { defineOperation } from "@nmi-agro/fdm-api/operations"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { listTool, operationTool, scopedListTool, scopedTool } from "../tools"
import { makeMockFdm } from "./helpers"

const principal = {
  userId: "user-1",
  apiKeyId: "key-1",
  keyName: null,
  channel: "mcp" as const,
  effectivePrincipalId: "user-1",
}
const ctx = { fdm: makeMockFdm(), services: {} as never, principal }

const readThing = defineOperation({
  name: "readThing",
  kind: "read",
  bucket: "general",
  input: z.object({ id: z.string().describe("Id.") }),
  output: z.object({ id: z.string() }),
  run: async (_ctx, { id }) => ({ id }),
})

const listThings = defineOperation({
  name: "listThings",
  kind: "read",
  bucket: "general",
  input: z
    .object({ from: z.number(), to: z.number() })
    .refine((value) => value.from <= value.to, { message: "from after to" }),
  output: z.array(z.number()),
  run: async (_ctx, { from, to }) =>
    Array.from({ length: to - from + 1 }, (_value, index) => from + index),
})

const writeThing = defineOperation({
  name: "writeThing",
  kind: "create",
  bucket: "write",
  input: z.object({ id: z.string() }),
  output: z.object({ id: z.string() }),
  run: async (_ctx, { id }) => ({ id }),
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("tool helpers", () => {
  it("adds the cursor to a refined input schema and pages the result", async () => {
    const tool = listTool(listThings, { name: "list_things", title: "List", description: "d" })
    const args = tool.input.parse({ from: 1, to: 60 })
    const result = (await tool.run(ctx, args)) as { data: number[]; next_cursor: string | null }
    expect(result.data).toHaveLength(50)
    expect(result.next_cursor).not.toBeNull()
    expect(() => tool.input.parse({ from: 5, to: 1 })).toThrow()
  })

  it("returns the single variant result of a scoped tool with one scope", async () => {
    const tool = scopedTool({ name: "read_thing", title: "Read", description: "d" }, [
      { scope: "thing", operation: readThing, key: "id" },
    ])
    expect(await tool.run(ctx, { id: "a" })).toEqual({ scope: "thing", result: { id: "a" } })
  })

  it("refuses variants of different kinds", () => {
    expect(() =>
      scopedTool({ name: "mixed", title: "Mixed", description: "d" }, [
        { scope: "read", operation: readThing, key: "id" },
        { scope: "write", operation: writeThing, key: "other" },
      ]),
    ).toThrow("same kind")
  })

  it("refuses a list variant that does not return an array", () => {
    expect(() =>
      scopedListTool({ name: "bad", title: "Bad", description: "d" }, [
        { scope: "thing", operation: readThing, key: "id" },
      ]),
    ).toThrow("does not return an array")
  })

  it("refuses an operation whose input is not an object", () => {
    const listWithUnion = defineOperation({
      ...listThings,
      name: "listWithUnion",
      input: z.union([z.object({ a: z.string() }), z.object({ b: z.string() })]),
    })
    expect(() =>
      scopedListTool({ name: "bad", title: "Bad", description: "d" }, [
        { scope: "thing", operation: listWithUnion, key: "a" },
      ]),
    ).toThrow("object schema")
  })

  it("names the scope arguments when a custom selector does not match", async () => {
    const tool = scopedListTool({ name: "list", title: "List", description: "d" }, [
      { scope: "custom", operation: listThings, when: () => false },
      { scope: "keyed", operation: listThings, key: "from" },
    ])
    await expect(tool.run(ctx, {})).rejects.toThrow("`from`")
  })

  it("reports invalid arguments of the chosen variant", async () => {
    const tool = scopedListTool({ name: "list", title: "List", description: "d" }, [
      { scope: "range", operation: listThings, key: "from" },
    ])
    await expect(tool.run(ctx, { from: 3 })).rejects.toThrow("Invalid arguments for range")
  })

  it("passes the operation through for a simple tool", async () => {
    const tool = operationTool(writeThing, { name: "write", title: "Write", description: "d" })
    expect(tool.bucket).toBe("write")
    expect(await tool.run(ctx, { id: "x" })).toEqual({ id: "x" })
  })
})
