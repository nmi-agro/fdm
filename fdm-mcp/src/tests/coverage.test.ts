/**
 * The parity guard: every operation of the REST API is available as an MCP tool, or deliberately
 * excluded with a reason. A new REST endpoint without a decision fails here.
 */
import { createFdmApi } from "@nmi-agro/fdm-api"
import { describe, expect, it } from "vitest"
import { EXCLUDED_OPERATIONS, TOOLS } from "../tools"
import { makeMockAuth, makeMockFdm } from "./helpers"

async function restOperationIds(): Promise<string[]> {
  const api = createFdmApi(makeMockFdm(), makeMockAuth(), {
    appName: "Test App",
    appUrl: "https://api.test.example",
  })
  const doc = (await (await api.request("/openapi.json")).json()) as {
    paths: Record<string, Record<string, { operationId?: string }>>
  }
  return Object.values(doc.paths).flatMap((path) =>
    Object.values(path).flatMap((operation) =>
      operation.operationId ? [operation.operationId] : [],
    ),
  )
}

describe("parity between the REST API and the MCP tools", () => {
  it("covers every REST operation with a tool or a reasoned exclusion", async () => {
    const operationIds = await restOperationIds()
    const covered = new Set(TOOLS.flatMap((tool) => tool.operations))
    const missing = operationIds.filter((id) => !covered.has(id) && !(id in EXCLUDED_OPERATIONS))
    expect(missing, "add a tool or an EXCLUDED_OPERATIONS entry for these operations").toEqual([])
  })

  it("has no exclusion for an operation that does not exist or that a tool covers", async () => {
    const operationIds = new Set(await restOperationIds())
    const covered = new Set(TOOLS.flatMap((tool) => tool.operations))
    const stale = Object.keys(EXCLUDED_OPERATIONS).filter(
      (id) => !operationIds.has(id) || covered.has(id),
    )
    expect(stale, "remove these entries from EXCLUDED_OPERATIONS").toEqual([])
    for (const [id, reason] of Object.entries(EXCLUDED_OPERATIONS)) {
      expect(reason.trim().length, id).toBeGreaterThan(10)
    }
  })

  it("only maps tools to REST operations that exist", async () => {
    const operationIds = new Set(await restOperationIds())
    const unknown = TOOLS.flatMap((tool) => tool.operations).filter((id) => !operationIds.has(id))
    expect(unknown).toEqual([])
  })

  it("keeps the tool list short and the tool names unique", () => {
    const names = TOOLS.map((tool) => tool.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names.length).toBeLessThanOrEqual(70)
    for (const name of names) {
      expect(name).toMatch(/^[a-z]+(_[a-z0-9]+)*$/)
    }
  })
})
