/**
 * Paths and settings shared by the Playwright projects in `e2e/`.
 */
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/** The fdm-app package folder. */
export const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

/** Working files of a run (seed ids, sign-in state, reports). Not committed. */
export const OUTPUT_DIR = join(APP_ROOT, "e2e", ".output")

/** The port of the app during a run. */
export const PORT = Number(process.env.E2E_PORT ?? 8080)

/** The origin of the app during a run. */
export const BASE_URL = `http://localhost:${PORT}`

/**
 * Returns a required environment variable.
 *
 * @param name - The name of the variable.
 * @returns Its value.
 * @throws When the variable is not set.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Environment variable ${name} is required for the e2e run`)
  return value
}

/**
 * Returns the connection settings of the test database from the `POSTGRES_*` variables.
 *
 * @returns Host, port, user, password and database name.
 */
export function databaseOptions() {
  return {
    host: requireEnv("POSTGRES_HOST"),
    port: Number(requireEnv("POSTGRES_PORT")),
    user: requireEnv("POSTGRES_USER"),
    password: requireEnv("POSTGRES_PASSWORD"),
    database: requireEnv("POSTGRES_DB"),
  }
}
