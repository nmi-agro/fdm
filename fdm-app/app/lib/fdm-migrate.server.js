import {
    runMigration,
    fdmSchema as schema,
    syncCatalogues,
} from "@nmi-agro/fdm-core"
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
            throw new Error(
                "POSTGRES_PASSWORD environment variable is required",
            )
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

        const fdm = drizzle(client, {
            mode: "postgres",
            logger: false,
            schema: schema,
        })
        const nmiApiKey = process.env.NMI_API_KEY
        await syncCatalogues(fdm, { nmiApiKey })
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
