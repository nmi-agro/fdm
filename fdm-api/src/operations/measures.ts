import type * as core from "@nmi-agro/fdm-core"
import { z } from "@hono/zod-openapi"
import { ApiError } from "../error"
import { FarmIdSchema, FieldIdSchema, MeasureIdSchema } from "../fields"
import { assertFarmSizeSupported, type LimitServices } from "../limits"
import {
  DateStringSchema,
  parseTimeframeQuery,
  serializeDate,
  TimeframeQuerySchema,
} from "../schemas"
import { DELETED, DeletedSchema } from "./common"
import { defineOperation, type OperationContext } from "./types"

/** Defines the measure data access functions required by the measure operations. */
export interface MeasureServices extends LimitServices {
  /** Lists the measures on a field. */
  getMeasures: typeof core.getMeasures
  /** Lists the measures on all fields of a farm, grouped by field. */
  getMeasuresForFarm: typeof core.getMeasuresForFarm
  /** Returns a single measure. */
  getMeasure: typeof core.getMeasure
  /** Adds a catalogue measure to a field. */
  addMeasure: typeof core.addMeasure
  /** Changes the period of an existing measure. */
  updateMeasure: typeof core.updateMeasure
  /** Permanently deletes a measure. */
  removeMeasure: typeof core.removeMeasure
}

/** A measure applied on a field. */
export const MeasureSchema = z
  .object({
    b_id_measure: MeasureIdSchema,
    m_id: z.string().describe("Identifier of the measure in the measure catalogue."),
    b_id: FieldIdSchema.describe("Unique identifier of the field the measure is applied on."),
    m_start: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    m_end: DateStringSchema.nullable().describe(
      "Last day the measure is applied (inclusive, Europe/Amsterdam), in YYYY-MM-DD format.",
    ),
    m_name: z.string().describe("Name of the measure."),
    m_summary: z
      .string()
      .nullable()
      .describe("Short summary of the measure and its effect. `null` when not available."),
    m_conflicts: z
      .array(z.string())
      .nullable()
      .describe(
        "Catalogue identifiers of measures that cannot be combined with this measure. `null` when none are known.",
      ),
  })
  .openapi("Measure")

/** Request body for adding a measure to a field. */
export const CreateMeasureBodySchema = z
  .object({
    m_id: z.string().describe("Measure catalogue identifier."),
    m_start: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    m_end: DateStringSchema.nullable()
      .optional()
      .describe(
        "Last day the measure is applied (inclusive, Europe/Amsterdam), in YYYY-MM-DD format. A date on 1 January is returned as 31 December of the previous year.",
      ),
  })
  .openapi("CreateMeasure")

/** Request body for updating a measure. Only supplied fields are changed. */
export const UpdateMeasureBodySchema = z
  .object({
    m_start: DateStringSchema.optional().describe("Date in YYYY-MM-DD format."),
    m_end: DateStringSchema.nullable()
      .optional()
      .describe(
        "Last day the measure is applied (inclusive, Europe/Amsterdam), in YYYY-MM-DD format. A date on 1 January is returned as 31 December of the previous year.",
      ),
  })
  .openapi("UpdateMeasure")

/** Path parameters that identify a field. */
export const MeasureFieldParamsSchema = z.object({ b_id: FieldIdSchema })

/** Path parameters that identify a farm. */
export const MeasureFarmParamsSchema = z.object({ b_id_farm: FarmIdSchema })

/** Path parameters that identify a measure. */
export const MeasureParamsSchema = z.object({ b_id_measure: MeasureIdSchema })

function serialiseMeasure(measure: core.Measure): z.infer<typeof MeasureSchema> {
  return {
    b_id_measure: measure.b_id_measure,
    m_id: measure.m_id,
    b_id: measure.b_id,
    m_start: serializeDate(measure.m_start),
    m_end: serializeDate(measure.m_end),
    m_name: measure.m_name,
    m_summary: measure.m_summary ?? null,
    m_conflicts: measure.m_conflicts ?? null,
  }
}

/** Lists the measures on a field, optionally limited to a period. */
export const listFieldMeasures = defineOperation({
  name: "listFieldMeasures",
  kind: "read",
  bucket: "general",
  input: MeasureFieldParamsSchema.extend(TimeframeQuerySchema.shape),
  output: z.array(MeasureSchema),
  run: async (
    { fdm, services, principal }: OperationContext<MeasureServices>,
    { b_id, ...timeframe },
  ) => {
    const measures = await services.getMeasures(
      fdm,
      principal.effectivePrincipalId,
      b_id,
      parseTimeframeQuery(timeframe),
    )
    return measures.map(serialiseMeasure)
  },
})

/** Lists the measures on all fields of a farm, sorted by start date. */
export const listFarmMeasures = defineOperation({
  name: "listFarmMeasures",
  kind: "read",
  bucket: "general",
  input: MeasureFarmParamsSchema.extend(TimeframeQuerySchema.shape),
  output: z.array(MeasureSchema),
  run: async (
    { fdm, services, principal }: OperationContext<MeasureServices>,
    { b_id_farm, ...timeframe },
  ) => {
    await assertFarmSizeSupported(fdm, services, principal.effectivePrincipalId, b_id_farm)
    const byKey = await services.getMeasuresForFarm(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      parseTimeframeQuery(timeframe),
    )
    const items = [...byKey.values()].flat()
    items.sort(
      (a, b) =>
        String(serializeDate(a.m_start) ?? "").localeCompare(
          String(serializeDate(b.m_start) ?? ""),
        ) || a.b_id_measure.localeCompare(b.b_id_measure),
    )
    return items.map(serialiseMeasure)
  },
})

/** Adds a catalogue measure to a field. */
export const createMeasure = defineOperation({
  name: "createMeasure",
  kind: "create",
  bucket: "write",
  input: MeasureFieldParamsSchema.extend(CreateMeasureBodySchema.shape),
  output: MeasureSchema,
  run: async (
    { fdm, services, principal }: OperationContext<MeasureServices>,
    { b_id, ...body },
  ) => {
    const b_id_measure = await services.addMeasure(
      fdm,
      principal.effectivePrincipalId,
      b_id,
      body.m_id,
      new Date(body.m_start),
      body.m_end ? new Date(body.m_end) : undefined,
    )
    const measure = await services.getMeasure(fdm, principal.effectivePrincipalId, b_id_measure)
    if (!measure?.b_id_measure) {
      throw new ApiError(500, "internal-error", "Measure created but could not be retrieved.")
    }
    return serialiseMeasure(measure)
  },
})

/** Returns a single measure. */
export const getMeasure = defineOperation({
  name: "getMeasure",
  kind: "read",
  bucket: "general",
  input: MeasureParamsSchema,
  output: MeasureSchema,
  run: async (
    { fdm, services, principal }: OperationContext<MeasureServices>,
    { b_id_measure },
  ) => {
    const measure = await services.getMeasure(fdm, principal.effectivePrincipalId, b_id_measure)
    if (!measure?.b_id_measure) {
      throw new ApiError(404, "not-found", `Measure '${b_id_measure}' not found.`)
    }
    return serialiseMeasure(measure)
  },
})

/** Changes the start or end date of a measure. Only supplied fields are changed. */
export const updateMeasure = defineOperation({
  name: "updateMeasure",
  kind: "update",
  bucket: "write",
  input: MeasureParamsSchema.extend(UpdateMeasureBodySchema.shape),
  output: MeasureSchema,
  run: async (
    { fdm, services, principal }: OperationContext<MeasureServices>,
    { b_id_measure, ...body },
  ) => {
    if (Object.values(body).every((value) => value === undefined)) {
      throw new ApiError(400, "validation-failed", "At least one field must be provided.")
    }
    await services.updateMeasure(
      fdm,
      principal.effectivePrincipalId,
      b_id_measure,
      body.m_start ? new Date(body.m_start) : undefined,
      body.m_end === undefined ? undefined : body.m_end ? new Date(body.m_end) : null,
    )
    const measure = await services.getMeasure(fdm, principal.effectivePrincipalId, b_id_measure)
    if (!measure?.b_id_measure) {
      throw new ApiError(404, "not-found", `Measure '${b_id_measure}' not found.`)
    }
    return serialiseMeasure(measure)
  },
})

/** Permanently deletes a measure. */
export const deleteMeasure = defineOperation({
  name: "deleteMeasure",
  kind: "delete",
  bucket: "write",
  input: MeasureParamsSchema,
  output: DeletedSchema,
  run: async (
    { fdm, services, principal }: OperationContext<MeasureServices>,
    { b_id_measure },
  ) => {
    await services.removeMeasure(fdm, principal.effectivePrincipalId, b_id_measure)
    return DELETED
  },
})
