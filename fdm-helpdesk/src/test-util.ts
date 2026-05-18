import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { test as baseTest, inject } from "vitest"

/**
 * Alternative test declaration that provides a fdm fixture, in order to create only one FDM instance per test
 * worker and prevent "too many clients already" errors.
 *
 * If you need to mock DB functionality, either create a unique mock or write a proxy around the fixture.
 *
 * @returns a FDM instance
 */
export const test = baseTest.extend(
    "fdm",
    { scope: "worker" },
    // biome-ignore lint/correctness/noEmptyPattern: vitest fixtures require using object destructuring for arguments due to reflection
    async ({}, { onCleanup }) => {
        const client = postgres({
            host: inject("host"),
            port: inject("port"),
            user: inject("user"),
            password: inject("password"),
            database: inject("database"),
            max: 1,
        })

        const fdm = drizzle(client)
        onCleanup(() => client.end())
        return fdm
    },
)
