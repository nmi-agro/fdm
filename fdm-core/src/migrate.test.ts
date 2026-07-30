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
