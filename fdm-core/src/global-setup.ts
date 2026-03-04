import postgres from "postgres"
import type { TestProject } from "vitest/node"
import * as authNSchema from "./db/schema-authn"
import * as authZSchema from "./db/schema-authz"
import { createFdmServer } from "./fdm-server"
import { runMigration } from "./migrate"

let client: ReturnType<typeof postgres>

export let migrationsRun = false

function validateEnvironment() {
    const requiredEnvVars = [
        "POSTGRES_HOST",
        "POSTGRES_PORT",
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
        "POSTGRES_DB",
    ]
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required environment variable: ${envVar}`)
        }
    }

    const host = String(process.env.POSTGRES_HOST)
    const port = Number(process.env.POSTGRES_PORT)
    if (Number.isNaN(port)) {
        throw new Error("POSTGRES_PORT must be a valid number")
    }
    const user = String(process.env.POSTGRES_USER)
    const password = String(process.env.POSTGRES_PASSWORD)
    const database = String(process.env.POSTGRES_DB)

    return { host, port, user, password, database }
}

export async function setup(project: TestProject) {
    const { host, port, user, password, database } = validateEnvironment()
    const migrationsFolderPath = "src/db/migrations"

    client = postgres({
        host,
        port,
        user,
        password,
        database,
        max: 1,
    })

    if (!migrationsRun) {
        await runMigration(client, migrationsFolderPath)
        migrationsRun = true
    }

    project.provide("host", host)
    project.provide("port", port)
    project.provide("user", user)
    project.provide("password", password)
    project.provide("database", database)
}

declare module "vitest" {
    export interface ProvidedContext {
        host: string
        port: number
        user: string
        password: string
        database: string
    }
}

export async function teardown() {
    const { host, port, user, password, database } = validateEnvironment()

    const fdm = createFdmServer(host, port, user, password, database)
    // Clean up all database tables
    try {
        await fdm.transaction(async () => {
            await fdm.delete(authNSchema.session).execute()
            await fdm.delete(authNSchema.verification).execute()
            await fdm.delete(authNSchema.invitation).execute()
            await fdm.delete(authNSchema.member).execute()
            await fdm.delete(authNSchema.organization).execute()
            await fdm.delete(authNSchema.user).execute()

            await fdm.delete(authZSchema.role).execute()
            await fdm.delete(authZSchema.audit).execute()
            await fdm.delete(authZSchema.invitation).execute()
        })
    } catch (error) {
        console.error("Error cleaning up database tables:", error)
        throw error // Re-throw to signal teardown failure
    }

    // Close the database connection
    await client.end()
}
