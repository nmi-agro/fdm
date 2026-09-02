import { and, desc, eq } from "drizzle-orm"
import { checkPermission } from "./authorization"
import { PrincipalId } from "./authorization.types"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { FdmType } from "./fdm.types"
import { createId } from "./id"
import { FertilizerPlan, FoundFertilizerPlan } from "./fertilizer-plan.types"

const fertilizerPlanColumns = {
  p_id_plan: schema.fertilizerPlans.p_id_plan,
  p_plan_year: schema.fertilizerPlans.p_plan_year,
  p_plan_file_path: schema.fertilizerPlans.p_plan_file_path,
  p_plan_hash: schema.fertilizerPlans.p_plan_hash,
} as const satisfies Record<Exclude<keyof schema.fertilizerPlansTypeSelect, "created" | "updated">, any>
const fertilizerPlanEstablishingColumns = {
  b_id_farm: schema.fertilizerPlanEstablishing.b_id_farm,
  p_plan_date: schema.fertilizerPlanEstablishing.p_plan_date,
} as const satisfies Record<Exclude<keyof schema.fertilizerPlanEstablishingTypeSelect, "p_id_plan" | "created" | "updated">, any>

/**
 * Gets the saved fertilizer plans for the given year.
 *
 * The year parameter has nothing to do with when the fertilizer plan was actually created.
 * Only the year the plan was established *for* is considered.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal requesting the fertilizer plans.
 * @param b_id_farm The ID of the farm.
 * @param year The year to get the existing fertilizer plans for.
 * @returns An array of existing fertilizer plans, for a given year in case the year was specified.
 */
export async function getFertilizerPlans(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.fertilizerPlanEstablishingTypeSelect["b_id_farm"],
  year?: number,
): Promise<FertilizerPlan[]> {
  try {
    if (typeof year === "number" && !Number.isInteger(year)) {
      throw new Error(`Unsupported year: ${year}`)
    }
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getFertilizerPlans")

    return await fdm
      .select({ ...fertilizerPlanColumns, ...fertilizerPlanEstablishingColumns })
      .from(schema.fertilizerPlanEstablishing)
      .innerJoin(
        schema.fertilizerPlans,
        eq(schema.fertilizerPlanEstablishing.p_id_plan, schema.fertilizerPlans.p_id_plan),
      )
      .where(
        and(
          eq(schema.fertilizerPlanEstablishing.b_id_farm, b_id_farm),
          typeof year === "number" ? eq(schema.fertilizerPlans.p_plan_year, year) : undefined,
        ),
      )
      .orderBy(
        desc(schema.fertilizerPlans.p_plan_year),
        desc(schema.fertilizerPlanEstablishing.p_plan_date),
      )
  } catch (e) {
    throw handleError(e, "Exception for getFertilizerPlans", { principal_id, b_id_farm, year })
  }
}

/**
 * Gets the saved fertilizer plan with the given ID.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal requesting the fertilizer plans.
 * @param p_id_plan ID of the plan to get
 */
export async function getFertilizerPlan(
  fdm: FdmType,
  principal_id: PrincipalId,
  p_id_plan: schema.fertilizerPlanEstablishingTypeSelect["p_id_plan"],
): Promise<FoundFertilizerPlan> {
  try {
    await checkPermission(
      fdm,
      "fertilizer_plan",
      "read",
      p_id_plan,
      principal_id,
      "getFertilizerPlan",
    )

    const found = await fdm
      .select({ ...fertilizerPlanColumns, ...fertilizerPlanEstablishingColumns })
      .from(schema.fertilizerPlans)
      .leftJoin(
        schema.fertilizerPlanEstablishing,
        eq(schema.fertilizerPlans.p_id_plan, schema.fertilizerPlanEstablishing.p_id_plan),
      )
      .where(eq(schema.fertilizerPlans.p_id_plan, p_id_plan))
      .limit(1)

    return found[0]
  } catch (e) {
    throw handleError(e, "Exception for getFertilizerPlan", { principal_id, p_id_plan })
  }
}

/**
 * Adds a new saved fertilizer plan to the farm.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id ID of the principal saving the plan.
 * @param b_id_farm ID of the farm the plan is for.
 * @param p_plan_year Year the plan is for.
 * @param p_plan_file_path Path to the file referenced by this fertilizer plan entry.
 * @param p_plan_hash Hash of the data used to generate the fertilizer plan.
 * @param p_plan_date Date on which the fertilizer plan was established. Current date and time by default.
 * @returns ID of the saved fertilizer plan
 */
export async function addFertilizerPlan(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.fertilizerPlanEstablishingTypeInsert["b_id_farm"],
  p_plan_year: schema.fertilizerPlansTypeInsert["p_plan_year"],
  p_plan_file_path: schema.fertilizerPlansTypeInsert["p_plan_file_path"],
  p_plan_hash: schema.fertilizerPlansTypeInsert["p_plan_hash"],
  p_plan_date?: schema.fertilizerPlanEstablishingTypeInsert["p_plan_date"],
): Promise<string> {
  try {
    return await fdm.transaction(async (tx) => {
      await checkPermission(tx, "farm", "write", b_id_farm, principal_id, "addFertilizerPlan")

      const p_id_plan = createId()

      await tx.insert(schema.fertilizerPlans).values({
        p_id_plan: p_id_plan,
        p_plan_year: p_plan_year,
        p_plan_file_path: p_plan_file_path,
        p_plan_hash: p_plan_hash,
      })

      await tx.insert(schema.fertilizerPlanEstablishing).values({
        p_id_plan: p_id_plan,
        b_id_farm: b_id_farm,
        p_plan_date: p_plan_date,
      })

      return p_id_plan
    })
  } catch (e) {
    throw handleError(e, "Exception for addFertilizerPlan", {
      principal_id,
      b_id_farm,
      p_plan_year,
      p_plan_file_path,
      p_plan_hash,
      p_plan_date,
    })
  }
}

export async function updateFertilizerPlanFilePath(
  fdm: FdmType,
  principal_id: PrincipalId,
  p_id_plan: schema.fertilizerPlansTypeSelect["p_id_plan"],
  p_plan_file_path: schema.fertilizerPlansTypeInsert["p_plan_file_path"],
) {
  try {
    return await fdm.transaction(async (tx) => {
      await checkPermission(
        tx,
        "fertilizer_plan",
        "write",
        p_id_plan,
        principal_id,
        "updateFertilizerPlanFilePath",
      )

      await tx
        .update(schema.fertilizerPlans)
        .set({ p_plan_file_path: p_plan_file_path })
        .where(eq(schema.fertilizerPlans.p_id_plan, p_id_plan))
    })
  } catch (e) {
    throw handleError(e, "Exception for updateFertilizerPlanFilePath", {
      principal_id,
      p_id_plan,
      p_plan_file_path,
    })
  }
}

/**
 * Removes the saved fertilizer plan with the given ID.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id ID of the principal deleting the plan.
 * @param p_id_plan ID of the fertilizer plan to delete.
 */
export async function removeFertilizerPlan(
  fdm: FdmType,
  principal_id: PrincipalId,
  p_id_plan: schema.fertilizerPlansTypeSelect["p_id_plan"],
): Promise<void> {
  try {
    await fdm.transaction(async (tx) => {
      await checkPermission(
        tx,
        "fertilizer_plan",
        "write",
        p_id_plan,
        principal_id,
        "removeFertilizerPlan",
      )

      // First delete the farm-fertilizer plan relationship since it has a constraint with the actual plan.
      await tx
        .delete(schema.fertilizerPlanEstablishing)
        .where(eq(schema.fertilizerPlanEstablishing.p_id_plan, p_id_plan))

      await tx.delete(schema.fertilizerPlans).where(eq(schema.fertilizerPlans.p_id_plan, p_id_plan))
    })
  } catch (e) {
    throw handleError(e, "Exception for removeFertilizerPlan", { principal_id, p_id_plan })
  }
}
