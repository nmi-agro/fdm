import { runMigration, fdmSchema as schema, syncCatalogues } from "@nmi-agro/fdm-core"
import { runHelpdeskMigration } from "@nmi-agro/fdm-helpdesk"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

async function main() {
  // Get credentials to connect to db
  const host =
    process.env.POSTGRES_HOST ??
    (() => {
      throw new Error("POSTGRES_HOST environment variable is required")
    })()
  const port =
    Number(process.env.POSTGRES_PORT) ||
    (() => {
      throw new Error("POSTGRES_PORT environment variable is required")
    })()
  const user =
    process.env.POSTGRES_USER ??
    (() => {
      throw new Error("POSTGRES_USER environment variable is required")
    })()
  const password =
    process.env.POSTGRES_PASSWORD ??
    (() => {
      throw new Error("POSTGRES_PASSWORD environment variable is required")
    })()
  const database =
    process.env.POSTGRES_DB ??
    (() => {
      throw new Error("POSTGRES_DB environment variable is required")
    })()

  const client = postgres({
    host: host,
    port: port,
    user: user,
    password: password,
    database: database,
    max: 1,
  })

  // Run the schema migrations and sync catalogues; always close the connection.
  try {
    await runMigration(client)
    await runHelpdeskMigration(client)

    const fdm = drizzle(client, {
      mode: "postgres",
      logger: false,
      schema: schema,
    })
    const nmiApiKey = process.env.NMI_API_KEY
    if (!nmiApiKey) {
      console.warn(
        "NMI_API_KEY is not set: the phosphate contents of crops cannot be retrieved, the phosphate removal in the balance will be 0 ⚠️",
      )
    }
    await syncCatalogues(fdm, { nmiApiKey })
    const [phosphate] = await client`
      select count(*)::int as total, count(b_lu_p_harvestable)::int as with_phosphate
      from "fdm"."cultivations_catalogue" where b_lu_source = 'brp'`
    console.log(
      `Cultivation catalogue: ${phosphate.with_phosphate} of ${phosphate.total} BRP crops have a phosphate content`,
    )
    console.log("Sync completed ✅")
  } catch (error) {
    console.error("Error during migration/sync 🚨:", error)
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error("Fatal error during migration 🚨:", error)
  process.exit(1)
})
