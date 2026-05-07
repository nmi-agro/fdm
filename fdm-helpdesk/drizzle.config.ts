import { defineConfig } from "drizzle-kit"

export default defineConfig({
    dialect: "postgresql",
    extensionsFilters: ["postgis"],
    schema: [
        "./src/db/schema-helpdesk.ts",
    ],
    out: "./src/db/migrations",
    migrations: {
        table: "migrations",
        schema: "fdm-migration",
    },
    dbCredentials: {
        host: String(process.env.POSTGRES_HOST),
        port: Number(process.env.POSTGRES_PORT),
        database: String(process.env.POSTGRES_DB),
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
    },
})
