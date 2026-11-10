import type * as core from "@nmi-agro/fdm-core"
import { z } from "@hono/zod-openapi"
import { ApiError } from "../error"
import {
  CultivationHcat3NameSchema,
  CultivationHcat3Schema,
  CultivationIdSchema,
  FieldIdSchema,
} from "../fields"
import { DateStringSchema, serializeDate } from "../schemas"
import { DELETED, DeletedSchema } from "./common"
import { FarmParamsSchema } from "./farms"
import { FieldParamsSchema } from "./fields"
import { defineOperation, type OperationContext } from "./types"

/**
 * Defines the cultivation data access functions required by the cultivation operations.
 */
export interface CultivationServices {
  /** Returns all cultivations on a field visible to the authenticated principal. */
  getCultivations: typeof core.getCultivations
  /** Returns all cultivations on a farm visible to the authenticated principal. */
  getCultivationsForFarm: typeof core.getCultivationsForFarm
  /** Returns a single cultivation visible to the authenticated principal. */
  getCultivation: typeof core.getCultivation
  /** Creates a new cultivation on an existing field. */
  addCultivation: typeof core.addCultivation
  /** Updates an existing cultivation. */
  updateCultivation: typeof core.updateCultivation
  /** Permanently deletes a cultivation. */
  removeCultivation: typeof core.removeCultivation
}

/** A cultivation as returned by the API. */
export const CultivationSchema = z
  .object({
    b_lu: CultivationIdSchema,
    b_lu_catalogue: z
      .string()
      .describe(
        "Identifier of the cultivation in its catalogue, prefixed by the catalogue, e.g. 'nl_265'.",
      ),
    b_lu_source: z
      .string()
      .describe("Catalogue the cultivation comes from, e.g. 'brp' for the Dutch crop list."),
    b_lu_name: z.string().describe("Name of the cultivation in the language of its catalogue."),
    b_lu_name_en: z
      .string()
      .nullable()
      .describe("English name of the cultivation. `null` when no translation is available."),
    b_lu_hcat3: CultivationHcat3Schema,
    b_lu_hcat3_name: CultivationHcat3NameSchema,
    b_lu_croprotation: z
      .enum([
        "other",
        "clover",
        "nature",
        "potato",
        "grass",
        "rapeseed",
        "starch",
        "maize",
        "cereal",
        "sugarbeet",
        "alfalfa",
        "catchcrop",
      ])
      .nullable()
      .describe(
        "Crop rotation category of the cultivation, e.g. 'grass', 'maize', 'cereal' or 'potato'. `null` when unknown.",
      ),
    b_lu_eom: z
      .number()
      .nullable()
      .describe(
        "Effective organic matter supplied by the crop: organic matter that remains in the soil one year after input (kg EOM/ha/year). Range 0–7500. `null` when unknown.",
      ),
    b_lu_eom_residue: z
      .number()
      .nullable()
      .describe(
        "Effective organic matter supplied by crop residues such as straw and leaves (kg EOM/ha/year). Range 0–1500. `null` when unknown.",
      ),
    b_lu_harvestcat: z
      .string()
      .nullable()
      .describe(
        "Harvest category that determines which harvest parameters are relevant: 'HC010' standard, 'HC020' grass, 'HC031' maize, 'HC040' root crops, 'HC041' sugar beet, 'HC042' potatoes, 'HC050' cereals. `null` when unknown.",
      ),
    b_lu_harvestable: z
      .enum(["once", "multiple", "none"])
      .describe("How often the cultivation can be harvested: 'none', 'once' or 'multiple'."),
    b_lu_variety: z
      .string()
      .nullable()
      .describe("Variety (cultivar) of the cultivation. `null` when not specified."),
    b_lu_start: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    b_lu_end: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    m_cropresidue: z
      .boolean()
      .nullable()
      .describe(
        "Whether the crop residues are left on the field after harvest. `null` when unknown.",
      ),
    b_id: FieldIdSchema.describe("Unique identifier of the field the cultivation is on."),
  })
  .openapi("Cultivation")

/** Message and path of the check that the end date of a cultivation is not before its start. */
const END_NOT_BEFORE_START = {
  message: "b_lu_end must not be before b_lu_start.",
  path: ["b_lu_end"],
}

/** Accepts a new cultivation when it has no end date or ends on or after its start date. */
function createEndNotBeforeStart(data: { b_lu_start: string; b_lu_end?: string | null }): boolean {
  if (data.b_lu_end == null) return true
  return data.b_lu_end >= data.b_lu_start
}

/** Accepts a cultivation update unless it supplies both dates and the end is before the start. */
function updateEndNotBeforeStart(data: { b_lu_start?: string; b_lu_end?: string | null }): boolean {
  if (data.b_lu_start === undefined || data.b_lu_end == null) return true
  return data.b_lu_end >= data.b_lu_start
}

/** Request body for creating a cultivation. The end date must not be before the start date. */
export const CreateCultivationBodySchema = z
  .object({
    b_lu_catalogue: z.string().describe("Cultivation catalogue identifier."),
    b_lu_start: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    b_lu_end: DateStringSchema.nullable().optional().describe("Date in YYYY-MM-DD format."),
    m_cropresidue: z
      .boolean()
      .nullable()
      .optional()
      .describe("Whether crop residues remain in the field after harvest."),
    b_lu_variety: z.string().nullable().optional().describe("Cultivation variety identifier."),
  })
  .refine(createEndNotBeforeStart, END_NOT_BEFORE_START)
  .openapi("CreateCultivation")

/**
 * Request body for updating a cultivation. Only supplied fields are changed. When both dates are
 * supplied, the end date must not be before the start date.
 */
export const UpdateCultivationBodySchema = z
  .object({
    b_lu_catalogue: z.string().optional().describe("Cultivation catalogue identifier."),
    b_lu_start: DateStringSchema.optional().describe("Date in YYYY-MM-DD format."),
    b_lu_end: DateStringSchema.nullable().optional().describe("Date in YYYY-MM-DD format."),
    m_cropresidue: z
      .boolean()
      .nullable()
      .optional()
      .describe("Whether crop residues remain in the field after harvest."),
    b_lu_variety: z.string().nullable().optional().describe("Cultivation variety identifier."),
  })
  .refine(updateEndNotBeforeStart, END_NOT_BEFORE_START)
  .openapi("UpdateCultivation")

/** Path parameters that identify a cultivation. */
export const CultivationParamsSchema = z.object({ b_lu: CultivationIdSchema })

function serialiseCultivation(cultivation: core.Cultivation): z.infer<typeof CultivationSchema> {
  return {
    b_lu: cultivation.b_lu,
    b_lu_catalogue: cultivation.b_lu_catalogue,
    b_lu_source: cultivation.b_lu_source,
    b_lu_name: cultivation.b_lu_name,
    b_lu_name_en: cultivation.b_lu_name_en ?? null,
    b_lu_hcat3: cultivation.b_lu_hcat3 ?? null,
    b_lu_hcat3_name: cultivation.b_lu_hcat3_name ?? null,
    b_lu_croprotation: cultivation.b_lu_croprotation ?? null,
    b_lu_eom: cultivation.b_lu_eom ?? null,
    b_lu_eom_residue: cultivation.b_lu_eom_residue ?? null,
    b_lu_harvestcat: cultivation.b_lu_harvestcat ?? null,
    b_lu_harvestable: cultivation.b_lu_harvestable,
    b_lu_variety: cultivation.b_lu_variety ?? null,
    // Every cultivation has a start date, so the serialised value is never null.
    b_lu_start: serializeDate(cultivation.b_lu_start) as string,
    b_lu_end: serializeDate(cultivation.b_lu_end),
    m_cropresidue: cultivation.m_cropresidue ?? null,
    b_id: cultivation.b_id,
  }
}

/** Lists all cultivations on a field. */
export const listFieldCultivations = defineOperation({
  name: "listFieldCultivations",
  kind: "read",
  bucket: "general",
  input: FieldParamsSchema,
  output: z.array(CultivationSchema),
  run: async ({ fdm, services, principal }: OperationContext<CultivationServices>, { b_id }) => {
    const cultivations = await services.getCultivations(fdm, principal.effectivePrincipalId, b_id)
    return cultivations.map(serialiseCultivation)
  },
})

/** Lists the cultivations on all fields of a farm, sorted by start date. */
export const listFarmCultivations = defineOperation({
  name: "listFarmCultivations",
  kind: "read",
  bucket: "general",
  input: FarmParamsSchema,
  output: z.array(CultivationSchema),
  run: async (
    { fdm, services, principal }: OperationContext<CultivationServices>,
    { b_id_farm },
  ) => {
    const cultivationsByField = await services.getCultivationsForFarm(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
    )
    const cultivations = Array.from(cultivationsByField.values()).flat()
    cultivations.sort((a, b) => {
      const dateDiff = (a.b_lu_start?.getTime() ?? 0) - (b.b_lu_start?.getTime() ?? 0)
      return dateDiff !== 0 ? dateDiff : a.b_lu.localeCompare(b.b_lu)
    })
    return cultivations.map(serialiseCultivation)
  },
})

/**
 * Creates a cultivation on a field. Fails with `validation-failed` when the cultivation code is
 * not available for the period of the cultivation.
 */
export const createCultivation = defineOperation({
  name: "createCultivation",
  kind: "create",
  bucket: "write",
  input: FieldParamsSchema.extend(CreateCultivationBodySchema.shape).refine(
    createEndNotBeforeStart,
    END_NOT_BEFORE_START,
  ),
  output: CultivationSchema,
  run: async (
    { fdm, services, principal }: OperationContext<CultivationServices>,
    { b_id, ...body },
  ) => {
    let b_lu: string
    try {
      b_lu = await services.addCultivation(
        fdm,
        principal.effectivePrincipalId,
        body.b_lu_catalogue,
        b_id,
        new Date(body.b_lu_start),
        body.b_lu_end ? new Date(body.b_lu_end) : undefined,
        body.m_cropresidue ?? undefined,
        body.b_lu_variety ?? undefined,
      )
    } catch (e) {
      if (
        e instanceof Error &&
        e.cause instanceof Error &&
        e.cause.message === "Cultivation code is not available for this time period"
      ) {
        throw new ApiError(
          400,
          "validation-failed",
          `Cultivation ${body.b_lu_catalogue} is not available for this time period.`,
          {
            errors: [
              {
                code: "custom",
                path: ["b_lu_end"],
                message: `Cultivation ${body.b_lu_catalogue} is not available for this time period.`,
              },
            ],
          },
        )
      }
      throw e
    }
    const cultivation = await services.getCultivation(fdm, principal.effectivePrincipalId, b_lu)
    if (!cultivation?.b_lu) {
      throw new ApiError(500, "internal-error", "Cultivation created but could not be retrieved.")
    }
    return serialiseCultivation(cultivation)
  },
})

/** Returns a single cultivation. */
export const getCultivation = defineOperation({
  name: "getCultivation",
  kind: "read",
  bucket: "general",
  input: CultivationParamsSchema,
  output: CultivationSchema,
  run: async ({ fdm, services, principal }: OperationContext<CultivationServices>, { b_lu }) => {
    const cultivation = await services.getCultivation(fdm, principal.effectivePrincipalId, b_lu)
    if (!cultivation?.b_lu) {
      throw new ApiError(404, "not-found", `Cultivation '${b_lu}' not found.`)
    }
    return serialiseCultivation(cultivation)
  },
})

/**
 * Changes the supplied properties of a cultivation and keeps the others. The resulting end date
 * must not be before the resulting start date, also when only one of them is supplied.
 */
export const updateCultivation = defineOperation({
  name: "updateCultivation",
  kind: "update",
  bucket: "write",
  input: CultivationParamsSchema.extend(UpdateCultivationBodySchema.shape).refine(
    updateEndNotBeforeStart,
    END_NOT_BEFORE_START,
  ),
  output: CultivationSchema,
  run: async (
    { fdm, services, principal }: OperationContext<CultivationServices>,
    { b_lu, ...body },
  ) => {
    if (Object.values(body).every((value) => value === undefined)) {
      throw new ApiError(400, "validation-failed", "At least one field must be provided.")
    }

    // Validate that b_lu_end is not before b_lu_start.
    // If both are in the body, compare inline; if only b_lu_end is provided,
    // fetch the persisted start date and compare against it.
    // Symmetrically, if only b_lu_start is provided (and b_lu_end is not being
    // changed), fetch the persisted end date and ensure the new start is not after it.
    if (body.b_lu_end != null) {
      const newEnd = new Date(body.b_lu_end)
      let startDate: Date | null | undefined
      if (body.b_lu_start) {
        startDate = new Date(body.b_lu_start)
      } else {
        const existing = await services.getCultivation(fdm, principal.effectivePrincipalId, b_lu)
        startDate = existing?.b_lu_start ?? null
      }
      if (startDate && newEnd < startDate) {
        throw new ApiError(400, "validation-failed", "b_lu_end must not be before b_lu_start.")
      }
    } else if (body.b_lu_start && body.b_lu_end === undefined) {
      // Only b_lu_start is changing; check the new start against the persisted end.
      const newStart = new Date(body.b_lu_start)
      const existing = await services.getCultivation(fdm, principal.effectivePrincipalId, b_lu)
      const persistedEnd = existing?.b_lu_end ?? null
      if (persistedEnd && newStart > new Date(persistedEnd)) {
        throw new ApiError(400, "validation-failed", "b_lu_start must not be after b_lu_end.")
      }
    }

    try {
      await services.updateCultivation(
        fdm,
        principal.effectivePrincipalId,
        b_lu,
        body.b_lu_catalogue,
        body.b_lu_start ? new Date(body.b_lu_start) : undefined,
        body.b_lu_end === undefined ? undefined : body.b_lu_end ? new Date(body.b_lu_end) : null,
        body.m_cropresidue,
        body.b_lu_variety,
      )
    } catch (e) {
      if (
        e instanceof Error &&
        e.cause instanceof Error &&
        e.cause.message === "Cultivation code is not available for this time period"
      ) {
        const firstPart =
          typeof body.b_lu_catalogue === "string"
            ? `Cultivation ${body.b_lu_catalogue}`
            : "Cultivation's current cultivation code"
        const secondPart =
          body.b_lu_start !== undefined || body.b_lu_end !== undefined
            ? "the updated time period"
            : "the cultivation's current time period"
        const errorMessage = `${firstPart} is not available for ${secondPart}.`
        throw new ApiError(400, "validation-failed", errorMessage, {
          errors: [
            {
              code: "custom",
              path: ["b_lu_end"],
              message: errorMessage,
            },
          ],
        })
      }
      throw e
    }
    const cultivation = await services.getCultivation(fdm, principal.effectivePrincipalId, b_lu)
    if (!cultivation?.b_lu) {
      throw new ApiError(404, "not-found", `Cultivation '${b_lu}' not found.`)
    }
    return serialiseCultivation(cultivation)
  },
})

/** Permanently deletes a cultivation. */
export const deleteCultivation = defineOperation({
  name: "deleteCultivation",
  kind: "delete",
  bucket: "write",
  input: CultivationParamsSchema,
  output: DeletedSchema,
  run: async ({ fdm, services, principal }: OperationContext<CultivationServices>, { b_lu }) => {
    await services.removeCultivation(fdm, principal.effectivePrincipalId, b_lu)
    return DELETED
  },
})
