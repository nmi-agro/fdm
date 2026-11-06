/**
 * Global setup of the `integration` Vitest project: prepares the test database once per run,
 * the same way the app does before it starts (`app/lib/fdm-migrate.server.js`).
 */
import type { TestProject } from "vitest/node"
import { fdmSchema, runMigration, syncCatalogues } from "@nmi-agro/fdm-core"
import { runHelpdeskMigration } from "@nmi-agro/fdm-helpdesk"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

const REQUIRED = [
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DB",
] as const

/**
 * Runs the migrations and syncs the catalogues (without the measures catalogue, which needs an
 * NMI API key).
 *
 * @param _project - The Vitest project (unused).
 * @throws When a `POSTGRES_*` variable is missing or the database is not usable afterwards.
 */
export default async function setup(_project: TestProject): Promise<void> {
  const missing = REQUIRED.filter((name) => !process.env[name])
  if (missing.length > 0) {
    throw new Error(
      `The integration tests need a PostGIS test database. Set ${missing.join(", ")}, for example in fdm-app/.env.test (see test/README.md).`,
    )
  }

  const client = postgres({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    max: 1,
    onnotice: () => {},
  })
  try {
    await runMigration(client)
    await runHelpdeskMigration(client)
    const fdm = drizzle(client, { logger: false, schema: fdmSchema })
    // `runMigration` logs a failed migration instead of throwing, so check the result here.
    await fdm.select().from(fdmSchema.farms).limit(1)
    await syncCatalogues(fdm, {})
  } finally {
    await client.end()
  }
}
