import type { PgDatabase } from "drizzle-orm/pg-core"
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js"

// Use the common PgDatabase base type so that both the main database connection
// (PostgresJsDatabase) and transaction contexts (PgTransaction) are assignable
// to FdmType when used as transaction callback parameters.
export type FdmServerType = PgDatabase<PostgresJsQueryResultHKT>
