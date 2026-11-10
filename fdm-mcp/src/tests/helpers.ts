import type { FdmApiServices } from "@nmi-agro/fdm-api"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { vi } from "vitest"
import { createFdmMcp, type FdmMcpConfig } from "../index"

/** Protocol revisions the tests run against. */
export const ERAS = [
  { name: "2026-07-28", versionNegotiation: { mode: "auto" as const } },
  { name: "2025-11-25", versionNegotiation: { mode: "legacy" as const } },
]

export const config: FdmMcpConfig = { appName: "Test App", appUrl: "https://mcp.test.example" }

/** Rate-limit counts per key that the mock database returns; 1 when not set. */
export const rateLimitCounts: Record<string, number> = {}

/** A database mock that only supports the rate-limit upsert. */
export function makeMockFdm() {
  let lastKey = ""
  const fdm = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn(function (this: unknown, row: { key: string }) {
      lastKey = row.key
      return this
    }),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn(async () => [
      { count: rateLimitCounts[lastKey] ?? 1, lastRequest: Date.now() },
    ]),
    transaction: vi.fn(async (handler: (tx: unknown) => unknown) => handler(fdm)),
  }
  return fdm as any
}

/** An auth mock that accepts every key as key `key-1` of user `user-1`. */
export function makeMockAuth() {
  return {
    api: {
      verifyApiKey: vi.fn().mockResolvedValue({
        valid: true,
        error: null,
        key: { id: "key-1", referenceId: "user-1", name: "Assistant" },
      }),
    },
  } as any
}

/** Services every test needs: farms are small, so the usage limits pass. */
export const baseServices: Partial<FdmApiServices> = {
  countFieldsOfFarms: async () => ({}),
}

/** Builds the MCP app with mocked database, auth and services. */
export function makeApp(
  services: Partial<FdmApiServices> = {},
  overrides: { fdm?: any; auth?: any; config?: Partial<FdmMcpConfig> } = {},
) {
  const fdm = overrides.fdm ?? makeMockFdm()
  const auth = overrides.auth ?? makeMockAuth()
  const app = createFdmMcp(
    fdm,
    auth,
    { ...config, ...overrides.config },
    { ...baseServices, ...services },
  )
  return { app, fdm, auth }
}

/**
 * Connects an MCP client to the app in process. Requests go through the full Hono stack (CORS,
 * Origin check, auth, rate limits) via `app.request`.
 */
export async function connect(
  app: ReturnType<typeof makeApp>["app"],
  options: { era?: (typeof ERAS)[number]; headers?: Record<string, string> } = {},
) {
  const era = options.era ?? ERAS[0]
  const headers = options.headers ?? { "x-api-key": "test-key" }
  const transport = new StreamableHTTPClientTransport(new URL("http://mcp.test/mcp"), {
    fetch: async (url, init) => {
      const merged = new Headers(init?.headers)
      for (const [name, value] of Object.entries(headers)) merged.set(name, value)
      return app.request(String(url), { ...init, headers: merged })
    },
  })
  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { versionNegotiation: era.versionNegotiation },
  )
  await client.connect(transport)
  return client
}
