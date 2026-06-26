import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { test as baseTest, inject } from "vitest"
import type { FdmHelpdeskType } from "./fdm-helpdesk.types"

/**
 * Truncates all tables in the fdm-helpdesk schema, removing all rows and cascading to
 * dependent tables. Use this in a beforeEach hook when a test needs a clean isolated state.
 */
export async function truncateAllTables(fdm: FdmHelpdeskType) {
  await fdm.execute(sql`
        TRUNCATE TABLE
            "fdm-helpdesk"."agents",
            "fdm-helpdesk"."tickets",
            "fdm-helpdesk"."tags",
            "fdm-helpdesk"."saved_replies"
        CASCADE
    `)
}

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
      onnotice(item) {
        // Do not log truncation warnings (truncation happens a lot due to how some tests are set up)
        if (item?.message?.startsWith("truncate cascades to")) {
          return
        }

        console.log(item)
      },
    })

    const fdm = drizzle(client)
    onCleanup(() => client.end())
    return fdm
  },
)
