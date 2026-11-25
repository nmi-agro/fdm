import { Decimal } from "decimal.js"
import { and, desc, eq, gt, inArray, isNull, lte, or, type SQL } from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type {
  MilkingEventForAnimal,
  MilkingSummaryForAnimal,
  MilkDelivery,
  MilkingHerd,
  MilkingAnimal,
  MilkTank,
} from "./milk.types"
import type { Timeframe } from "./timeframe"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { assertSameFarm } from "./farm-scope"
import { createId } from "./id"
import { assertIntervalEndNotBeforeStart } from "./interval"
import { withTimeframe } from "./timeframe"

/**
 * Adds a new milk tank to a farm.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal ID.
 * @param b_id_farm - Farm ID.
 * @returns Milk tank ID.
 */
export async function addMilkTank(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  properties?: {
    l_milktank_name?: schema.milkTanksTypeInsert["l_milktank_name"]
  },
): Promise<schema.milkTanksTypeSelect["l_id_milktank"]> {
  try {
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "addMilkTank")

    return await fdm.transaction(async (tx) => {
      const l_id_milktank = createId()

      await tx.insert(schema.milkTanks).values({
        l_id_milktank,
        b_id_farm,
        l_milktank_name: properties?.l_milktank_name ?? null,
      })

      return l_id_milktank
    })
  } catch (err) {
    throw handleError(err, "Exception for addMilkTank", { b_id_farm, properties })
  }
}

/**
 * Retrieves a single milk tank by its ID.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the milk tank.
 * @param l_id_milktank - Identifier of the milk tank.
 * @returns The milk tank.
 */
export async function getMilkTank(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_milktank: schema.milkTanksTypeSelect["l_id_milktank"],
): Promise<MilkTank> {
  try {
    await checkPermission(fdm, "milk", "read", l_id_milktank, principal_id, "getMilkTank")

    const rows = await fdm
      .select({
        l_id_milktank: schema.milkTanks.l_id_milktank,
        b_id_farm: schema.milkTanks.b_id_farm,
        l_milktank_name: schema.milkTanks.l_milktank_name,
        created: schema.milkTanks.created,
        updated: schema.milkTanks.updated,
      })
      .from(schema.milkTanks)
      .where(eq(schema.milkTanks.l_id_milktank, l_id_milktank))
      .limit(1)

    if (rows.length === 0) {
      throw new Error("Milk tank not found")
    }

    return rows[0] as MilkTank
  } catch (err) {
    throw handleError(err, "Exception for getMilkTank", { l_id_milktank })
  }
}

/**
 * Retrieves all milk tanks for a specified farm.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the milk tanks.
 * @param b_id_farm - Farm ID.
 * @returns Array of milk tanks.
 */
export async function getMilkTanksForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<MilkTank[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getMilkTanksForFarm")

    const rows = await fdm
      .select({
        l_id_milktank: schema.milkTanks.l_id_milktank,
        b_id_farm: schema.milkTanks.b_id_farm,
        l_milktank_name: schema.milkTanks.l_milktank_name,
        created: schema.milkTanks.created,
        updated: schema.milkTanks.updated,
      })
      .from(schema.milkTanks)
      .where(eq(schema.milkTanks.b_id_farm, b_id_farm))
      .orderBy(desc(schema.milkTanks.created))

    return rows as MilkTank[]
  } catch (err) {
    throw handleError(err, "Exception for getMilkTanksForFarm", { b_id_farm })
  }
}

/**
 * Updates properties of an existing milk tank.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal updating the milk tank.
 * @param l_id_milktank - Identifier of the milk tank.
 * @param properties - Properties to update.
 */
export async function updateMilkTank(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_milktank: schema.milkTanksTypeSelect["l_id_milktank"],
  properties: {
    l_milktank_name?: schema.milkTanksTypeInsert["l_milktank_name"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "milk", "write", l_id_milktank, principal_id, "updateMilkTank")

    await fdm
      .update(schema.milkTanks)
      // Only the documented column: the farm of a tank never changes
      .set({ l_milktank_name: properties.l_milktank_name, updated: new Date() })
      .where(eq(schema.milkTanks.l_id_milktank, l_id_milktank))
  } catch (err) {
    throw handleError(err, "Exception for updateMilkTank", { l_id_milktank, properties })
  }
}

/**
 * Hard-deletes a milk tank. Guarded: rejected if any herd_milking,
 * animal_milking, or milk_delivering record still references this tank —
 * those represent other actions' history and must be cleaned up first.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the milk tank.
 * @param l_id_milktank - Identifier of the milk tank.
 */
export async function removeMilkTank(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_milktank: schema.milkTanksTypeSelect["l_id_milktank"],
): Promise<void> {
  try {
    await checkPermission(fdm, "milk", "write", l_id_milktank, principal_id, "removeMilkTank")

    await fdm.transaction(async (tx) => {
      const milkingHerdRecords = await tx
        .select({ l_id_herd: schema.herdMilking.l_id_herd })
        .from(schema.herdMilking)
        .where(eq(schema.herdMilking.l_id_milktank, l_id_milktank))
        .limit(1)

      if (milkingHerdRecords.length > 0) {
        throw new Error("Cannot remove milk tank: a herd_milking record references it")
      }

      const milkingAnimalRecords = await tx
        .select({ l_id_animal: schema.animalMilking.l_id_animal })
        .from(schema.animalMilking)
        .where(eq(schema.animalMilking.l_id_milktank, l_id_milktank))
        .limit(1)

      if (milkingAnimalRecords.length > 0) {
        throw new Error("Cannot remove milk tank: an animal_milking record references it")
      }

      const deliveringRecords = await tx
        .select({ l_id_milkdelivery: schema.milkDelivering.l_id_milkdelivery })
        .from(schema.milkDelivering)
        .where(eq(schema.milkDelivering.l_id_milktank, l_id_milktank))
        .limit(1)

      if (deliveringRecords.length > 0) {
        throw new Error("Cannot remove milk tank: a milk_delivering record references it")
      }

      await tx.delete(schema.milkTanks).where(eq(schema.milkTanks.l_id_milktank, l_id_milktank))
    })
  } catch (err) {
    throw handleError(err, "Exception for removeMilkTank", { l_id_milktank })
  }
}

/**
 * Adds a herd-level milking action (herd -> tank).
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal ID.
 * @param l_id_herd - Herd ID.
 * @param l_id_milktank - Milk tank ID.
 * @param l_milking_start - Milking start date/time.
 * @param properties - Optional end date and milk yield (kg).
 */
export async function addMilkingHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  l_id_milktank: schema.milkTanksTypeSelect["l_id_milktank"],
  l_milking_start = new Date(),
  properties?: {
    l_milking_end?: schema.herdMilkingTypeInsert["l_milking_end"]
    l_milking_amount?: schema.herdMilkingTypeInsert["l_milking_amount"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "addMilkingHerd")
    assertIntervalEndNotBeforeStart(l_milking_start, properties?.l_milking_end, "l_milking")
    await assertSameFarm(fdm, { l_id_herd }, { l_id_milktank })

    await fdm.insert(schema.herdMilking).values({
      l_id_herd,
      l_id_milktank,
      l_milking_start,
      l_milking_end: properties?.l_milking_end ?? null,
      l_milking_amount: properties?.l_milking_amount ?? null,
    })
  } catch (err) {
    throw handleError(err, "Exception for addMilkingHerd", {
      l_id_herd,
      l_id_milktank,
      l_milking_start,
    })
  }
}

/**
 * Corrects an existing herd-level milking action, identified by its full
 * composite key.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal correcting the milking action.
 * @param l_id_herd - Herd ID (part of the composite key).
 * @param l_id_milktank - Milk tank ID (part of the composite key).
 * @param l_milking_start - Milking start date/time (part of the composite key).
 * @param properties - Fields to correct.
 */
export async function updateMilkingHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  l_id_milktank: schema.milkTanksTypeSelect["l_id_milktank"],
  l_milking_start: schema.herdMilkingTypeSelect["l_milking_start"],
  properties: {
    l_milking_end?: schema.herdMilkingTypeInsert["l_milking_end"]
    l_milking_amount?: schema.herdMilkingTypeInsert["l_milking_amount"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "updateMilkingHerd")
    if (properties.l_milking_end !== undefined) {
      assertIntervalEndNotBeforeStart(l_milking_start, properties.l_milking_end, "l_milking")
    }

    const result = await fdm
      .update(schema.herdMilking)
      // Only the documented columns: the herd, tank and start identify the record and never change
      .set({
        l_milking_end: properties.l_milking_end,
        l_milking_amount: properties.l_milking_amount,
        updated: new Date(),
      })
      .where(
        and(
          eq(schema.herdMilking.l_id_herd, l_id_herd),
          eq(schema.herdMilking.l_id_milktank, l_id_milktank),
          eq(schema.herdMilking.l_milking_start, l_milking_start),
        ),
      )
      .returning({ l_id_herd: schema.herdMilking.l_id_herd })

    if (result.length === 0) {
      throw new Error("Milking herd record not found")
    }
  } catch (err) {
    throw handleError(err, "Exception for updateMilkingHerd", {
      l_id_herd,
      l_id_milktank,
      l_milking_start,
      properties,
    })
  }
}

/**
 * Hard-deletes a herd-level milking action, identified by its full composite key.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the milking action.
 * @param l_id_herd - Herd ID (part of the composite key).
 * @param l_id_milktank - Milk tank ID (part of the composite key).
 * @param l_milking_start - Milking start date/time (part of the composite key).
 */
export async function removeMilkingHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  l_id_milktank: schema.milkTanksTypeSelect["l_id_milktank"],
  l_milking_start: schema.herdMilkingTypeSelect["l_milking_start"],
): Promise<void> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "removeMilkingHerd")

    const result = await fdm
      .delete(schema.herdMilking)
      .where(
        and(
          eq(schema.herdMilking.l_id_herd, l_id_herd),
          eq(schema.herdMilking.l_id_milktank, l_id_milktank),
          eq(schema.herdMilking.l_milking_start, l_milking_start),
        ),
      )
      .returning({ l_id_herd: schema.herdMilking.l_id_herd })

    if (result.length === 0) {
      throw new Error("Milking herd record not found")
    }
  } catch (err) {
    throw handleError(err, "Exception for removeMilkingHerd", {
      l_id_herd,
      l_id_milktank,
      l_milking_start,
    })
  }
}

/**
 * Retrieves raw herd-level milking records for a herd, optionally filtered by timeframe.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the milking records.
 * @param l_id_herd - Herd ID.
 * @param timeframe - Optional timeframe filter.
 * @returns Array of herd-level milking records.
 */
export async function getMilkingHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  timeframe?: Timeframe,
): Promise<MilkingHerd[]> {
  try {
    await checkPermission(fdm, "herd", "read", l_id_herd, principal_id, "getMilkingHerd")

    let dateWhere: SQL | undefined = eq(schema.herdMilking.l_id_herd, l_id_herd)
    dateWhere = withTimeframe(dateWhere, schema.herdMilking.l_milking_start, timeframe)

    const rows = await fdm
      .select({
        l_id_herd: schema.herdMilking.l_id_herd,
        l_id_milktank: schema.herdMilking.l_id_milktank,
        l_milking_start: schema.herdMilking.l_milking_start,
        l_milking_end: schema.herdMilking.l_milking_end,
        l_milking_amount: schema.herdMilking.l_milking_amount,
        created: schema.herdMilking.created,
        updated: schema.herdMilking.updated,
      })
      .from(schema.herdMilking)
      .where(dateWhere)
      .orderBy(desc(schema.herdMilking.l_milking_start))

    return rows as MilkingHerd[]
  } catch (err) {
    throw handleError(err, "Exception for getMilkingHerd", { l_id_herd })
  }
}

/**
 * Adds an animal-level supplemental milking action (animal -> tank).
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal ID.
 * @param l_id_animal - Animal ID.
 * @param l_id_milktank - Milk tank ID.
 * @param l_milking_start - Start date/time.
 * @param properties - Optional end date and milk yield (kg).
 */
export async function addMilkingAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  l_id_milktank: schema.milkTanksTypeSelect["l_id_milktank"],
  l_milking_start = new Date(),
  properties?: {
    l_milking_end?: schema.animalMilkingTypeInsert["l_milking_end"]
    l_milking_amount?: schema.animalMilkingTypeInsert["l_milking_amount"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "addMilkingAnimal")
    assertIntervalEndNotBeforeStart(l_milking_start, properties?.l_milking_end, "l_milking")
    await assertSameFarm(fdm, { l_id_animal }, { l_id_milktank })

    await fdm.insert(schema.animalMilking).values({
      l_id_animal,
      l_id_milktank,
      l_milking_start,
      l_milking_end: properties?.l_milking_end ?? null,
      l_milking_amount: properties?.l_milking_amount ?? null,
    })
  } catch (err) {
    throw handleError(err, "Exception for addMilkingAnimal", {
      l_id_animal,
      l_id_milktank,
      l_milking_start,
    })
  }
}

/**
 * Corrects an existing animal-level milking action, identified by its full
 * composite key.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal correcting the milking action.
 * @param l_id_animal - Animal ID (part of the composite key).
 * @param l_id_milktank - Milk tank ID (part of the composite key).
 * @param l_milking_start - Milking start date/time (part of the composite key).
 * @param properties - Fields to correct.
 */
export async function updateMilkingAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  l_id_milktank: schema.milkTanksTypeSelect["l_id_milktank"],
  l_milking_start: schema.animalMilkingTypeSelect["l_milking_start"],
  properties: {
    l_milking_end?: schema.animalMilkingTypeInsert["l_milking_end"]
    l_milking_amount?: schema.animalMilkingTypeInsert["l_milking_amount"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "updateMilkingAnimal")
    if (properties.l_milking_end !== undefined) {
      assertIntervalEndNotBeforeStart(l_milking_start, properties.l_milking_end, "l_milking")
    }

    const result = await fdm
      .update(schema.animalMilking)
      // Only the documented columns: the animal, tank and start identify the record and never
      // change
      .set({
        l_milking_end: properties.l_milking_end,
        l_milking_amount: properties.l_milking_amount,
        updated: new Date(),
      })
      .where(
        and(
          eq(schema.animalMilking.l_id_animal, l_id_animal),
          eq(schema.animalMilking.l_id_milktank, l_id_milktank),
          eq(schema.animalMilking.l_milking_start, l_milking_start),
        ),
      )
      .returning({ l_id_animal: schema.animalMilking.l_id_animal })

    if (result.length === 0) {
      throw new Error("Milking animal record not found")
    }
  } catch (err) {
    throw handleError(err, "Exception for updateMilkingAnimal", {
      l_id_animal,
      l_id_milktank,
      l_milking_start,
      properties,
    })
  }
}

/**
 * Hard-deletes an animal-level milking action, identified by its full composite key.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the milking action.
 * @param l_id_animal - Animal ID (part of the composite key).
 * @param l_id_milktank - Milk tank ID (part of the composite key).
 * @param l_milking_start - Milking start date/time (part of the composite key).
 */
export async function removeMilkingAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  l_id_milktank: schema.milkTanksTypeSelect["l_id_milktank"],
  l_milking_start: schema.animalMilkingTypeSelect["l_milking_start"],
): Promise<void> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "removeMilkingAnimal")

    const result = await fdm
      .delete(schema.animalMilking)
      .where(
        and(
          eq(schema.animalMilking.l_id_animal, l_id_animal),
          eq(schema.animalMilking.l_id_milktank, l_id_milktank),
          eq(schema.animalMilking.l_milking_start, l_milking_start),
        ),
      )
      .returning({ l_id_animal: schema.animalMilking.l_id_animal })

    if (result.length === 0) {
      throw new Error("Milking animal record not found")
    }
  } catch (err) {
    throw handleError(err, "Exception for removeMilkingAnimal", {
      l_id_animal,
      l_id_milktank,
      l_milking_start,
    })
  }
}

/**
 * Retrieves raw animal-level milking records for an animal, optionally filtered by timeframe.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the milking records.
 * @param l_id_animal - Animal ID.
 * @param timeframe - Optional timeframe filter.
 * @returns Array of animal-level milking records.
 */
export async function getMilkingAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  timeframe?: Timeframe,
): Promise<MilkingAnimal[]> {
  try {
    await checkPermission(fdm, "animal", "read", l_id_animal, principal_id, "getMilkingAnimal")

    let dateWhere: SQL | undefined = eq(schema.animalMilking.l_id_animal, l_id_animal)
    dateWhere = withTimeframe(dateWhere, schema.animalMilking.l_milking_start, timeframe)

    const rows = await fdm
      .select({
        l_id_animal: schema.animalMilking.l_id_animal,
        l_id_milktank: schema.animalMilking.l_id_milktank,
        l_milking_start: schema.animalMilking.l_milking_start,
        l_milking_end: schema.animalMilking.l_milking_end,
        l_milking_amount: schema.animalMilking.l_milking_amount,
        created: schema.animalMilking.created,
        updated: schema.animalMilking.updated,
      })
      .from(schema.animalMilking)
      .where(dateWhere)
      .orderBy(desc(schema.animalMilking.l_milking_start))

    return rows as MilkingAnimal[]
  } catch (err) {
    throw handleError(err, "Exception for getMilkingAnimal", { l_id_animal })
  }
}

/**
 * Records an off-farm factory milk delivery from a milk tank and attaches factory milk statement quality parameters if present.
 * Quality parameters include fat %, protein %, lactose %, milk urea content (mg / 100 g milk), and Somatic Cell Count (1,000 cells/mL).
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal recording the delivery.
 * @param l_id_milktank - Identifier of the source milk tank.
 * @param l_milkdelivery_date - Delivery date.
 * @param l_milkdelivery_amount - Delivered milk volume (kg).
 * @param properties - Optional quality parameters and sampling date.
 * @returns Unique identifier of the created milk delivery.
 */
export async function addMilkDelivery(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_milktank: schema.milkTanksTypeSelect["l_id_milktank"],
  l_milkdelivery_date: Date,
  l_milkdelivery_amount: schema.milkDeliveringTypeInsert["l_milkdelivery_amount"],
  properties?: {
    l_milk_fat?: schema.milkAnalysesTypeInsert["l_milk_fat"]
    l_milk_protein?: schema.milkAnalysesTypeInsert["l_milk_protein"]
    l_milk_lactose?: schema.milkAnalysesTypeInsert["l_milk_lactose"]
    l_milk_urea?: schema.milkAnalysesTypeInsert["l_milk_urea"]
    l_milk_scc?: schema.milkAnalysesTypeInsert["l_milk_scc"]
    l_milksampling_date?: schema.milkSamplingTypeInsert["l_milksampling_date"]
  },
): Promise<schema.milkDeliveriesTypeSelect["l_id_milkdelivery"]> {
  try {
    await checkPermission(fdm, "milk", "write", l_id_milktank, principal_id, "addMilkDelivery")

    return await fdm.transaction(async (tx) => {
      const l_id_milkdelivery = createId()

      await tx.insert(schema.milkDeliveries).values({
        l_id_milkdelivery,
      })

      await tx.insert(schema.milkDelivering).values({
        l_id_milkdelivery,
        l_id_milktank,
        l_milkdelivery_date,
        l_milkdelivery_amount,
      })

      if (
        properties &&
        (properties.l_milk_fat !== undefined ||
          properties.l_milk_protein !== undefined ||
          properties.l_milk_lactose !== undefined ||
          properties.l_milk_urea !== undefined ||
          properties.l_milk_scc !== undefined)
      ) {
        const l_id_milkanalysis = createId()

        await tx.insert(schema.milkAnalyses).values({
          l_id_milkanalysis,
          l_milk_fat: properties.l_milk_fat ?? null,
          l_milk_protein: properties.l_milk_protein ?? null,
          l_milk_lactose: properties.l_milk_lactose ?? null,
          l_milk_urea: properties.l_milk_urea ?? null,
          l_milk_scc: properties.l_milk_scc ?? null,
        })

        await tx.insert(schema.milkSampling).values({
          l_id_milkdelivery,
          l_id_milkanalysis,
          l_milksampling_date: properties.l_milksampling_date,
        })
      }

      return l_id_milkdelivery
    })
  } catch (err) {
    throw handleError(err, "Exception for addMilkDelivery", {
      l_id_milktank,
      l_milkdelivery_date,
      l_milkdelivery_amount,
    })
  }
}

/**
 * Corrects an existing milk delivery action.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal correcting the delivery.
 * @param l_id_milkdelivery - Identifier of the delivering action.
 * @param properties - Fields to correct.
 */
export async function updateMilkDelivery(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_milkdelivery: schema.milkDeliveringTypeSelect["l_id_milkdelivery"],
  properties: {
    l_milkdelivery_date?: schema.milkDeliveringTypeInsert["l_milkdelivery_date"]
    l_milkdelivery_amount?: schema.milkDeliveringTypeInsert["l_milkdelivery_amount"]
    l_milk_fat?: schema.milkAnalysesTypeInsert["l_milk_fat"]
    l_milk_protein?: schema.milkAnalysesTypeInsert["l_milk_protein"]
    l_milk_lactose?: schema.milkAnalysesTypeInsert["l_milk_lactose"]
    l_milk_urea?: schema.milkAnalysesTypeInsert["l_milk_urea"]
    l_milk_scc?: schema.milkAnalysesTypeInsert["l_milk_scc"]
    l_milksampling_date?: schema.milkSamplingTypeInsert["l_milksampling_date"]
  },
): Promise<void> {
  try {
    // Check access first, so an unknown delivery and one of another farm give the same answer
    await checkPermission(
      fdm,
      "milk",
      "write",
      l_id_milkdelivery,
      principal_id,
      "updateMilkDelivery",
    )

    const existing = await fdm
      .select({
        l_id_milktank: schema.milkDelivering.l_id_milktank,
        l_id_milkdelivery: schema.milkDelivering.l_id_milkdelivery,
        l_milkdelivery_date: schema.milkDelivering.l_milkdelivery_date,
      })
      .from(schema.milkDelivering)
      .where(eq(schema.milkDelivering.l_id_milkdelivery, l_id_milkdelivery))
      .limit(1)

    if (existing.length === 0) {
      throw new Error("Milk delivering record not found")
    }

    await fdm.transaction(async (tx) => {
      const updated = new Date()

      const deliveringUpdate: {
        updated: Date
        l_milkdelivery_date?: schema.milkDeliveringTypeInsert["l_milkdelivery_date"]
        l_milkdelivery_amount?: schema.milkDeliveringTypeInsert["l_milkdelivery_amount"]
      } = { updated }

      if (properties.l_milkdelivery_date !== undefined) {
        deliveringUpdate.l_milkdelivery_date = properties.l_milkdelivery_date
      }
      if (properties.l_milkdelivery_amount !== undefined) {
        deliveringUpdate.l_milkdelivery_amount = properties.l_milkdelivery_amount
      }

      await tx
        .update(schema.milkDelivering)
        .set(deliveringUpdate)
        .where(eq(schema.milkDelivering.l_id_milkdelivery, l_id_milkdelivery))

      const hasAnalysisUpdates =
        properties.l_milk_fat !== undefined ||
        properties.l_milk_protein !== undefined ||
        properties.l_milk_lactose !== undefined ||
        properties.l_milk_urea !== undefined ||
        properties.l_milk_scc !== undefined

      const existingSampling = await tx
        .select({ l_id_milkanalysis: schema.milkSampling.l_id_milkanalysis })
        .from(schema.milkSampling)
        .where(eq(schema.milkSampling.l_id_milkdelivery, existing[0].l_id_milkdelivery))
        .limit(1)

      if (existingSampling.length === 0) {
        if (hasAnalysisUpdates) {
          const l_id_milkanalysis = createId()
          await tx.insert(schema.milkAnalyses).values({
            l_id_milkanalysis,
            l_milk_fat: properties.l_milk_fat ?? null,
            l_milk_protein: properties.l_milk_protein ?? null,
            l_milk_lactose: properties.l_milk_lactose ?? null,
            l_milk_urea: properties.l_milk_urea ?? null,
            l_milk_scc: properties.l_milk_scc ?? null,
          })
          await tx.insert(schema.milkSampling).values({
            l_id_milkdelivery: existing[0].l_id_milkdelivery,
            l_id_milkanalysis,
            l_milksampling_date: properties.l_milksampling_date,
          })
        }
        return
      }

      const l_id_milkanalysis = existingSampling[0].l_id_milkanalysis

      if (hasAnalysisUpdates) {
        const analysisUpdate: {
          updated: Date
          l_milk_fat?: schema.milkAnalysesTypeInsert["l_milk_fat"]
          l_milk_protein?: schema.milkAnalysesTypeInsert["l_milk_protein"]
          l_milk_lactose?: schema.milkAnalysesTypeInsert["l_milk_lactose"]
          l_milk_urea?: schema.milkAnalysesTypeInsert["l_milk_urea"]
          l_milk_scc?: schema.milkAnalysesTypeInsert["l_milk_scc"]
        } = { updated }

        if (properties.l_milk_fat !== undefined) {
          analysisUpdate.l_milk_fat = properties.l_milk_fat
        }
        if (properties.l_milk_protein !== undefined) {
          analysisUpdate.l_milk_protein = properties.l_milk_protein
        }
        if (properties.l_milk_lactose !== undefined) {
          analysisUpdate.l_milk_lactose = properties.l_milk_lactose
        }
        if (properties.l_milk_urea !== undefined) {
          analysisUpdate.l_milk_urea = properties.l_milk_urea
        }
        if (properties.l_milk_scc !== undefined) {
          analysisUpdate.l_milk_scc = properties.l_milk_scc
        }

        await tx
          .update(schema.milkAnalyses)
          .set(analysisUpdate)
          .where(eq(schema.milkAnalyses.l_id_milkanalysis, l_id_milkanalysis))
      }

      if (properties.l_milksampling_date !== undefined) {
        await tx
          .update(schema.milkSampling)
          .set({ l_milksampling_date: properties.l_milksampling_date, updated })
          .where(
            and(
              eq(schema.milkSampling.l_id_milkdelivery, existing[0].l_id_milkdelivery),
              eq(schema.milkSampling.l_id_milkanalysis, l_id_milkanalysis),
            ),
          )
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for updateMilkDelivery", {
      l_id_milkdelivery: l_id_milkdelivery,
      properties,
    })
  }
}

/**
 * Hard-deletes a milk delivery action and its own `milk_deliveries` and
 * `milk_sampling`/`milk_analyses` rows.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the delivery.
 * @param l_id_milkdelivery - Identifier of the delivering action.
 */
export async function removeMilkDelivery(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_milkdelivery: schema.milkDeliveringTypeSelect["l_id_milkdelivery"],
): Promise<void> {
  try {
    const existing = await fdm
      .select({
        l_id_milktank: schema.milkDelivering.l_id_milktank,
        l_id_milkdelivery: schema.milkDelivering.l_id_milkdelivery,
      })
      .from(schema.milkDelivering)
      .where(eq(schema.milkDelivering.l_id_milkdelivery, l_id_milkdelivery))
      .limit(1)

    if (existing.length === 0) {
      throw new Error("Milk delivering record not found")
    }

    await checkPermission(
      fdm,
      "milk",
      "write",
      existing[0].l_id_milktank,
      principal_id,
      "removeMilkDelivery",
    )

    await fdm.transaction(async (tx) => {
      const samplings = await tx
        .select({ l_id_milkanalysis: schema.milkSampling.l_id_milkanalysis })
        .from(schema.milkSampling)
        .where(eq(schema.milkSampling.l_id_milkdelivery, existing[0].l_id_milkdelivery))

      await tx
        .delete(schema.milkSampling)
        .where(eq(schema.milkSampling.l_id_milkdelivery, existing[0].l_id_milkdelivery))

      for (const sampling of samplings) {
        await tx
          .delete(schema.milkAnalyses)
          .where(eq(schema.milkAnalyses.l_id_milkanalysis, sampling.l_id_milkanalysis))
      }

      await tx
        .delete(schema.milkDelivering)
        .where(eq(schema.milkDelivering.l_id_milkdelivery, l_id_milkdelivery))
      await tx
        .delete(schema.milkDeliveries)
        .where(eq(schema.milkDeliveries.l_id_milkdelivery, l_id_milkdelivery))
    })
  } catch (err) {
    throw handleError(err, "Exception for removeMilkDelivery", { l_id_milkdelivery })
  }
}

/**
 * Retrieves a single milk delivery by its delivering-action ID, including its
 * associated quality analysis parameters if present.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the delivery.
 * @param l_id_milkdelivery - Identifier of the delivering action.
 * @returns The milk delivery record.
 */
export async function getMilkDelivery(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_milkdelivery: schema.milkDeliveringTypeSelect["l_id_milkdelivery"],
): Promise<MilkDelivery> {
  try {
    const rows = await fdm
      .select({
        l_id_milkdelivery: schema.milkDeliveries.l_id_milkdelivery,
        l_id_milktank: schema.milkDelivering.l_id_milktank,
        l_milkdelivery_date: schema.milkDelivering.l_milkdelivery_date,
        l_milkdelivery_amount: schema.milkDelivering.l_milkdelivery_amount,
        l_id_milkanalysis: schema.milkAnalyses.l_id_milkanalysis,
        l_milk_fat: schema.milkAnalyses.l_milk_fat,
        l_milk_protein: schema.milkAnalyses.l_milk_protein,
        l_milk_lactose: schema.milkAnalyses.l_milk_lactose,
        l_milk_urea: schema.milkAnalyses.l_milk_urea,
        l_milk_scc: schema.milkAnalyses.l_milk_scc,
        l_milksampling_date: schema.milkSampling.l_milksampling_date,
        created: schema.milkDeliveries.created,
        updated: schema.milkDeliveries.updated,
      })
      .from(schema.milkDelivering)
      .innerJoin(
        schema.milkDeliveries,
        eq(schema.milkDelivering.l_id_milkdelivery, schema.milkDeliveries.l_id_milkdelivery),
      )
      .leftJoin(
        schema.milkSampling,
        eq(schema.milkDelivering.l_id_milkdelivery, schema.milkSampling.l_id_milkdelivery),
      )
      .leftJoin(
        schema.milkAnalyses,
        eq(schema.milkSampling.l_id_milkanalysis, schema.milkAnalyses.l_id_milkanalysis),
      )
      .where(eq(schema.milkDelivering.l_id_milkdelivery, l_id_milkdelivery))
      .limit(1)

    if (rows.length === 0) {
      throw new Error("Milk delivering record not found")
    }

    await checkPermission(
      fdm,
      "milk",
      "read",
      rows[0].l_id_milktank,
      principal_id,
      "getMilkDelivery",
    )

    return rows[0] as MilkDelivery
  } catch (err) {
    throw handleError(err, "Exception for getMilkDelivery", { l_id_milkdelivery })
  }
}

/**
 * Retrieves all milk deliveries for a farm, optionally filtered by timeframe.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal ID.
 * @param b_id_farm - Farm ID.
 * @param timeframe - Optional start and end date bounds.
 * @returns Array of milk delivery objects.
 */
export async function getMilkDeliveriesForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  timeframe?: Timeframe,
): Promise<MilkDelivery[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getMilkDeliveriesForFarm")

    return await fdm.transaction(async (tx) => {
      // Find milk tank IDs belonging to this farm
      const farmTanks = await tx
        .select({ l_id_milktank: schema.milkTanks.l_id_milktank })
        .from(schema.milkTanks)
        .where(eq(schema.milkTanks.b_id_farm, b_id_farm))

      const tankIds = [...new Set(farmTanks.map((t) => t.l_id_milktank))]

      if (tankIds.length === 0) {
        return []
      }

      let whereClause: SQL | undefined = inArray(schema.milkDelivering.l_id_milktank, tankIds)
      whereClause = withTimeframe(whereClause, schema.milkDelivering.l_milkdelivery_date, timeframe)

      const rows = await tx
        .select({
          l_id_milkdelivery: schema.milkDeliveries.l_id_milkdelivery,
          l_id_milktank: schema.milkDelivering.l_id_milktank,
          l_milkdelivery_date: schema.milkDelivering.l_milkdelivery_date,
          l_milkdelivery_amount: schema.milkDelivering.l_milkdelivery_amount,
          l_id_milkanalysis: schema.milkAnalyses.l_id_milkanalysis,
          l_milk_fat: schema.milkAnalyses.l_milk_fat,
          l_milk_protein: schema.milkAnalyses.l_milk_protein,
          l_milk_lactose: schema.milkAnalyses.l_milk_lactose,
          l_milk_urea: schema.milkAnalyses.l_milk_urea,
          l_milk_scc: schema.milkAnalyses.l_milk_scc,
          l_milksampling_date: schema.milkSampling.l_milksampling_date,
          created: schema.milkDeliveries.created,
          updated: schema.milkDeliveries.updated,
        })
        .from(schema.milkDeliveries)
        .innerJoin(
          schema.milkDelivering,
          eq(schema.milkDeliveries.l_id_milkdelivery, schema.milkDelivering.l_id_milkdelivery),
        )
        .leftJoin(
          schema.milkSampling,
          eq(schema.milkDeliveries.l_id_milkdelivery, schema.milkSampling.l_id_milkdelivery),
        )
        .leftJoin(
          schema.milkAnalyses,
          eq(schema.milkSampling.l_id_milkanalysis, schema.milkAnalyses.l_id_milkanalysis),
        )
        .where(whereClause)
        .orderBy(desc(schema.milkDelivering.l_milkdelivery_date))

      return rows as MilkDelivery[]
    })
  } catch (err) {
    throw handleError(err, "Exception for getMilkDeliveriesForFarm", { b_id_farm })
  }
}

function sumMilkAmounts(rows: Array<{ l_milking_amount?: number | null }>): number {
  let total = new Decimal(0)
  for (const row of rows) {
    if (row.l_milking_amount !== null && row.l_milking_amount !== undefined) {
      total = total.plus(new Decimal(row.l_milking_amount))
    }
  }
  return total.toNumber()
}

/**
 * Totals milk from herd-level and animal-level records without counting the same milk twice:
 * when any animal-level record exists, only the animal-level records are summed; otherwise the
 * herd-level records are summed.
 */
function totalMilkWithoutDoubleCounting(
  herdRows: Array<{ l_milking_amount?: number | null }>,
  animalRows: Array<{ l_milking_amount?: number | null }>,
): number {
  return animalRows.length > 0 ? sumMilkAmounts(animalRows) : sumMilkAmounts(herdRows)
}

/**
 * Calculates total milk yield (in kg) for a herd over a specified timeframe.
 *
 * Milk can be recorded per herd and per animal. To avoid counting the same milk twice, the
 * animal-level records are used when any exist in the timeframe for animals that were assigned to
 * this herd at the milking timestamp; otherwise the herd-level records are used. This preference is
 * a modelling choice: animal-level records are assumed to be the more detailed source.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal requesting the calculation.
 * @param l_id_herd - Unique identifier of the herd.
 * @param timeframe - Optional timeframe bounds.
 * @returns Total calculated milk production in kg.
 */
export async function getMilkProductionForHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  timeframe?: Timeframe,
): Promise<number> {
  try {
    await checkPermission(fdm, "herd", "read", l_id_herd, principal_id, "getMilkProductionForHerd")

    return await fdm.transaction(async (tx) => {
      let herdWhere: SQL | undefined = eq(schema.herdMilking.l_id_herd, l_id_herd)
      herdWhere = withTimeframe(herdWhere, schema.herdMilking.l_milking_start, timeframe)

      const herdRows = await tx
        .select({ l_milking_amount: schema.herdMilking.l_milking_amount })
        .from(schema.herdMilking)
        .where(herdWhere)

      // Scope milking_animal rows to assignments in this herd whose interval
      // covers the milking date, so a reassigned animal's later milkings are
      // attributed to its new herd only.
      let animalWhere: SQL | undefined = eq(schema.animalAssigning.l_id_herd, l_id_herd)
      animalWhere = withTimeframe(animalWhere, schema.animalMilking.l_milking_start, timeframe)

      const animalRows = await tx
        .select({ l_milking_amount: schema.animalMilking.l_milking_amount })
        .from(schema.animalMilking)
        .innerJoin(
          schema.animalAssigning,
          and(
            eq(schema.animalMilking.l_id_animal, schema.animalAssigning.l_id_animal),
            lte(schema.animalAssigning.l_assigning_start, schema.animalMilking.l_milking_start),
            // Half-open assignments: at a move the milking counts for the new herd only
            or(
              isNull(schema.animalAssigning.l_assigning_end),
              gt(schema.animalAssigning.l_assigning_end, schema.animalMilking.l_milking_start),
            ),
          ),
        )
        .where(animalWhere)

      return totalMilkWithoutDoubleCounting(herdRows, animalRows)
    })
  } catch (err) {
    throw handleError(err, "Exception for getMilkProductionForHerd", { l_id_herd })
  }
}

async function listMilkingEventsForAnimal(
  tx: FdmType,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  timeframe?: Timeframe,
): Promise<MilkingEventForAnimal[]> {
  let herdWhere: SQL | undefined = eq(schema.animalAssigning.l_id_animal, l_id_animal)
  herdWhere = withTimeframe(herdWhere, schema.herdMilking.l_milking_start, timeframe)

  const herdRows = await tx
    .select({
      l_id_herd: schema.herdMilking.l_id_herd,
      l_id_milktank: schema.herdMilking.l_id_milktank,
      l_milking_start: schema.herdMilking.l_milking_start,
      l_milking_end: schema.herdMilking.l_milking_end,
      l_milking_amount: schema.herdMilking.l_milking_amount,
      created: schema.herdMilking.created,
      updated: schema.herdMilking.updated,
    })
    .from(schema.herdMilking)
    .innerJoin(
      schema.animalAssigning,
      and(
        eq(schema.herdMilking.l_id_herd, schema.animalAssigning.l_id_herd),
        eq(schema.animalAssigning.l_id_animal, l_id_animal),
        lte(schema.animalAssigning.l_assigning_start, schema.herdMilking.l_milking_start),
        // Half-open assignments: at a move only the new herd's milking counts
        or(
          isNull(schema.animalAssigning.l_assigning_end),
          gt(schema.animalAssigning.l_assigning_end, schema.herdMilking.l_milking_start),
        ),
      ),
    )
    .where(herdWhere)

  let animalWhere: SQL | undefined = eq(schema.animalMilking.l_id_animal, l_id_animal)
  animalWhere = withTimeframe(animalWhere, schema.animalMilking.l_milking_start, timeframe)

  const animalRows = await tx
    .select({
      l_id_animal: schema.animalMilking.l_id_animal,
      l_id_milktank: schema.animalMilking.l_id_milktank,
      l_milking_start: schema.animalMilking.l_milking_start,
      l_milking_end: schema.animalMilking.l_milking_end,
      l_milking_amount: schema.animalMilking.l_milking_amount,
      created: schema.animalMilking.created,
      updated: schema.animalMilking.updated,
    })
    .from(schema.animalMilking)
    .where(animalWhere)

  return [
    ...herdRows.map((row) => ({ type: "herd" as const, ...row })),
    ...animalRows.map((row) => ({ type: "animal" as const, ...row })),
  ].sort((a, b) => b.l_milking_start.getTime() - a.l_milking_start.getTime())
}

/**
 * Returns source-tagged milking events for an animal and timeframe.
 * Herd-level events are included when the herd assignment was active at the milking timestamp and
 * are returned with `type = "herd"`; animal-level events are returned with `type = "animal"`.
 */
export async function getMilkingEventsForAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  timeframe?: Timeframe,
): Promise<MilkingEventForAnimal[]> {
  try {
    await checkPermission(
      fdm,
      "animal",
      "read",
      l_id_animal,
      principal_id,
      "getMilkingEventsForAnimal",
    )
    return await fdm.transaction(async (tx) =>
      listMilkingEventsForAnimal(tx, l_id_animal, timeframe),
    )
  } catch (err) {
    throw handleError(err, "Exception for getMilkingEventsForAnimal", { l_id_animal, timeframe })
  }
}

/**
 * Returns a milking summary for an animal and timeframe based on source-tagged events.
 * The milk amount uses the animal-level events when any exist in the timeframe, and otherwise the
 * herd-level events of the animal's herd, so the same milk is not counted twice.
 * Milk-quality fields are null until quality measurements are associated with milking events.
 */
export async function getMilkingSummaryForAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  timeframe?: Timeframe,
): Promise<MilkingSummaryForAnimal> {
  try {
    await checkPermission(
      fdm,
      "animal",
      "read",
      l_id_animal,
      principal_id,
      "getMilkingSummaryForAnimal",
    )

    return await fdm.transaction(async (tx) => {
      const events = await listMilkingEventsForAnimal(tx, l_id_animal, timeframe)
      const totalMilkProduction = totalMilkWithoutDoubleCounting(
        events.filter((row) => row.type === "herd"),
        events.filter((row) => row.type === "animal"),
      )

      return {
        l_milking_amount: totalMilkProduction,
        l_milk_fat: null,
        l_milk_protein: null,
        l_milk_lactose: null,
        l_milk_urea: null,
        l_milk_scc: null,
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for getMilkingSummaryForAnimal", {
      l_id_animal,
      timeframe,
    })
  }
}
