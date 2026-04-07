import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./db/schema"
import { handleError } from "./error"
import type { FdmServerType } from "./fdm-server.types"

export function createFdmServer(
    host: string | undefined,
    port: number | undefined,
    user: string | undefined,
    password: string | (() => string | Promise<string>) | undefined,
    database: string | undefined,
    max = 40,
): FdmServerType {
    try {
        const client = postgres({
            user: user,
            password: password,
            host: host,
            port: port,
            database: database,
            max: max,
        })
        // Create drizzle instance
        const db = drizzle(client, {
            logger: false,
            schema: schema,
        })

        return db as unknown as FdmServerType
    } catch (err) {
        throw handleError(err, "Exception for createFdmServer")
    }
}
