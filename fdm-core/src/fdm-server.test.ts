import { sql } from "drizzle-orm"
import { beforeEach, describe, expect, inject, it } from "vitest"
import { createFdmServer } from "./fdm-server"
import type { FdmServerType } from "./fdm-server.types"

describe("Farm Data Model", () => {
    let fdm: FdmServerType

    beforeEach(async () => {
        const host = inject("host")
        const port = inject("port")
        const user = inject("user")
        const password = inject("password")
        const database = inject("database")
        fdm = createFdmServer(host, port, user, password, database)
    })

    describe("Database Connection", () => {
        it("should connect to the database", async () => {
            const statement = sql`SELECT 1 + 1`
            const result = await fdm.execute(statement)
            expect(result).toBeDefined()
        })
    })
})
