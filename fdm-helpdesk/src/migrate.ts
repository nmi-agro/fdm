import { runMigration as fdmCoreRunMigration } from "@nmi-agro/fdm-core"
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
    return fdmCoreRunMigration(client, migrationsFolderPath)
}
