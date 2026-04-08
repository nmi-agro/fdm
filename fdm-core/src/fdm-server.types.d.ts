import type { PgDatabase } from "drizzle-orm/pg-core"
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js"

// Use the common PgDatabase base type so that both PostgresJsDatabase instances
// and PgTransaction objects (used in db.transaction() callbacks) are assignable.
export type FdmServerType = PgDatabase<PostgresJsQueryResultHKT, Record<string, unknown>>
