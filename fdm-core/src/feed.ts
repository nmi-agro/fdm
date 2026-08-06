import { and, desc, eq, gte, inArray, isNull, lte, or, type SQL } from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type {
  FeedingEventForAnimal,
  FeedingSummaryForAnimal,
  FeedBatch,
  FeedingHerd,
  FeedingAnimal,
} from "./feed.types"
import type { Timeframe } from "./timeframe"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { createId } from "./id"
import { withTimeframe } from "./timeframe"

/**
 * Adds a new feed batch to a farm, optionally with feed analysis parameters (f_dm, f_cp, f_vem, f_oeb, f_ndf).
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal adding the feed batch.
 * @param b_id_farm - Identifier of the farm.
 * @param f_batch_type - Feed type (e.g., gras_kuil, snijmais, krachtvoer).
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
        b_id_farm: schema.feedBatches.b_id_farm,
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
 * Retrieves a single feed batch by its ID, including optional analysis data.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the feed batch.
 * @param f_id_batch - Feed batch ID.
 * @returns Feed batch object.
 */
export async function getFeedBatch(
  fdm: FdmType,
  principal_id: PrincipalId,
  f_id_batch: schema.feedBatchesTypeSelect["f_id_batch"],
): Promise<FeedBatch> {
  try {
    await checkPermission(fdm, "feed", "read", f_id_batch, principal_id, "getFeedBatch")

    const rows = await fdm
      .select({
        f_id_batch: schema.feedBatches.f_id_batch,
        b_id_farm: schema.feedBatches.b_id_farm,
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
      .where(eq(schema.feedBatches.f_id_batch, f_id_batch))
      .limit(1)

    if (rows.length === 0) {
      throw new Error("Feed batch not found")
    }

    return rows[0] as FeedBatch
  } catch (err) {
    throw handleError(err, "Exception for getFeedBatch", { f_id_batch })
  }
}

/**
 * Corrects an existing feed batch and optional associated feed analysis data.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal correcting the feed batch.
 * @param f_id_batch - Feed batch ID.
 * @param properties - Fields to correct.
 */
export async function updateFeedBatch(
  fdm: FdmType,
  principal_id: PrincipalId,
  f_id_batch: schema.feedBatchesTypeSelect["f_id_batch"],
  properties: {
    f_batch_name?: schema.feedBatchesTypeInsert["f_batch_name"]
    f_batch_type?: schema.feedBatchesTypeInsert["f_batch_type"]
    f_batch_origin?: schema.feedBatchesTypeInsert["f_batch_origin"]
    f_dm?: schema.feedAnalysesTypeInsert["f_dm"]
    f_cp?: schema.feedAnalysesTypeInsert["f_cp"]
    f_vem?: schema.feedAnalysesTypeInsert["f_vem"]
    f_oeb?: schema.feedAnalysesTypeInsert["f_oeb"]
    f_ndf?: schema.feedAnalysesTypeInsert["f_ndf"]
    f_sampling_date?: schema.feedSamplingTypeInsert["f_sampling_date"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "feed", "write", f_id_batch, principal_id, "updateFeedBatch")

    await fdm.transaction(async (tx) => {
      const updated = new Date()

      const batchUpdate: {
        updated: Date
        f_batch_name?: schema.feedBatchesTypeInsert["f_batch_name"]
        f_batch_type?: schema.feedBatchesTypeInsert["f_batch_type"]
        f_batch_origin?: schema.feedBatchesTypeInsert["f_batch_origin"]
      } = { updated }

      if (properties.f_batch_name !== undefined) {
        batchUpdate.f_batch_name = properties.f_batch_name
      }
      if (properties.f_batch_type !== undefined) {
        batchUpdate.f_batch_type = properties.f_batch_type
      }
      if (properties.f_batch_origin !== undefined) {
        batchUpdate.f_batch_origin = properties.f_batch_origin
      }

      await tx
        .update(schema.feedBatches)
        .set(batchUpdate)
        .where(eq(schema.feedBatches.f_id_batch, f_id_batch))

      const hasAnalysisUpdates =
        properties.f_dm !== undefined ||
        properties.f_cp !== undefined ||
        properties.f_vem !== undefined ||
        properties.f_oeb !== undefined ||
        properties.f_ndf !== undefined

      const existingSampling = await tx
        .select({ f_id_feed_analysis: schema.feedSampling.f_id_feed_analysis })
        .from(schema.feedSampling)
        .where(eq(schema.feedSampling.f_id_batch, f_id_batch))
        .limit(1)

      if (existingSampling.length === 0) {
        if (hasAnalysisUpdates) {
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
        return
      }

      const f_id_feed_analysis = existingSampling[0].f_id_feed_analysis

      if (hasAnalysisUpdates) {
        const analysisUpdate: {
          updated: Date
          f_dm?: schema.feedAnalysesTypeInsert["f_dm"]
          f_cp?: schema.feedAnalysesTypeInsert["f_cp"]
          f_vem?: schema.feedAnalysesTypeInsert["f_vem"]
          f_oeb?: schema.feedAnalysesTypeInsert["f_oeb"]
          f_ndf?: schema.feedAnalysesTypeInsert["f_ndf"]
        } = { updated }

        if (properties.f_dm !== undefined) {
          analysisUpdate.f_dm = properties.f_dm
        }
        if (properties.f_cp !== undefined) {
          analysisUpdate.f_cp = properties.f_cp
        }
        if (properties.f_vem !== undefined) {
          analysisUpdate.f_vem = properties.f_vem
        }
        if (properties.f_oeb !== undefined) {
          analysisUpdate.f_oeb = properties.f_oeb
        }
        if (properties.f_ndf !== undefined) {
          analysisUpdate.f_ndf = properties.f_ndf
        }

        await tx
          .update(schema.feedAnalyses)
          .set(analysisUpdate)
          .where(eq(schema.feedAnalyses.f_id_feed_analysis, f_id_feed_analysis))
      }

      if (properties.f_sampling_date !== undefined) {
        await tx
          .update(schema.feedSampling)
          .set({ f_sampling_date: properties.f_sampling_date, updated })
          .where(
            and(
              eq(schema.feedSampling.f_id_batch, f_id_batch),
              eq(schema.feedSampling.f_id_feed_analysis, f_id_feed_analysis),
            ),
          )
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for updateFeedBatch", { f_id_batch, properties })
  }
}

/**
 * Hard-deletes a feed batch. Guarded: rejected while feeding records still reference it.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the feed batch.
 * @param f_id_batch - Feed batch ID.
 */
export async function removeFeedBatch(
  fdm: FdmType,
  principal_id: PrincipalId,
  f_id_batch: schema.feedBatchesTypeSelect["f_id_batch"],
): Promise<void> {
  try {
    await checkPermission(fdm, "feed", "write", f_id_batch, principal_id, "removeFeedBatch")

    await fdm.transaction(async (tx) => {
      const feedingHerdRows = await tx
        .select({ f_id_batch: schema.feedingHerd.f_id_batch })
        .from(schema.feedingHerd)
        .where(eq(schema.feedingHerd.f_id_batch, f_id_batch))
        .limit(1)
      if (feedingHerdRows.length > 0) {
        throw new Error("Cannot remove feed batch: a feeding_herd record references it")
      }

      const feedingAnimalRows = await tx
        .select({ f_id_batch: schema.feedingAnimal.f_id_batch })
        .from(schema.feedingAnimal)
        .where(eq(schema.feedingAnimal.f_id_batch, f_id_batch))
        .limit(1)
      if (feedingAnimalRows.length > 0) {
        throw new Error("Cannot remove feed batch: a feeding_animal record references it")
      }

      const feedSamplingRows = await tx
        .select({ f_id_feed_analysis: schema.feedSampling.f_id_feed_analysis })
        .from(schema.feedSampling)
        .where(eq(schema.feedSampling.f_id_batch, f_id_batch))
      const feedAnalysisIds = feedSamplingRows.map((row) => row.f_id_feed_analysis)

      await tx.delete(schema.feedSampling).where(eq(schema.feedSampling.f_id_batch, f_id_batch))
      if (feedAnalysisIds.length > 0) {
        await tx
          .delete(schema.feedAnalyses)
          .where(inArray(schema.feedAnalyses.f_id_feed_analysis, feedAnalysisIds))
      }

      await tx.delete(schema.feedBatches).where(eq(schema.feedBatches.f_id_batch, f_id_batch))
    })
  } catch (err) {
    throw handleError(err, "Exception for removeFeedBatch", { f_id_batch })
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
export async function addFeedingHerd(
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
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "addFeedingHerd")

    await fdm.insert(schema.feedingHerd).values({
      f_id_batch,
      l_id_herd,
      f_feeding_start,
      f_feeding_end: properties?.f_feeding_end ?? null,
      f_amount: properties?.f_amount ?? null,
    })
  } catch (err) {
    throw handleError(err, "Exception for addFeedingHerd", {
      f_id_batch,
      l_id_herd,
      f_feeding_start,
      properties,
    })
  }
}

/**
 * Corrects an existing herd feeding action, identified by its full composite key.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal correcting the feeding action.
 * @param f_id_batch - Feed batch ID.
 * @param l_id_herd - Herd ID.
 * @param f_feeding_start - Feeding start date/time.
 * @param properties - Fields to correct.
 */
export async function updateFeedingHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  f_id_batch: schema.feedBatchesTypeSelect["f_id_batch"],
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  f_feeding_start: schema.feedingHerdTypeSelect["f_feeding_start"],
  properties: {
    f_feeding_end?: schema.feedingHerdTypeInsert["f_feeding_end"]
    f_amount?: schema.feedingHerdTypeInsert["f_amount"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "updateFeedingHerd")

    const result = await fdm
      .update(schema.feedingHerd)
      .set({ ...properties, updated: new Date() })
      .where(
        and(
          eq(schema.feedingHerd.f_id_batch, f_id_batch),
          eq(schema.feedingHerd.l_id_herd, l_id_herd),
          eq(schema.feedingHerd.f_feeding_start, f_feeding_start),
        ),
      )
      .returning({ l_id_herd: schema.feedingHerd.l_id_herd })

    if (result.length === 0) {
      throw new Error("Feeding herd record not found")
    }
  } catch (err) {
    throw handleError(err, "Exception for updateFeedingHerd", {
      f_id_batch,
      l_id_herd,
      f_feeding_start,
      properties,
    })
  }
}

/**
 * Hard-deletes a herd feeding action, identified by its full composite key.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the feeding action.
 * @param f_id_batch - Feed batch ID.
 * @param l_id_herd - Herd ID.
 * @param f_feeding_start - Feeding start date/time.
 */
export async function removeFeedingHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  f_id_batch: schema.feedBatchesTypeSelect["f_id_batch"],
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  f_feeding_start: schema.feedingHerdTypeSelect["f_feeding_start"],
): Promise<void> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "removeFeedingHerd")

    const result = await fdm
      .delete(schema.feedingHerd)
      .where(
        and(
          eq(schema.feedingHerd.f_id_batch, f_id_batch),
          eq(schema.feedingHerd.l_id_herd, l_id_herd),
          eq(schema.feedingHerd.f_feeding_start, f_feeding_start),
        ),
      )
      .returning({ l_id_herd: schema.feedingHerd.l_id_herd })

    if (result.length === 0) {
      throw new Error("Feeding herd record not found")
    }
  } catch (err) {
    throw handleError(err, "Exception for removeFeedingHerd", {
      f_id_batch,
      l_id_herd,
      f_feeding_start,
    })
  }
}

/**
 * Retrieves herd feeding records for a farm.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the feeding records.
 * @param b_id_farm - Farm ID.
 * @returns Array of herd feeding records.
 */
export async function getFeedingHerdForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<FeedingHerd[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getFeedingHerdForFarm")

    const rows = await fdm
      .select({
        f_id_batch: schema.feedingHerd.f_id_batch,
        l_id_herd: schema.feedingHerd.l_id_herd,
        f_feeding_start: schema.feedingHerd.f_feeding_start,
        f_feeding_end: schema.feedingHerd.f_feeding_end,
        f_amount: schema.feedingHerd.f_amount,
        created: schema.feedingHerd.created,
        updated: schema.feedingHerd.updated,
      })
      .from(schema.feedingHerd)
      .innerJoin(
        schema.herdStarting,
        eq(schema.feedingHerd.l_id_herd, schema.herdStarting.l_id_herd),
      )
      .where(eq(schema.herdStarting.b_id_farm, b_id_farm))
      .orderBy(desc(schema.feedingHerd.f_feeding_start))

    return rows as FeedingHerd[]
  } catch (err) {
    throw handleError(err, "Exception for getFeedingHerdForFarm", { b_id_farm })
  }
}

/**
 * Records an animal-specific supplemental feeding action (batch -> animal).
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal ID.
 * @param f_id_batch - Feed batch ID.
 * @param l_id_animal - Animal ID.
 * @param f_feeding_start - Start date/time.
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

/**
 * Corrects an existing animal feeding action, identified by its full composite key.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal correcting the feeding action.
 * @param l_id_animal - Animal ID.
 * @param f_id_batch - Feed batch ID.
 * @param f_feeding_start - Feeding start date/time.
 * @param properties - Fields to correct.
 */
export async function updateFeedingAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  f_id_batch: schema.feedBatchesTypeSelect["f_id_batch"],
  f_feeding_start: schema.feedingAnimalTypeSelect["f_feeding_start"],
  properties: {
    f_feeding_end?: schema.feedingAnimalTypeInsert["f_feeding_end"]
    f_amount?: schema.feedingAnimalTypeInsert["f_amount"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "updateFeedingAnimal")

    const result = await fdm
      .update(schema.feedingAnimal)
      .set({ ...properties, updated: new Date() })
      .where(
        and(
          eq(schema.feedingAnimal.l_id_animal, l_id_animal),
          eq(schema.feedingAnimal.f_id_batch, f_id_batch),
          eq(schema.feedingAnimal.f_feeding_start, f_feeding_start),
        ),
      )
      .returning({ l_id_animal: schema.feedingAnimal.l_id_animal })

    if (result.length === 0) {
      throw new Error("Feeding animal record not found")
    }
  } catch (err) {
    throw handleError(err, "Exception for updateFeedingAnimal", {
      l_id_animal,
      f_id_batch,
      f_feeding_start,
      properties,
    })
  }
}

/**
 * Hard-deletes an animal feeding action, identified by its full composite key.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the feeding action.
 * @param l_id_animal - Animal ID.
 * @param f_id_batch - Feed batch ID.
 * @param f_feeding_start - Feeding start date/time.
 */
export async function removeFeedingAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  f_id_batch: schema.feedBatchesTypeSelect["f_id_batch"],
  f_feeding_start: schema.feedingAnimalTypeSelect["f_feeding_start"],
): Promise<void> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "removeFeedingAnimal")

    const result = await fdm
      .delete(schema.feedingAnimal)
      .where(
        and(
          eq(schema.feedingAnimal.l_id_animal, l_id_animal),
          eq(schema.feedingAnimal.f_id_batch, f_id_batch),
          eq(schema.feedingAnimal.f_feeding_start, f_feeding_start),
        ),
      )
      .returning({ l_id_animal: schema.feedingAnimal.l_id_animal })

    if (result.length === 0) {
      throw new Error("Feeding animal record not found")
    }
  } catch (err) {
    throw handleError(err, "Exception for removeFeedingAnimal", {
      l_id_animal,
      f_id_batch,
      f_feeding_start,
    })
  }
}

/**
 * Retrieves animal feeding records for a farm.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the feeding records.
 * @param b_id_farm - Farm ID.
 * @returns Array of animal feeding records.
 */
export async function getFeedingAnimalForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<FeedingAnimal[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getFeedingAnimalForFarm")

    const rows = await fdm
      .select({
        l_id_animal: schema.feedingAnimal.l_id_animal,
        f_id_batch: schema.feedingAnimal.f_id_batch,
        f_feeding_start: schema.feedingAnimal.f_feeding_start,
        f_feeding_end: schema.feedingAnimal.f_feeding_end,
        f_amount: schema.feedingAnimal.f_amount,
        created: schema.feedingAnimal.created,
        updated: schema.feedingAnimal.updated,
      })
      .from(schema.feedingAnimal)
      .innerJoin(
        schema.animalArriving,
        eq(schema.feedingAnimal.l_id_animal, schema.animalArriving.l_id_animal),
      )
      .where(eq(schema.animalArriving.b_id_farm, b_id_farm))
      .orderBy(desc(schema.feedingAnimal.f_feeding_start))

    return rows as FeedingAnimal[]
  } catch (err) {
    throw handleError(err, "Exception for getFeedingAnimalForFarm", { b_id_farm })
  }
}

async function listFeedingEventsForAnimal(
  tx: FdmType,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  timeframe?: Timeframe,
): Promise<FeedingEventForAnimal[]> {
  let herdWhere: SQL | undefined = eq(schema.animalAssigning.l_id_animal, l_id_animal)
  herdWhere = withTimeframe(herdWhere, schema.feedingHerd.f_feeding_start, timeframe)

  const herdRows = await tx
    .select({
      l_id_herd: schema.feedingHerd.l_id_herd,
      f_id_batch: schema.feedingHerd.f_id_batch,
      f_feeding_start: schema.feedingHerd.f_feeding_start,
      f_feeding_end: schema.feedingHerd.f_feeding_end,
      f_amount: schema.feedingHerd.f_amount,
      created: schema.feedingHerd.created,
      updated: schema.feedingHerd.updated,
    })
    .from(schema.feedingHerd)
    .innerJoin(
      schema.animalAssigning,
      and(
        eq(schema.feedingHerd.l_id_herd, schema.animalAssigning.l_id_herd),
        eq(schema.animalAssigning.l_id_animal, l_id_animal),
        lte(schema.animalAssigning.l_assigning_start, schema.feedingHerd.f_feeding_start),
        or(
          isNull(schema.animalAssigning.l_assigning_end),
          gte(schema.animalAssigning.l_assigning_end, schema.feedingHerd.f_feeding_start),
        ),
      ),
    )
    .where(herdWhere)

  let animalWhere: SQL | undefined = eq(schema.feedingAnimal.l_id_animal, l_id_animal)
  animalWhere = withTimeframe(animalWhere, schema.feedingAnimal.f_feeding_start, timeframe)

  const animalRows = await tx
    .select({
      l_id_animal: schema.feedingAnimal.l_id_animal,
      f_id_batch: schema.feedingAnimal.f_id_batch,
      f_feeding_start: schema.feedingAnimal.f_feeding_start,
      f_feeding_end: schema.feedingAnimal.f_feeding_end,
      f_amount: schema.feedingAnimal.f_amount,
      created: schema.feedingAnimal.created,
      updated: schema.feedingAnimal.updated,
    })
    .from(schema.feedingAnimal)
    .where(animalWhere)

  return [
    ...herdRows.map((row) => ({ l_feeding_type: "herd" as const, ...row })),
    ...animalRows.map((row) => ({ l_feeding_type: "animal" as const, ...row })),
  ].sort((a, b) => b.f_feeding_start.getTime() - a.f_feeding_start.getTime())
}

/**
 * Returns source-tagged feeding events for an animal and timeframe.
 * Herd-level events are included when the herd assignment was active at the feeding timestamp.
 * Animal-level events are additive supplements and are returned with `l_feeding_type = "animal"`.
 */
export async function getFeedingEventsForAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  timeframe?: Timeframe,
): Promise<FeedingEventForAnimal[]> {
  try {
    await checkPermission(fdm, "animal", "read", l_id_animal, principal_id, "getFeedingEventsForAnimal")
    return await fdm.transaction(async (tx) => listFeedingEventsForAnimal(tx, l_id_animal, timeframe))
  } catch (err) {
    throw handleError(err, "Exception for getFeedingEventsForAnimal", { l_id_animal, timeframe })
  }
}

/**
 * Returns a feeding summary for an animal and timeframe based on source-tagged events.
 * Feed-analysis fields are null until analysis measurements are associated with feeding events.
 */
export async function getFeedingSummaryForAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  timeframe?: Timeframe,
): Promise<FeedingSummaryForAnimal> {
  try {
    await checkPermission(fdm, "animal", "read", l_id_animal, principal_id, "getFeedingSummaryForAnimal")

    return await fdm.transaction(async (tx) => {
      const events = await listFeedingEventsForAnimal(tx, l_id_animal, timeframe)
      const totalFeedingAmount = events.reduce((sum, row) => sum + (row.f_amount ?? 0), 0)

      return {
        f_amount: totalFeedingAmount,
        f_dm: null,
        f_cp: null,
        f_vem: null,
        f_oeb: null,
        f_ndf: null,
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for getFeedingSummaryForAnimal", {
      l_id_animal,
      timeframe,
    })
  }
}
