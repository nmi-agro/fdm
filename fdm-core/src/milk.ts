import { Decimal } from "decimal.js"
import { and, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type { MilkDelivery } from "./milk.types"
import type { Timeframe } from "./timeframe"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { createId } from "./id"

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
        b_milktank_name: properties?.b_milktank_name ?? null,
      })

      return b_id_milktank
    })
  } catch (err) {
    throw handleError(err, "Exception for addMilkTank", { b_id_farm, properties })
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
export async function addMilking(
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
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "addMilking")

    await fdm.insert(schema.milkingHerd).values({
      l_id_herd,
      b_id_milktank,
      b_milking_start,
      b_milking_end: properties?.b_milking_end ?? null,
      b_milk_amount: properties?.b_milk_amount ?? null,
    })
  } catch (err) {
    throw handleError(err, "Exception for addMilking", {
      l_id_herd,
      b_id_milktank,
      b_milking_start,
    })
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
      // Find milk tank IDs belonging to herds on this farm
      const milkingTanks = await tx
        .select({ b_id_milktank: schema.milkingHerd.b_id_milktank })
        .from(schema.milkingHerd)
        .innerJoin(
          schema.herdStarting,
          eq(schema.milkingHerd.l_id_herd, schema.herdStarting.l_id_herd),
        )
        .where(eq(schema.herdStarting.b_id_farm, b_id_farm))

      const tankIds = [...new Set(milkingTanks.map((t) => t.b_id_milktank))]

      if (tankIds.length === 0) {
        return []
      }

      let whereClause: SQL | undefined = inArray(schema.milkDelivering.b_id_milktank, tankIds)
      if (timeframe?.start && timeframe?.end) {
        whereClause = and(
          whereClause,
          gte(schema.milkDelivering.b_milk_delivery_date, timeframe.start),
          lte(schema.milkDelivering.b_milk_delivery_date, timeframe.end),
        )
      } else if (timeframe?.start) {
        whereClause = and(
          whereClause,
          gte(schema.milkDelivering.b_milk_delivery_date, timeframe.start),
        )
      } else if (timeframe?.end) {
        whereClause = and(
          whereClause,
          lte(schema.milkDelivering.b_milk_delivery_date, timeframe.end),
        )
      }

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
      // Find all animals assigned to this herd
      const herdAnimals = await tx
        .select({ l_id_animal: schema.animalAssigning.l_id_animal })
        .from(schema.animalAssigning)
        .where(eq(schema.animalAssigning.l_id_herd, l_id_herd))

      const animalIds = herdAnimals.map((a) => a.l_id_animal)

      if (animalIds.length > 0) {
        let animalWhere: SQL | undefined = inArray(schema.milkingAnimal.l_id_animal, animalIds)
        if (timeframe?.start && timeframe?.end) {
          animalWhere = and(
            animalWhere,
            gte(schema.milkingAnimal.b_milking_start, timeframe.start),
            lte(schema.milkingAnimal.b_milking_start, timeframe.end),
          )
        } else if (timeframe?.start) {
          animalWhere = and(animalWhere, gte(schema.milkingAnimal.b_milking_start, timeframe.start))
        } else if (timeframe?.end) {
          animalWhere = and(animalWhere, lte(schema.milkingAnimal.b_milking_start, timeframe.end))
        }

        const animalRows = await tx
          .select({ b_milk_amount: schema.milkingAnimal.b_milk_amount })
          .from(schema.milkingAnimal)
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
      }

      // Fallback: sum herd-level milking rows
      let herdWhere: SQL | undefined = eq(schema.milkingHerd.l_id_herd, l_id_herd)
      if (timeframe?.start && timeframe?.end) {
        herdWhere = and(
          herdWhere,
          gte(schema.milkingHerd.b_milking_start, timeframe.start),
          lte(schema.milkingHerd.b_milking_start, timeframe.end),
        )
      } else if (timeframe?.start) {
        herdWhere = and(herdWhere, gte(schema.milkingHerd.b_milking_start, timeframe.start))
      } else if (timeframe?.end) {
        herdWhere = and(herdWhere, lte(schema.milkingHerd.b_milking_start, timeframe.end))
      }

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
