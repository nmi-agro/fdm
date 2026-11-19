import { eq, sql } from "drizzle-orm"
import type { FdmType } from "./fdm.types"
import * as schema from "./db/schema"

/** A herd or an animal that a livestock action belongs to. */
type LivestockOwner =
  | { l_id_herd: schema.herdsTypeSelect["l_id_herd"] }
  | { l_id_animal: schema.animalsTypeSelect["l_id_animal"] }

/** A farm asset that a livestock action links to. */
type LinkedAsset =
  | { l_id_milktank: schema.milkTanksTypeSelect["l_id_milktank"] }
  | { f_id_batch: schema.feedBatchesTypeSelect["f_id_batch"] }
  | { b_id_manurepit: schema.manurePitsTypeSelect["b_id_manurepit"] }
  | { b_id_barn: schema.barnsTypeSelect["b_id_barn"] }

async function getOwnerFarm(tx: FdmType, owner: LivestockOwner): Promise<string | undefined> {
  if ("l_id_herd" in owner) {
    const rows = await tx
      .select({ b_id_farm: schema.herdStarting.b_id_farm })
      .from(schema.herdStarting)
      .where(eq(schema.herdStarting.l_id_herd, owner.l_id_herd))
      .limit(1)
    return rows[0]?.b_id_farm
  }
  const rows = await tx
    .select({ b_id_farm: schema.animalArriving.b_id_farm })
    .from(schema.animalArriving)
    .where(eq(schema.animalArriving.l_id_animal, owner.l_id_animal))
    .limit(1)
  return rows[0]?.b_id_farm
}

async function getAssetFarm(tx: FdmType, asset: LinkedAsset): Promise<string | undefined> {
  if ("l_id_milktank" in asset) {
    const rows = await tx
      .select({ b_id_farm: schema.milkTanks.b_id_farm })
      .from(schema.milkTanks)
      .where(eq(schema.milkTanks.l_id_milktank, asset.l_id_milktank))
      .limit(1)
    return rows[0]?.b_id_farm
  }
  if ("f_id_batch" in asset) {
    const rows = await tx
      .select({ b_id_farm: schema.feedBatches.b_id_farm })
      .from(schema.feedBatches)
      .where(eq(schema.feedBatches.f_id_batch, asset.f_id_batch))
      .limit(1)
    return rows[0]?.b_id_farm
  }
  if ("b_id_manurepit" in asset) {
    const rows = await tx
      .select({ b_id_farm: schema.manurePits.b_id_farm })
      .from(schema.manurePits)
      .where(eq(schema.manurePits.b_id_manurepit, asset.b_id_manurepit))
      .limit(1)
    return rows[0]?.b_id_farm
  }
  const rows = await tx
    .select({ b_id_farm: schema.barnConstructing.b_id_farm })
    .from(schema.barnConstructing)
    .where(eq(schema.barnConstructing.b_id_barn, asset.b_id_barn))
    .limit(1)
  return rows[0]?.b_id_farm
}

/**
 * Checks that a herd or animal and the asset its action links to (milk tank, feed batch, manure
 * pit or barn) belong to the same farm. Access to the herd or animal is checked by the caller; this
 * stops an action from linking it to an asset of another farm.
 *
 * @param tx - The FDM instance or transaction.
 * @param owner - The herd or animal of the action.
 * @param asset - The linked asset.
 * @throws When either does not exist, or they belong to different farms.
 */
export async function assertSameFarm(
  tx: FdmType,
  owner: LivestockOwner,
  asset: LinkedAsset,
): Promise<void> {
  const [ownerFarm, assetFarm] = await Promise.all([
    getOwnerFarm(tx, owner),
    getAssetFarm(tx, asset),
  ])
  if (!ownerFarm) {
    throw new Error("Herd or animal does not exist")
  }
  if (!assetFarm) {
    throw new Error("Linked asset does not exist")
  }
  if (ownerFarm !== assetFarm) {
    throw new Error("Linked asset belongs to another farm")
  }
}

/**
 * Takes a lock on the livestock of a farm until the end of the transaction. Adding animals (work
 * numbers, herd category) and changing the category of a herd take it, so they run one after
 * another. Postgres has no row to lock for "the next work number", so this is an advisory lock.
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
 * Locks a herd row until the end of the transaction, so concurrent changes to the herd and its
 * actions run one after another.
 *
 * @param tx - The transaction.
 * @param l_id_herd - Identifier of the herd.
 */
export async function lockHerd(
  tx: FdmType,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
): Promise<void> {
  await tx
    .select({ l_id_herd: schema.herds.l_id_herd })
    .from(schema.herds)
    .where(eq(schema.herds.l_id_herd, l_id_herd))
    .for("update")
}

/**
 * Locks an animal row until the end of the transaction, so concurrent moves of the same animal run
 * one after another.
 *
 * @param tx - The transaction.
 * @param l_id_animal - Identifier of the animal.
 */
export async function lockAnimal(
  tx: FdmType,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
): Promise<void> {
  await tx
    .select({ l_id_animal: schema.animals.l_id_animal })
    .from(schema.animals)
    .where(eq(schema.animals.l_id_animal, l_id_animal))
    .for("update")
}
