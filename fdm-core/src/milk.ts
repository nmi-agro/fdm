import { Decimal } from "decimal.js"
import { and, desc, eq, gte, inArray, isNull, lte, or, type SQL } from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type { MilkDelivery, Milking, MilkingAnimal, MilkTank } from "./milk.types"
import type { Timeframe } from "./timeframe"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { createId } from "./id"
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
    b_milktank_name?: schema.milkTanksTypeInsert["b_milktank_name"]
  },
): Promise<schema.milkTanksTypeSelect["b_id_milktank"]> {
  try {
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "addMilkTank")

    return await fdm.transaction(async (tx) => {
      const b_id_milktank = createId()

      await tx.insert(schema.milkTanks).values({
        b_id_milktank,
        b_id_farm,
        b_milktank_name: properties?.b_milktank_name ?? null,
      })

      return b_id_milktank
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
 * @param b_id_milktank - Identifier of the milk tank.
 * @returns The milk tank.
 */
export async function getMilkTank(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_milktank: schema.milkTanksTypeSelect["b_id_milktank"],
): Promise<MilkTank> {
  try {
    await checkPermission(fdm, "milk", "read", b_id_milktank, principal_id, "getMilkTank")

    const rows = await fdm
      .select({
        b_id_milktank: schema.milkTanks.b_id_milktank,
        b_id_farm: schema.milkTanks.b_id_farm,
        b_milktank_name: schema.milkTanks.b_milktank_name,
        created: schema.milkTanks.created,
        updated: schema.milkTanks.updated,
      })
      .from(schema.milkTanks)
      .where(eq(schema.milkTanks.b_id_milktank, b_id_milktank))
      .limit(1)

    if (rows.length === 0) {
      throw new Error("Milk tank not found")
    }

    return rows[0] as MilkTank
  } catch (err) {
    throw handleError(err, "Exception for getMilkTank", { b_id_milktank })
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
        b_id_milktank: schema.milkTanks.b_id_milktank,
        b_id_farm: schema.milkTanks.b_id_farm,
        b_milktank_name: schema.milkTanks.b_milktank_name,
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
 * @param b_id_milktank - Identifier of the milk tank.
 * @param properties - Properties to update.
 */
export async function updateMilkTank(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_milktank: schema.milkTanksTypeSelect["b_id_milktank"],
  properties: {
    b_milktank_name?: schema.milkTanksTypeInsert["b_milktank_name"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "milk", "write", b_id_milktank, principal_id, "updateMilkTank")

    await fdm
      .update(schema.milkTanks)
      .set({ ...properties, updated: new Date() })
      .where(eq(schema.milkTanks.b_id_milktank, b_id_milktank))
  } catch (err) {
    throw handleError(err, "Exception for updateMilkTank", { b_id_milktank, properties })
  }
}

/**
 * Hard-deletes a milk tank. Guarded: rejected if any milking_herd,
 * milking_animal, or milk_delivering record still references this tank —
 * those represent other actions' history and must be cleaned up first.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the milk tank.
 * @param b_id_milktank - Identifier of the milk tank.
 */
export async function removeMilkTank(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_milktank: schema.milkTanksTypeSelect["b_id_milktank"],
): Promise<void> {
  try {
    await checkPermission(fdm, "milk", "write", b_id_milktank, principal_id, "removeMilkTank")

    await fdm.transaction(async (tx) => {
      const milkingHerdRecords = await tx
        .select({ l_id_herd: schema.milkingHerd.l_id_herd })
        .from(schema.milkingHerd)
        .where(eq(schema.milkingHerd.b_id_milktank, b_id_milktank))
        .limit(1)

      if (milkingHerdRecords.length > 0) {
        throw new Error("Cannot remove milk tank: a milking_herd record references it")
      }

      const milkingAnimalRecords = await tx
        .select({ l_id_animal: schema.milkingAnimal.l_id_animal })
        .from(schema.milkingAnimal)
        .where(eq(schema.milkingAnimal.b_id_milktank, b_id_milktank))
        .limit(1)

      if (milkingAnimalRecords.length > 0) {
        throw new Error("Cannot remove milk tank: a milking_animal record references it")
      }

      const deliveringRecords = await tx
        .select({ b_id_milk_delivering: schema.milkDelivering.b_id_milk_delivering })
        .from(schema.milkDelivering)
        .where(eq(schema.milkDelivering.b_id_milktank, b_id_milktank))
        .limit(1)

      if (deliveringRecords.length > 0) {
        throw new Error("Cannot remove milk tank: a milk_delivering record references it")
      }

      await tx.delete(schema.milkTanks).where(eq(schema.milkTanks.b_id_milktank, b_id_milktank))
    })
  } catch (err) {
    throw handleError(err, "Exception for removeMilkTank", { b_id_milktank })
  }
}

/**
 * Adds a herd-level milking action (herd -> tank).
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal ID.
 * @param l_id_herd - Herd ID.
 * @param b_id_milktank - Milk tank ID.
 * @param b_milking_start - Milking start date/time.
 * @param properties - Optional end date and milk yield (kg).
 */
export async function addMilkingHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  b_id_milktank: schema.milkTanksTypeSelect["b_id_milktank"],
  b_milking_start = new Date(),
  properties?: {
    b_milking_end?: schema.milkingHerdTypeInsert["b_milking_end"]
    b_milk_amount?: schema.milkingHerdTypeInsert["b_milk_amount"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "addMilkingHerd")

    await fdm.insert(schema.milkingHerd).values({
      l_id_herd,
      b_id_milktank,
      b_milking_start,
      b_milking_end: properties?.b_milking_end ?? null,
      b_milk_amount: properties?.b_milk_amount ?? null,
    })
  } catch (err) {
    throw handleError(err, "Exception for addMilkingHerd", {
      l_id_herd,
      b_id_milktank,
      b_milking_start,
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
 * @param b_id_milktank - Milk tank ID (part of the composite key).
 * @param b_milking_start - Milking start date/time (part of the composite key).
 * @param properties - Fields to correct.
 */
export async function updateMilkingHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  b_id_milktank: schema.milkTanksTypeSelect["b_id_milktank"],
  b_milking_start: schema.milkingHerdTypeSelect["b_milking_start"],
  properties: {
    b_milking_end?: schema.milkingHerdTypeInsert["b_milking_end"]
    b_milk_amount?: schema.milkingHerdTypeInsert["b_milk_amount"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "updateMilkingHerd")

    const result = await fdm
      .update(schema.milkingHerd)
      .set({ ...properties, updated: new Date() })
      .where(
        and(
          eq(schema.milkingHerd.l_id_herd, l_id_herd),
          eq(schema.milkingHerd.b_id_milktank, b_id_milktank),
          eq(schema.milkingHerd.b_milking_start, b_milking_start),
        ),
      )
      .returning({ l_id_herd: schema.milkingHerd.l_id_herd })

    if (result.length === 0) {
      throw new Error("Milking herd record not found")
    }
  } catch (err) {
    throw handleError(err, "Exception for updateMilkingHerd", {
      l_id_herd,
      b_id_milktank,
      b_milking_start,
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
 * @param b_id_milktank - Milk tank ID (part of the composite key).
 * @param b_milking_start - Milking start date/time (part of the composite key).
 */
export async function removeMilkingHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  b_id_milktank: schema.milkTanksTypeSelect["b_id_milktank"],
  b_milking_start: schema.milkingHerdTypeSelect["b_milking_start"],
): Promise<void> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "removeMilkingHerd")

    const result = await fdm
      .delete(schema.milkingHerd)
      .where(
        and(
          eq(schema.milkingHerd.l_id_herd, l_id_herd),
          eq(schema.milkingHerd.b_id_milktank, b_id_milktank),
          eq(schema.milkingHerd.b_milking_start, b_milking_start),
        ),
      )
      .returning({ l_id_herd: schema.milkingHerd.l_id_herd })

    if (result.length === 0) {
      throw new Error("Milking herd record not found")
    }
  } catch (err) {
    throw handleError(err, "Exception for removeMilkingHerd", {
      l_id_herd,
      b_id_milktank,
      b_milking_start,
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
): Promise<Milking[]> {
  try {
    await checkPermission(fdm, "herd", "read", l_id_herd, principal_id, "getMilkingHerd")

    let dateWhere: SQL | undefined = eq(schema.milkingHerd.l_id_herd, l_id_herd)
    dateWhere = withTimeframe(dateWhere, schema.milkingHerd.b_milking_start, timeframe)

    const rows = await fdm
      .select({
        l_id_herd: schema.milkingHerd.l_id_herd,
        b_id_milktank: schema.milkingHerd.b_id_milktank,
        b_milking_start: schema.milkingHerd.b_milking_start,
        b_milking_end: schema.milkingHerd.b_milking_end,
        b_milk_amount: schema.milkingHerd.b_milk_amount,
        created: schema.milkingHerd.created,
        updated: schema.milkingHerd.updated,
      })
      .from(schema.milkingHerd)
      .where(dateWhere)
      .orderBy(desc(schema.milkingHerd.b_milking_start))

    return rows as Milking[]
  } catch (err) {
    throw handleError(err, "Exception for getMilkingHerd", { l_id_herd })
  }
}

/**
 * Adds an animal-level milking action (animal -> tank).
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal ID.
 * @param l_id_animal - Animal ID.
 * @param b_id_milktank - Milk tank ID.
 * @param b_milking_start - Start date/time.
 * @param properties - Optional end date and milk yield (kg).
 */
export async function addMilkingAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  b_id_milktank: schema.milkTanksTypeSelect["b_id_milktank"],
  b_milking_start = new Date(),
  properties?: {
    b_milking_end?: schema.milkingAnimalTypeInsert["b_milking_end"]
    b_milk_amount?: schema.milkingAnimalTypeInsert["b_milk_amount"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "addMilkingAnimal")

    await fdm.insert(schema.milkingAnimal).values({
      l_id_animal,
      b_id_milktank,
      b_milking_start,
      b_milking_end: properties?.b_milking_end ?? null,
      b_milk_amount: properties?.b_milk_amount ?? null,
    })
  } catch (err) {
    throw handleError(err, "Exception for addMilkingAnimal", {
      l_id_animal,
      b_id_milktank,
      b_milking_start,
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
 * @param b_id_milktank - Milk tank ID (part of the composite key).
 * @param b_milking_start - Milking start date/time (part of the composite key).
 * @param properties - Fields to correct.
 */
export async function updateMilkingAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  b_id_milktank: schema.milkTanksTypeSelect["b_id_milktank"],
  b_milking_start: schema.milkingAnimalTypeSelect["b_milking_start"],
  properties: {
    b_milking_end?: schema.milkingAnimalTypeInsert["b_milking_end"]
    b_milk_amount?: schema.milkingAnimalTypeInsert["b_milk_amount"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "updateMilkingAnimal")

    const result = await fdm
      .update(schema.milkingAnimal)
      .set({ ...properties, updated: new Date() })
      .where(
        and(
          eq(schema.milkingAnimal.l_id_animal, l_id_animal),
          eq(schema.milkingAnimal.b_id_milktank, b_id_milktank),
          eq(schema.milkingAnimal.b_milking_start, b_milking_start),
        ),
      )
      .returning({ l_id_animal: schema.milkingAnimal.l_id_animal })

    if (result.length === 0) {
      throw new Error("Milking animal record not found")
    }
  } catch (err) {
    throw handleError(err, "Exception for updateMilkingAnimal", {
      l_id_animal,
      b_id_milktank,
      b_milking_start,
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
 * @param b_id_milktank - Milk tank ID (part of the composite key).
 * @param b_milking_start - Milking start date/time (part of the composite key).
 */
export async function removeMilkingAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  b_id_milktank: schema.milkTanksTypeSelect["b_id_milktank"],
  b_milking_start: schema.milkingAnimalTypeSelect["b_milking_start"],
): Promise<void> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "removeMilkingAnimal")

    const result = await fdm
      .delete(schema.milkingAnimal)
      .where(
        and(
          eq(schema.milkingAnimal.l_id_animal, l_id_animal),
          eq(schema.milkingAnimal.b_id_milktank, b_id_milktank),
          eq(schema.milkingAnimal.b_milking_start, b_milking_start),
        ),
      )
      .returning({ l_id_animal: schema.milkingAnimal.l_id_animal })

    if (result.length === 0) {
      throw new Error("Milking animal record not found")
    }
  } catch (err) {
    throw handleError(err, "Exception for removeMilkingAnimal", {
      l_id_animal,
      b_id_milktank,
      b_milking_start,
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

    let dateWhere: SQL | undefined = eq(schema.milkingAnimal.l_id_animal, l_id_animal)
    dateWhere = withTimeframe(dateWhere, schema.milkingAnimal.b_milking_start, timeframe)

    const rows = await fdm
      .select({
        l_id_animal: schema.milkingAnimal.l_id_animal,
        b_id_milktank: schema.milkingAnimal.b_id_milktank,
        b_milking_start: schema.milkingAnimal.b_milking_start,
        b_milking_end: schema.milkingAnimal.b_milking_end,
        b_milk_amount: schema.milkingAnimal.b_milk_amount,
        created: schema.milkingAnimal.created,
        updated: schema.milkingAnimal.updated,
      })
      .from(schema.milkingAnimal)
      .where(dateWhere)
      .orderBy(desc(schema.milkingAnimal.b_milking_start))

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
 * @param b_id_milktank - Identifier of the source milk tank.
 * @param b_milk_delivery_date - Delivery date.
 * @param b_milk_amount - Delivered milk volume (kg).
 * @param properties - Optional quality parameters and sampling date.
 * @returns Unique identifier of the created milk delivery.
 */
export async function addMilkDelivery(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_milktank: schema.milkTanksTypeSelect["b_id_milktank"],
  b_milk_delivery_date: Date,
  b_milk_amount: schema.milkDeliveringTypeInsert["b_milk_amount"],
  properties?: {
    b_milk_fat?: schema.milkAnalysesTypeInsert["b_milk_fat"]
    b_milk_protein?: schema.milkAnalysesTypeInsert["b_milk_protein"]
    b_milk_lactose?: schema.milkAnalysesTypeInsert["b_milk_lactose"]
    b_milk_urea?: schema.milkAnalysesTypeInsert["b_milk_urea"]
    b_milk_scc?: schema.milkAnalysesTypeInsert["b_milk_scc"]
    b_sampling_date?: Date
  },
): Promise<schema.milkDeliveriesTypeSelect["b_id_milk_delivery"]> {
  try {
    await checkPermission(fdm, "milk", "write", b_id_milktank, principal_id, "addMilkDelivery")

    return await fdm.transaction(async (tx) => {
      const b_id_milk_delivery = createId()
      const b_id_milk_delivering = createId()

      await tx.insert(schema.milkDeliveries).values({
        b_id_milk_delivery,
      })

      await tx.insert(schema.milkDelivering).values({
        b_id_milk_delivering,
        b_id_milktank,
        b_id_milk_delivery,
        b_milk_delivery_date,
        b_milk_amount,
      })

      if (
        properties &&
        (properties.b_milk_fat !== undefined ||
          properties.b_milk_protein !== undefined ||
          properties.b_milk_lactose !== undefined ||
          properties.b_milk_urea !== undefined ||
          properties.b_milk_scc !== undefined)
      ) {
        const b_id_milk_analysis = createId()

        await tx.insert(schema.milkAnalyses).values({
          b_id_milk_analysis,
          b_milk_fat: properties.b_milk_fat ?? null,
          b_milk_protein: properties.b_milk_protein ?? null,
          b_milk_lactose: properties.b_milk_lactose ?? null,
          b_milk_urea: properties.b_milk_urea ?? null,
          b_milk_scc: properties.b_milk_scc ?? null,
        })

        await tx.insert(schema.milkSampling).values({
          b_id_milk_delivery,
          b_id_milk_analysis,
          b_sampling_date: properties.b_sampling_date ?? b_milk_delivery_date,
        })
      }

      return b_id_milk_delivery
    })
  } catch (err) {
    throw handleError(err, "Exception for addMilkDelivery", {
      b_id_milktank,
      b_milk_delivery_date,
      b_milk_amount,
    })
  }
}

/**
 * Corrects an existing milk delivery action.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal correcting the delivery.
 * @param b_id_milk_delivering - Identifier of the delivering action.
 * @param properties - Fields to correct.
 */
export async function updateMilkDelivery(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_milk_delivering: schema.milkDeliveringTypeSelect["b_id_milk_delivering"],
  properties: {
    b_milk_delivery_date?: schema.milkDeliveringTypeInsert["b_milk_delivery_date"]
    b_milk_amount?: schema.milkDeliveringTypeInsert["b_milk_amount"]
  },
): Promise<void> {
  try {
    const existing = await fdm
      .select({ b_id_milktank: schema.milkDelivering.b_id_milktank })
      .from(schema.milkDelivering)
      .where(eq(schema.milkDelivering.b_id_milk_delivering, b_id_milk_delivering))
      .limit(1)

    if (existing.length === 0) {
      throw new Error("Milk delivering record not found")
    }

    await checkPermission(
      fdm,
      "milk",
      "write",
      existing[0].b_id_milktank,
      principal_id,
      "updateMilkDelivery",
    )

    await fdm
      .update(schema.milkDelivering)
      .set({ ...properties, updated: new Date() })
      .where(eq(schema.milkDelivering.b_id_milk_delivering, b_id_milk_delivering))
  } catch (err) {
    throw handleError(err, "Exception for updateMilkDelivery", {
      b_id_milk_delivering,
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
 * @param b_id_milk_delivering - Identifier of the delivering action.
 */
export async function removeMilkDelivery(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_milk_delivering: schema.milkDeliveringTypeSelect["b_id_milk_delivering"],
): Promise<void> {
  try {
    const existing = await fdm
      .select({
        b_id_milktank: schema.milkDelivering.b_id_milktank,
        b_id_milk_delivery: schema.milkDelivering.b_id_milk_delivery,
      })
      .from(schema.milkDelivering)
      .where(eq(schema.milkDelivering.b_id_milk_delivering, b_id_milk_delivering))
      .limit(1)

    if (existing.length === 0) {
      throw new Error("Milk delivering record not found")
    }

    await checkPermission(
      fdm,
      "milk",
      "write",
      existing[0].b_id_milktank,
      principal_id,
      "removeMilkDelivery",
    )

    const { b_id_milk_delivery } = existing[0]

    await fdm.transaction(async (tx) => {
      const samplings = await tx
        .select({ b_id_milk_analysis: schema.milkSampling.b_id_milk_analysis })
        .from(schema.milkSampling)
        .where(eq(schema.milkSampling.b_id_milk_delivery, b_id_milk_delivery))

      await tx
        .delete(schema.milkSampling)
        .where(eq(schema.milkSampling.b_id_milk_delivery, b_id_milk_delivery))

      for (const sampling of samplings) {
        await tx
          .delete(schema.milkAnalyses)
          .where(eq(schema.milkAnalyses.b_id_milk_analysis, sampling.b_id_milk_analysis))
      }

      await tx
        .delete(schema.milkDelivering)
        .where(eq(schema.milkDelivering.b_id_milk_delivering, b_id_milk_delivering))
      await tx
        .delete(schema.milkDeliveries)
        .where(eq(schema.milkDeliveries.b_id_milk_delivery, b_id_milk_delivery))
    })
  } catch (err) {
    throw handleError(err, "Exception for removeMilkDelivery", { b_id_milk_delivering })
  }
}

/**
 * Retrieves a single milk delivery by its delivering-action ID, including its
 * associated quality analysis parameters if present.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the delivery.
 * @param b_id_milk_delivering - Identifier of the delivering action.
 * @returns The milk delivery record.
 */
export async function getMilkDelivery(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_milk_delivering: schema.milkDeliveringTypeSelect["b_id_milk_delivering"],
): Promise<MilkDelivery> {
  try {
    const rows = await fdm
      .select({
        b_id_milk_delivery: schema.milkDeliveries.b_id_milk_delivery,
        b_id_milktank: schema.milkDelivering.b_id_milktank,
        b_id_milk_delivering: schema.milkDelivering.b_id_milk_delivering,
        b_milk_delivery_date: schema.milkDelivering.b_milk_delivery_date,
        b_milk_amount: schema.milkDelivering.b_milk_amount,
        b_id_milk_analysis: schema.milkAnalyses.b_id_milk_analysis,
        b_milk_fat: schema.milkAnalyses.b_milk_fat,
        b_milk_protein: schema.milkAnalyses.b_milk_protein,
        b_milk_lactose: schema.milkAnalyses.b_milk_lactose,
        b_milk_urea: schema.milkAnalyses.b_milk_urea,
        b_milk_scc: schema.milkAnalyses.b_milk_scc,
        b_sampling_date: schema.milkSampling.b_sampling_date,
        created: schema.milkDeliveries.created,
        updated: schema.milkDeliveries.updated,
      })
      .from(schema.milkDelivering)
      .innerJoin(
        schema.milkDeliveries,
        eq(schema.milkDelivering.b_id_milk_delivery, schema.milkDeliveries.b_id_milk_delivery),
      )
      .leftJoin(
        schema.milkSampling,
        eq(schema.milkDelivering.b_id_milk_delivery, schema.milkSampling.b_id_milk_delivery),
      )
      .leftJoin(
        schema.milkAnalyses,
        eq(schema.milkSampling.b_id_milk_analysis, schema.milkAnalyses.b_id_milk_analysis),
      )
      .where(eq(schema.milkDelivering.b_id_milk_delivering, b_id_milk_delivering))
      .limit(1)

    if (rows.length === 0) {
      throw new Error("Milk delivering record not found")
    }

    await checkPermission(
      fdm,
      "milk",
      "read",
      rows[0].b_id_milktank,
      principal_id,
      "getMilkDelivery",
    )

    return rows[0] as MilkDelivery
  } catch (err) {
    throw handleError(err, "Exception for getMilkDelivery", { b_id_milk_delivering })
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
        .select({ b_id_milktank: schema.milkTanks.b_id_milktank })
        .from(schema.milkTanks)
        .where(eq(schema.milkTanks.b_id_farm, b_id_farm))

      const tankIds = [...new Set(farmTanks.map((t) => t.b_id_milktank))]

      if (tankIds.length === 0) {
        return []
      }

      let whereClause: SQL | undefined = inArray(schema.milkDelivering.b_id_milktank, tankIds)
      whereClause = withTimeframe(
        whereClause,
        schema.milkDelivering.b_milk_delivery_date,
        timeframe,
      )

      const rows = await tx
        .select({
          b_id_milk_delivery: schema.milkDeliveries.b_id_milk_delivery,
          b_id_milktank: schema.milkDelivering.b_id_milktank,
          b_id_milk_delivering: schema.milkDelivering.b_id_milk_delivering,
          b_milk_delivery_date: schema.milkDelivering.b_milk_delivery_date,
          b_milk_amount: schema.milkDelivering.b_milk_amount,
          b_id_milk_analysis: schema.milkAnalyses.b_id_milk_analysis,
          b_milk_fat: schema.milkAnalyses.b_milk_fat,
          b_milk_protein: schema.milkAnalyses.b_milk_protein,
          b_milk_lactose: schema.milkAnalyses.b_milk_lactose,
          b_milk_urea: schema.milkAnalyses.b_milk_urea,
          b_milk_scc: schema.milkAnalyses.b_milk_scc,
          b_sampling_date: schema.milkSampling.b_sampling_date,
          created: schema.milkDeliveries.created,
          updated: schema.milkDeliveries.updated,
        })
        .from(schema.milkDeliveries)
        .innerJoin(
          schema.milkDelivering,
          eq(schema.milkDeliveries.b_id_milk_delivery, schema.milkDelivering.b_id_milk_delivery),
        )
        .leftJoin(
          schema.milkSampling,
          eq(schema.milkDeliveries.b_id_milk_delivery, schema.milkSampling.b_id_milk_delivery),
        )
        .leftJoin(
          schema.milkAnalyses,
          eq(schema.milkSampling.b_id_milk_analysis, schema.milkAnalyses.b_id_milk_analysis),
        )
        .where(whereClause)
        .orderBy(desc(schema.milkDelivering.b_milk_delivery_date))

      return rows as MilkDelivery[]
    })
  } catch (err) {
    throw handleError(err, "Exception for getMilkDeliveriesForFarm", { b_id_farm })
  }
}

/**
 * Calculates total milk yield (in kg) for a herd over a specified timeframe without double counting.
 * Prefers individual animal-level sum (`milking_animal`) when any individual records exist for animals in this herd during the timeframe,
 * otherwise falls back to bulk herd-level milking records (`milking_herd`).
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
      // Scope milking_animal rows to assignments in this herd whose interval
      // covers the milking date, so a reassigned animal's later milkings are
      // attributed to its new herd only (no double counting across herds).
      let animalWhere: SQL | undefined = eq(schema.animalAssigning.l_id_herd, l_id_herd)
      animalWhere = withTimeframe(animalWhere, schema.milkingAnimal.b_milking_start, timeframe)

      const animalRows = await tx
        .select({ b_milk_amount: schema.milkingAnimal.b_milk_amount })
        .from(schema.milkingAnimal)
        .innerJoin(
          schema.animalAssigning,
          and(
            eq(schema.milkingAnimal.l_id_animal, schema.animalAssigning.l_id_animal),
            lte(schema.animalAssigning.l_assigning_start, schema.milkingAnimal.b_milking_start),
            or(
              isNull(schema.animalAssigning.l_assigning_end),
              gte(schema.animalAssigning.l_assigning_end, schema.milkingAnimal.b_milking_start),
            ),
          ),
        )
        .where(animalWhere)

      if (animalRows.length > 0) {
        // Animal-level rows exist: sum animal milk production
        let total = new Decimal(0)
        for (const row of animalRows) {
          if (row.b_milk_amount !== null && row.b_milk_amount !== undefined) {
            total = total.plus(new Decimal(row.b_milk_amount))
          }
        }
        return total.toNumber()
      }

      // Fallback: sum herd-level milking rows
      let herdWhere: SQL | undefined = eq(schema.milkingHerd.l_id_herd, l_id_herd)
      herdWhere = withTimeframe(herdWhere, schema.milkingHerd.b_milking_start, timeframe)

      const herdRows = await tx
        .select({ b_milk_amount: schema.milkingHerd.b_milk_amount })
        .from(schema.milkingHerd)
        .where(herdWhere)

      let total = new Decimal(0)
      for (const row of herdRows) {
        if (row.b_milk_amount !== null && row.b_milk_amount !== undefined) {
          total = total.plus(new Decimal(row.b_milk_amount))
        }
      }
      return total.toNumber()
    })
  } catch (err) {
    throw handleError(err, "Exception for getMilkProductionForHerd", { l_id_herd })
  }
}
