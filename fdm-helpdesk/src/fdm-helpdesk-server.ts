import type { PgDatabase } from "drizzle-orm/pg-core"
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js"

export type FdmHelpdeskServerType = PgDatabase<
    PostgresJsQueryResultHKT,
    Record<string, unknown>
>
