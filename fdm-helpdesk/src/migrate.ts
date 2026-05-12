import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import type postgres from "postgres"

/**
 * Creates the fdm-helpdesk schema if it is missing, then migrates it
 *
 * @param client PostgresJS client connected to the database to migrate
 * @param migrationsFolderPath custom folder path for the migration files
 * @returns a Promise that always resolves. Check the console messages to see if there is a failure.
 */
export async function runHelpdeskMigration(
    client: ReturnType<typeof postgres>,
    migrationsFolderPath = "node_modules/@nmi-agro/fdm-helpdesk/dist/db/migrations",
) {
    console.log("Migration started ⌛")

    const db: PostgresJsDatabase = drizzle(client)
    try {
        await migrate(db, {
            migrationsFolder: migrationsFolderPath,
            migrationsSchema: "fdm-helpdesk-migrations",
        })
        console.log("Migration completed ✅")
    } catch (error) {
        console.error("Migration failed 🚨:", error)
    }
}
