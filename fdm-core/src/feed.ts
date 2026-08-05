import { desc, eq } from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type { FeedBatch } from "./feed.types"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { createId } from "./id"

/**
 * Adds a new feed batch to a farm, optionally with feed analysis parameters (f_dm, f_cp, f_vem, f_oeb, f_ndf).
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal adding the feed batch.
 * @param b_id_farm - Identifier of the farm.
 * @param f_batch_type - Feed type (e.g., grass_silage, maize_silage, concentrate).
 * @param f_batch_origin - Feed origin (own_land or purchased).
 * @param properties - Optional feed name and analysis parameters.
 * @returns Unique identifier of the new feed batch.
 */
export async function addFeedBatch(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  f_batch_type: (typeof schema.feedTypeOptions)[number]["value"],
  f_batch_origin: (typeof schema.feedOriginOptions)[number]["value"],
  properties?: {
    f_batch_name?: schema.feedBatchesTypeInsert["f_batch_name"]
    f_dm?: schema.feedAnalysesTypeInsert["f_dm"]
    f_cp?: schema.feedAnalysesTypeInsert["f_cp"]
    f_vem?: schema.feedAnalysesTypeInsert["f_vem"]
    f_oeb?: schema.feedAnalysesTypeInsert["f_oeb"]
    f_ndf?: schema.feedAnalysesTypeInsert["f_ndf"]
    f_sampling_date?: Date
  },
): Promise<schema.feedBatchesTypeSelect["f_id_batch"]> {
  try {
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "addFeedBatch")

    return await fdm.transaction(async (tx) => {
      const f_id_batch = createId()

      await tx.insert(schema.feedBatches).values({
        f_id_batch,
        b_id_farm,
        f_batch_name: properties?.f_batch_name ?? null,
        f_batch_type,
        f_batch_origin,
      })

      if (
        properties &&
        (properties.f_dm !== undefined ||
          properties.f_cp !== undefined ||
          properties.f_vem !== undefined ||
          properties.f_oeb !== undefined ||
          properties.f_ndf !== undefined)
      ) {
        const f_id_feed_analysis = createId()

        await tx.insert(schema.feedAnalyses).values({
          f_id_feed_analysis,
          f_dm: properties.f_dm ?? null,
          f_cp: properties.f_cp ?? null,
          f_vem: properties.f_vem ?? null,
          f_oeb: properties.f_oeb ?? null,
          f_ndf: properties.f_ndf ?? null,
        })

        await tx.insert(schema.feedSampling).values({
          f_id_batch,
          f_id_feed_analysis,
          f_sampling_date: properties.f_sampling_date ?? new Date(),
        })
      }

      return f_id_batch
    })
  } catch (err) {
    throw handleError(err, "Exception for addFeedBatch", {
      b_id_farm,
      f_batch_type,
      f_batch_origin,
    })
  }
}

/**
 * Retrieves all feed batches for a farm.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal ID.
 * @param b_id_farm - Farm ID.
 * @returns Array of feed batch objects.
 */
export async function getFeedBatchesForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<FeedBatch[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getFeedBatchesForFarm")

    const rows = await fdm
      .select({
        f_id_batch: schema.feedBatches.f_id_batch,
        f_batch_name: schema.feedBatches.f_batch_name,
        f_batch_type: schema.feedBatches.f_batch_type,
        f_batch_origin: schema.feedBatches.f_batch_origin,
        f_id_feed_analysis: schema.feedAnalyses.f_id_feed_analysis,
        f_dm: schema.feedAnalyses.f_dm,
        f_cp: schema.feedAnalyses.f_cp,
        f_vem: schema.feedAnalyses.f_vem,
        f_oeb: schema.feedAnalyses.f_oeb,
        f_ndf: schema.feedAnalyses.f_ndf,
        f_sampling_date: schema.feedSampling.f_sampling_date,
        created: schema.feedBatches.created,
        updated: schema.feedBatches.updated,
      })
      .from(schema.feedBatches)
      .leftJoin(
        schema.feedSampling,
        eq(schema.feedBatches.f_id_batch, schema.feedSampling.f_id_batch),
      )
      .leftJoin(
        schema.feedAnalyses,
        eq(schema.feedSampling.f_id_feed_analysis, schema.feedAnalyses.f_id_feed_analysis),
      )
      .where(eq(schema.feedBatches.b_id_farm, b_id_farm))
      .orderBy(desc(schema.feedBatches.created))

    return rows as FeedBatch[]
  } catch (err) {
    throw handleError(err, "Exception for getFeedBatchesForFarm", { b_id_farm })
  }
}

/**
 * Records a herd feeding action (batch -> herd).
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal ID.
 * @param f_id_batch - Feed batch ID.
 * @param l_id_herd - Herd ID.
 * @param f_feeding_start - Feeding start date/time.
 * @param properties - Optional end date and feed amount (kg fresh).
 */
export async function addFeeding(
  fdm: FdmType,
  principal_id: PrincipalId,
  f_id_batch: schema.feedBatchesTypeSelect["f_id_batch"],
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  f_feeding_start = new Date(),
  properties?: {
    f_feeding_end?: schema.feedingHerdTypeInsert["f_feeding_end"]
    f_amount?: schema.feedingHerdTypeInsert["f_amount"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "addFeeding")

    await fdm.insert(schema.feedingHerd).values({
      f_id_batch,
      l_id_herd,
      f_feeding_start,
      f_feeding_end: properties?.f_feeding_end ?? null,
      f_amount: properties?.f_amount ?? null,
    })
  } catch (err) {
    throw handleError(err, "Exception for addFeeding", {
      f_id_batch,
      l_id_herd,
      f_feeding_start,
      properties,
    })
  }
}

/**
 * Records an animal-specific supplemental feeding action (batch -> animal).
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal ID.
 * @param f_id_batch - Feed batch ID.
 * @param l_id_animal - Animal ID.
 * @param m_start - Start date/time.
 * @param properties - Optional end date and feed amount (kg fresh).
 */
export async function addFeedingAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  f_id_batch: schema.feedBatchesTypeSelect["f_id_batch"],
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  f_feeding_start = new Date(),
  properties?: {
    f_feeding_end?: schema.feedingAnimalTypeInsert["f_feeding_end"]
    f_amount?: schema.feedingAnimalTypeInsert["f_amount"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "addFeedingAnimal")

    await fdm.insert(schema.feedingAnimal).values({
      f_id_batch,
      l_id_animal,
      f_feeding_start,
      f_feeding_end: properties?.f_feeding_end ?? null,
      f_amount: properties?.f_amount ?? null,
    })
  } catch (err) {
    throw handleError(err, "Exception for addFeedingAnimal", {
      f_id_batch,
      l_id_animal,
      f_feeding_start,
    })
  }
}
