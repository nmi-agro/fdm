import { createFdmServer, runMigration } from "@nmi-agro/fdm-core"
import postgres from "postgres"
import type { TestProject } from "vitest/node"

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
