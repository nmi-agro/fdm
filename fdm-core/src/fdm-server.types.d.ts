import type { drizzle } from "drizzle-orm/postgres-js"

export type FdmServerType = ReturnType<typeof drizzle>
