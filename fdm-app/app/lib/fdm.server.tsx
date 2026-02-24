import { fdmSchema as schema } from "@nmi-agro/fdm-core"
import { drizzle } from "drizzle-orm/postgres-js"
import { serverConfig } from "~/lib/config.server"

// Get credentials to connect to db
const host =
    serverConfig.database.host ??
    (() => {
        throw new Error("POSTGRES_HOST environment variable is required")
    })()
const port =
    serverConfig.database.port ||
    (() => {
        throw new Error("POSTGRES_PORT environment variable is required")
    })()
const user =
    serverConfig.database.user ??
    (() => {
        throw new Error("POSTGRES_USER environment variable is required")
    })()
const password =
    serverConfig.database.password ??
    (() => {
        throw new Error("POSTGRES_PASSWORD environment variable is required")
    })()
const database =
    serverConfig.database.database ??
    (() => {
        throw new Error("POSTGRES_DB environment variable is required")
    })()

export const fdm = drizzle({
    connection: {
        user: user,
        password: password,
        host: host,
        port: port,
        database: database,
    },
    logger: false,
    schema: schema,
})
