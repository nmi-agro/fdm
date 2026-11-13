import type * as core from "@nmi-agro/fdm-core"
import { z } from "@hono/zod-openapi"
import { APPLICATION_METHODS, codeEnum, describeCodes } from "../codes"
import { ApiError } from "../error"
import {
  FarmIdSchema,
  FertilizerAppAmountSchema,
  FertilizerApplicationIdSchema,
  FertilizerIdSchema,
  FieldIdSchema,
} from "../fields"
import { assertFarmSizeSupported, type LimitServices } from "../limits"
import {
  DateStringSchema,
  parseTimeframeQuery,
  serializeDate,
  TimeframeQuerySchema,
} from "../schemas"
import { DELETED, DeletedSchema } from "./common"
import { defineOperation, type OperationContext } from "./types"

/** Defines the fertilizer application data access functions required by the fertilizer application operations. */
export interface FertilizerApplicationServices extends LimitServices {
  /** Lists the fertilizer applications on a field. */
  getFertilizerApplications: typeof core.getFertilizerApplications
  /** Lists the fertilizer applications on all fields of a farm, grouped by field. */
  getFertilizerApplicationsForFarm: typeof core.getFertilizerApplicationsForFarm
  /** Returns a single fertilizer application. */
  getFertilizerApplication: typeof core.getFertilizerApplication
  /** Records a fertilizer application on a field. */
  addFertilizerApplication: typeof core.addFertilizerApplication
  /** Changes an existing fertilizer application. */
  updateFertilizerApplication: typeof core.updateFertilizerApplication
  /** Permanently deletes a fertilizer application. */
  removeFertilizerApplication: typeof core.removeFertilizerApplication
}

/** A fertilizer application on a field. */
export const FertilizerApplicationSchema = z
  .object({
    p_id: FertilizerIdSchema.describe(
      "Unique identifier of the applied fertilizer product on the farm.",
    ),
    p_id_catalogue: z.string().describe("Identifier of the applied fertilizer in its catalogue."),
    p_name_nl: z
      .string()
      .nullable()
      .describe("Dutch name of the applied fertilizer. `null` when unknown."),
    p_app_amount: FertilizerAppAmountSchema.nullable().describe(
      "Applied amount of the product (kg/ha). `null` when unknown.",
    ),
    p_app_amount_unit: z
      .enum(["kg/ha", "l/ha", "m3/ha", "ton/ha"])
      .describe("Unit in which the applied amount is entered and displayed."),
    p_app_amount_display: z
      .number()
      .nullable()
      .describe("Applied amount expressed in `p_app_amount_unit`. `null` when unknown."),
    p_app_method: z
      .string()
      .nullable()
      .describe(describeCodes("Method of application. `null` when unknown.", APPLICATION_METHODS)),
    p_app_date: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    p_app_id: FertilizerApplicationIdSchema,
  })
  .openapi("FertilizerApplication")

const APP_AMOUNT_DISPLAY_DESCRIPTION =
  "Application amount in the display unit (`p_app_amount_unit` of the fertilizer). Must be greater than 0. Converted to kg/ha, the amount may be at most 100,000 kg/ha; a larger amount is rejected with 422."

/** A fertilizer application on a farm, with the field it was applied on. */
export const FarmFertilizerApplicationSchema = FertilizerApplicationSchema.extend({
  b_id: FieldIdSchema.describe("Unique identifier of the field the fertilizer was applied on."),
}).openapi("FarmFertilizerApplication")

/** Request body for creating a fertilizer application. */
export const CreateFertilizerApplicationBodySchema = z
  .object({
    p_id: z.string().describe("Fertilizer identifier."),
    p_app_amount_display: z.number().positive().describe(APP_AMOUNT_DISPLAY_DESCRIPTION),
    p_app_method: codeEnum(APPLICATION_METHODS)
      .nullable()
      .describe(
        describeCodes("Method of application, or `null` when unknown.", APPLICATION_METHODS),
      ),
    p_app_date: DateStringSchema.describe("Date in YYYY-MM-DD format."),
  })
  .openapi("CreateFertilizerApplication")

/** Request body for updating a fertilizer application. Only supplied fields are changed. */
export const UpdateFertilizerApplicationBodySchema = z
  .object({
    p_id: z.string().optional().describe("Fertilizer identifier."),
    p_app_amount_display: z
      .number()
      .positive()
      .nullable()
      .optional()
      .describe(
        `${APP_AMOUNT_DISPLAY_DESCRIPTION} When omitted and the fertilizer is not changed, the stored amount is kept.`,
      ),
    p_app_method: codeEnum(APPLICATION_METHODS)
      .nullable()
      .optional()
      .describe(
        describeCodes("Method of application, or `null` when unknown.", APPLICATION_METHODS),
      ),
    p_app_date: DateStringSchema.optional().describe("Date in YYYY-MM-DD format."),
  })
  .openapi("UpdateFertilizerApplication")

/** Path parameters that identify a field. */
export const FertilizerApplicationFieldParamsSchema = z.object({ b_id: FieldIdSchema })

/** Path parameters that identify a farm. */
export const FertilizerApplicationFarmParamsSchema = z.object({ b_id_farm: FarmIdSchema })

/** Path parameters that identify a fertilizer application. */
export const FertilizerApplicationParamsSchema = z.object({
  p_app_id: FertilizerApplicationIdSchema,
})

function serialiseFertilizerApplication(
  application: core.FertilizerApplication,
): z.infer<typeof FertilizerApplicationSchema> {
  return {
    p_id: application.p_id,
    p_id_catalogue: application.p_id_catalogue,
    p_name_nl: application.p_name_nl ?? null,
    p_app_amount: application.p_app_amount ?? null,
    p_app_amount_unit: application.p_app_amount_unit,
    p_app_amount_display: application.p_app_amount_display ?? null,
    p_app_method: application.p_app_method ?? null,
    p_app_date: serializeDate(application.p_app_date) as string,
    p_app_id: application.p_app_id,
  }
}

/** Lists the fertilizer applications on a field, optionally limited to a period. */
export const listFieldFertilizerApplications = defineOperation({
  name: "listFieldFertilizerApplications",
  kind: "read",
  bucket: "general",
  input: FertilizerApplicationFieldParamsSchema.extend(TimeframeQuerySchema.shape),
  output: z.array(FertilizerApplicationSchema),
  run: async (
    { fdm, services, principal }: OperationContext<FertilizerApplicationServices>,
    { b_id, ...timeframe },
  ) => {
    const applications = await services.getFertilizerApplications(
      fdm,
      principal.effectivePrincipalId,
      b_id,
      parseTimeframeQuery(timeframe),
    )
    return applications.map(serialiseFertilizerApplication)
  },
})

/**
 * Lists the fertilizer applications on all fields of a farm, sorted by application date. Each
 * item has the `b_id` of its field.
 */
export const listFarmFertilizerApplications = defineOperation({
  name: "listFarmFertilizerApplications",
  kind: "read",
  bucket: "general",
  input: FertilizerApplicationFarmParamsSchema.extend(TimeframeQuerySchema.shape),
  output: z.array(FarmFertilizerApplicationSchema),
  run: async (
    { fdm, services, principal }: OperationContext<FertilizerApplicationServices>,
    { b_id_farm, ...timeframe },
  ) => {
    await assertFarmSizeSupported(fdm, services, principal.effectivePrincipalId, b_id_farm)
    const byKey = await services.getFertilizerApplicationsForFarm(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      parseTimeframeQuery(timeframe),
    )
    const items = [...byKey].flatMap(([b_id, applications]) =>
      applications.map((application) => ({ ...application, b_id })),
    )
    items.sort(
      (a, b) =>
        String(serializeDate(a.p_app_date)).localeCompare(String(serializeDate(b.p_app_date))) ||
        a.p_app_id.localeCompare(b.p_app_id),
    )
    return items.map((application) => ({
      ...serialiseFertilizerApplication(application),
      b_id: application.b_id,
    }))
  },
})

/** Records a fertilizer application on a field. */
export const createFertilizerApplication = defineOperation({
  name: "createFertilizerApplication",
  kind: "create",
  bucket: "write",
  input: FertilizerApplicationFieldParamsSchema.extend(CreateFertilizerApplicationBodySchema.shape),
  output: FertilizerApplicationSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FertilizerApplicationServices>,
    { b_id, ...body },
  ) => {
    const p_app_id = await services.addFertilizerApplication(
      fdm,
      principal.effectivePrincipalId,
      b_id,
      body.p_id,
      body.p_app_amount_display,
      body.p_app_method,
      new Date(body.p_app_date),
    )
    const application = await services.getFertilizerApplication(
      fdm,
      principal.effectivePrincipalId,
      p_app_id,
    )
    if (!application?.p_app_id) {
      throw new ApiError(
        500,
        "internal-error",
        "Fertilizer application created but could not be retrieved.",
      )
    }
    return serialiseFertilizerApplication(application)
  },
})

/** Returns a single fertilizer application. */
export const getFertilizerApplication = defineOperation({
  name: "getFertilizerApplication",
  kind: "read",
  bucket: "general",
  input: FertilizerApplicationParamsSchema,
  output: FertilizerApplicationSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FertilizerApplicationServices>,
    { p_app_id },
  ) => {
    const application = await services.getFertilizerApplication(
      fdm,
      principal.effectivePrincipalId,
      p_app_id,
    )
    if (!application?.p_app_id) {
      throw new ApiError(404, "not-found", `Fertilizer application '${p_app_id}' not found.`)
    }
    return serialiseFertilizerApplication(application)
  },
})

/**
 * Changes the supplied fields of a fertilizer application and keeps the others. When the amount
 * is omitted and the fertilizer is not changed, the stored amount is kept.
 */
export const updateFertilizerApplication = defineOperation({
  name: "updateFertilizerApplication",
  kind: "update",
  bucket: "write",
  input: FertilizerApplicationParamsSchema.extend(UpdateFertilizerApplicationBodySchema.shape),
  output: FertilizerApplicationSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FertilizerApplicationServices>,
    { p_app_id, ...body },
  ) => {
    if (Object.values(body).every((value) => value === undefined)) {
      throw new ApiError(400, "validation-failed", "At least one field must be provided.")
    }
    const existing = await services.getFertilizerApplication(
      fdm,
      principal.effectivePrincipalId,
      p_app_id,
    )
    if (!existing?.p_app_id) {
      throw new ApiError(404, "not-found", `Fertilizer application '${p_app_id}' not found.`)
    }
    await services.updateFertilizerApplication(
      fdm,
      principal.effectivePrincipalId,
      p_app_id,
      body.p_id !== undefined ? body.p_id : existing.p_id,
      body.p_app_amount_display !== undefined
        ? body.p_app_amount_display
        : body.p_id === undefined || body.p_id === existing.p_id
          ? // Same fertilizer and no new amount: keep the stored amount in kg/ha
            null
          : existing.p_app_amount_display,
      body.p_app_method !== undefined ? body.p_app_method : existing.p_app_method,
      body.p_app_date !== undefined ? new Date(body.p_app_date) : existing.p_app_date,
    )
    const application = await services.getFertilizerApplication(
      fdm,
      principal.effectivePrincipalId,
      p_app_id,
    )
    if (!application?.p_app_id) {
      throw new ApiError(404, "not-found", `Fertilizer application '${p_app_id}' not found.`)
    }
    return serialiseFertilizerApplication(application)
  },
})

/** Permanently deletes a fertilizer application. */
export const deleteFertilizerApplication = defineOperation({
  name: "deleteFertilizerApplication",
  kind: "delete",
  bucket: "write",
  input: FertilizerApplicationParamsSchema,
  output: DeletedSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FertilizerApplicationServices>,
    { p_app_id },
  ) => {
    await services.removeFertilizerApplication(fdm, principal.effectivePrincipalId, p_app_id)
    return DELETED
  },
})
