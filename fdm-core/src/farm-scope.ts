/**
 * Shared checks that keep a change within one farm: which farm a record belongs to, that two
 * records belong to the same farm, and the lock that makes the changes of one farm run one after
 * another. A record is named by its ID column, for example `{ l_id_herd }` or `{ b_id }`; to support
 * another kind of record, add its table to {@link FARM_LOOKUPS}.
 *
 * The lookups read the owning table directly instead of the authorization resource chain: the
 * chain treats some IDs as more than one kind of record (a `milk` resource can be a tank, a herd or
 * a delivery), which would let an ID of the wrong kind pass.
 */
import type { AnyColumn, InferSelectModel, Table } from "drizzle-orm"
import { eq, sql } from "drizzle-orm"
import type { FdmType } from "./fdm.types"
import * as schema from "./db/schema"

/** Where the farm of each kind of record is stored, by the record's ID column. */
const FARM_LOOKUPS = {
  b_id: {
    table: schema.fieldAcquiring,
    id: schema.fieldAcquiring.b_id,
    farm: schema.fieldAcquiring.b_id_farm,
  },
  l_id_herd: {
    table: schema.herdStarting,
    id: schema.herdStarting.l_id_herd,
    farm: schema.herdStarting.b_id_farm,
  },
  l_id_animal: {
    table: schema.animalArriving,
    id: schema.animalArriving.l_id_animal,
    farm: schema.animalArriving.b_id_farm,
  },
  b_id_barn: {
    table: schema.barnConstructing,
    id: schema.barnConstructing.b_id_barn,
    farm: schema.barnConstructing.b_id_farm,
  },
  l_id_milktank: {
    table: schema.milkTanks,
    id: schema.milkTanks.l_id_milktank,
    farm: schema.milkTanks.b_id_farm,
  },
  f_id_batch: {
    table: schema.feedBatches,
    id: schema.feedBatches.f_id_batch,
    farm: schema.feedBatches.b_id_farm,
  },
  b_id_manurepit: {
    table: schema.manurePits,
    id: schema.manurePits.b_id_manurepit,
    farm: schema.manurePits.b_id_farm,
  },
} satisfies Record<string, { table: Table; id: AnyColumn; farm: AnyColumn }>

type FarmRecordKind = keyof typeof FARM_LOOKUPS

/** A record that belongs to one farm, named by its ID column, such as `{ l_id_herd: "…" }`. */
export type FarmRecord = { [K in FarmRecordKind]: { [P in K]: string } }[FarmRecordKind]

/** The ID column and value of a record. */
function recordKey(record: FarmRecord): [FarmRecordKind, string] {
  const [kind, id] = Object.entries(record)[0] as [FarmRecordKind, string]
  return [kind, id]
}

/**
 * Returns the farm a record belongs to.
 *
 * @param tx - The FDM instance or transaction.
 * @param record - The record, named by its ID column.
 * @returns The farm ID, or `undefined` when the record does not exist.
 */
export async function getFarmOf(
  tx: FdmType,
  record: FarmRecord,
): Promise<schema.farmsTypeSelect["b_id_farm"] | undefined> {
  const [kind, id] = recordKey(record)
  const lookup = FARM_LOOKUPS[kind]
  const rows = (await tx
    .select({ b_id_farm: lookup.farm })
    .from(lookup.table)
    .where(eq(lookup.id, id))
    .limit(1)) as Array<Pick<InferSelectModel<typeof schema.farms>, "b_id_farm">>
  return rows[0]?.b_id_farm
}

/**
 * Checks that two records belong to the same farm, for example a herd and the feed batch, milk tank,
 * manure pit, barn or field an action links it to. Access to the records is checked by the caller;
 * this stops an action from linking a record to one of another farm.
 *
 * @param tx - The FDM instance or transaction.
 * @param record - The record the action belongs to.
 * @param linked - The record it links to.
 * @throws When either does not exist, or they belong to different farms.
 */
export async function assertSameFarm(
  tx: FdmType,
  record: FarmRecord,
  linked: FarmRecord,
): Promise<void> {
  const [recordFarm, linkedFarm] = await Promise.all([getFarmOf(tx, record), getFarmOf(tx, linked)])
  if (!recordFarm) {
    throw new Error(`${recordKey(record).join(" ")} does not exist`)
  }
  if (!linkedFarm) {
    throw new Error(`${recordKey(linked).join(" ")} does not exist`)
  }
  if (recordFarm !== linkedFarm) {
    throw new Error(
      `${recordKey(linked).join(" ")} belongs to another farm than ${recordKey(record).join(" ")}`,
    )
  }
}

/**
 * Takes the lock of a farm until the end of the transaction. Every change of a farm whose checks
 * read other records first (herds, animals, assignments, departures, housing and grazing) takes
 * this one lock before it reads anything, so such changes run one after another and always see
 * each other's result. A transaction alone does not do that: at PostgreSQL's default isolation
 * (Read Committed) two concurrent changes can each pass a check that only holds for one of them.
 * One lock per farm keeps the order simple (no deadlocks between finer locks); a farm makes few
 * changes at a time.
 *
 * It is an advisory lock (`pg_advisory_xact_lock`), because there is not always a single row to
 * lock (for example for "the next work number"). It locks no rows: only code that takes this lock
 * waits for it. So every write function whose checks read other records must call it itself,
 * before its first read; a function that forgets it runs alongside the others unchecked. Two farms
 * whose IDs hash to the same value occasionally wait for each other, which is harmless.
 *
 * @param tx - The transaction.
 * @param b_id_farm - Identifier of the farm.
 */
export async function lockFarm(
  tx: FdmType,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${b_id_farm}))`)
}

/**
 * Takes the lock of the farm a record belongs to; see {@link lockFarm}. The farm of a record never
 * changes, so it can be read before the lock.
 *
 * @param tx - The transaction.
 * @param record - The record, named by its ID column.
 * @returns The farm of the record, or `undefined` when it does not exist (nothing is locked).
 */
export async function lockFarmOf(
  tx: FdmType,
  record: FarmRecord,
): Promise<schema.farmsTypeSelect["b_id_farm"] | undefined> {
  const b_id_farm = await getFarmOf(tx, record)
  if (b_id_farm) await lockFarm(tx, b_id_farm)
  return b_id_farm
}
