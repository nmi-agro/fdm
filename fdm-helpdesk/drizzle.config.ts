import { defineConfig } from "drizzle-kit"

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const port = Number(requireEnv("POSTGRES_PORT"))
if (Number.isNaN(port)) {
  throw new Error("POSTGRES_PORT must be a valid number")
}

export default defineConfig({
  dialect: "postgresql",
  extensionsFilters: ["postgis"],
  schema: ["./src/db/schema-helpdesk.ts"],
  out: "./src/db/migrations",
  migrations: {
    table: "migrations",
    schema: "fdm-helpdesk-migration",
  },
  dbCredentials: {
    host: requireEnv("POSTGRES_HOST"),
    port,
    database: requireEnv("POSTGRES_DB"),
    user: requireEnv("POSTGRES_USER"),
    password: requireEnv("POSTGRES_PASSWORD"),
  },
})
