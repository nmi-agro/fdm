import { readFileSync } from "node:fs"
import postgres from "postgres"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { runMigration } from "./migrate"

describe("runMigration", () => {
  let client: ReturnType<typeof postgres>
  const migrationsFolderPath = "src/db/migrations" // Keep this as a constant

  beforeAll(async () => {
    // Check for required environment variables
    const requiredEnvVars = [
      "POSTGRES_HOST",
      "POSTGRES_PORT",
      "POSTGRES_USER",
      "POSTGRES_PASSWORD",
      "POSTGRES_DB",
    ]
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`)
      }
    }
    const host = String(process.env.POSTGRES_HOST)
    const port = Number(process.env.POSTGRES_PORT)
    if (Number.isNaN(port)) {
      throw new Error("POSTGRES_PORT must be a valid number")
    }
    const user = String(process.env.POSTGRES_USER)
    const password = String(process.env.POSTGRES_PASSWORD)
    const database = String(process.env.POSTGRES_DB)

    client = postgres({
      host,
      port,
      user,
      password,
      database,
      max: 1,
    })
  })

  afterAll(async () => {
    await client.end()
  })

  it("should run migration successfully", async () => {
    //Run migration
    await runMigration(client, migrationsFolderPath)
  })

  describe("0037_microsoft_account_oid", () => {
    const unsignedJwt = (claims: Record<string, unknown>) =>
      `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`
    const ids = ["ms-test-ok", "ms-test-mismatch", "ms-test-notoken", "ms-test-oidless"]

    afterAll(async () => {
      await client`DELETE FROM "fdm-authn"."account" WHERE id = ANY(${ids})`
      await client`DELETE FROM "fdm-authn"."user" WHERE id = ANY(${ids})`
    })

    it("backfills account_id with oid and skips problem rows", async () => {
      await runMigration(client, migrationsFolderPath)
      const sqlText = readFileSync("src/db/migrations/0037_microsoft_account_oid.sql", "utf8")
      const rows = [
        { id: "ms-test-ok", sub: "sub-ok", token: unsignedJwt({ sub: "sub-ok", oid: "oid-ok" }) },
        {
          id: "ms-test-mismatch",
          sub: "sub-x",
          token: unsignedJwt({ sub: "other", oid: "oid-x" }),
        },
        { id: "ms-test-notoken", sub: "sub-n", token: null },
        { id: "ms-test-oidless", sub: "sub-o", token: unsignedJwt({ sub: "sub-o" }) },
      ]
      for (const r of rows) {
        await client`INSERT INTO "fdm-authn"."user" (id, name, email, email_verified, created_at, updated_at)
          VALUES (${r.id}, 'Test', ${`${r.id}@example.com`}, true, now(), now())`
        await client`INSERT INTO "fdm-authn"."account" (id, account_id, provider_id, user_id, id_token, created_at, updated_at)
          VALUES (${r.id}, ${r.sub}, 'microsoft', ${r.id}, ${r.token}, now(), now())`
      }

      await client.unsafe(sqlText)
      await client.unsafe(sqlText)

      const result =
        await client`SELECT id, account_id FROM "fdm-authn"."account" WHERE id = ANY(${ids})`
      const byId = Object.fromEntries(result.map((r) => [r.id, r.account_id]))
      expect(byId["ms-test-ok"]).toBe("oid-ok")
      expect(byId["ms-test-mismatch"]).toBe("sub-x")
      expect(byId["ms-test-notoken"]).toBe("sub-n")
      expect(byId["ms-test-oidless"]).toBe("sub-o")
    })
  })

  it("should handle migration failure", async () => {
    const invalidMigrationsFolderPath = "invalid/path"

    // Spy on console.error to verify error handling
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    //Run migration
    await runMigration(client, invalidMigrationsFolderPath)

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("Migration failed 🚨:")

    // Restore original console.error
    consoleErrorSpy.mockRestore()
  })
})
