import {
    runMigration,
    fdmSchema as schema,
    syncCatalogues,
} from "@nmi-agro/fdm-core"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

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
const migrationsFolderPath = require
    .resolve("@nmi-agro/fdm-core/package.json")
    .replace("package.json", "dist/db/migrations")

const client = postgres({
    host: host,
    port: port,
    user: user,
    password: password,
    database: database,
    max: 1,
})

// Run the schema migrations
await runMigration(client, migrationsFolderPath).catch((error) =>
    console.error("Error in migration process 🚨:", error),
)

// Sync catalogues
const fdm = drizzle(client, {
    mode: "postgres",
    logger: false,
    schema: schema,
})
await syncCatalogues(fdm).catch((error) =>
    console.error("Error in syncing catalogues 🚨:", error),
)

// Close the connection
await client.end()
process.exit(0)
