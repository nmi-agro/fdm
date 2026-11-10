import type * as core from "@nmi-agro/fdm-core"
import { z } from "@hono/zod-openapi"
import { ApiError } from "../error"
import { FarmIdSchema, FieldIdSchema } from "../fields"
import { assertGeoJsonCoordinates } from "../guards"
import { assertFarmSizeSupported, assertFieldCapacity, type LimitServices } from "../limits"
import { DateStringSchema, GeoJsonGeometrySchema, serializeDate } from "../schemas"
import { DELETED, DeletedSchema } from "./common"
import { FarmParamsSchema } from "./farms"
import { defineOperation, type OperationContext } from "./types"

/**
 * Defines the field data access functions required by the field operations.
 */
export interface FieldServices extends LimitServices {
  /** Returns all fields for a farm that are visible to the authenticated principal. */
  getFields: typeof core.getFields
  /** Returns a single field visible to the authenticated principal. */
  getField: typeof core.getField
  /** Creates a new field on an existing farm. */
  addField: typeof core.addField
  /** Updates an existing field. */
  updateField: typeof core.updateField
  /** Permanently deletes a field and its associated cultivations and soil analyses. */
  removeField: typeof core.removeField
}

/** A field as returned by the API. */
export const FieldSchema = z
  .object({
    b_id: FieldIdSchema,
    b_name: z.string().describe("Field display name."),
    b_id_farm: FarmIdSchema.describe("Unique identifier of the farm that manages the field."),
    b_id_source: z
      .string()
      .nullable()
      .describe(
        "Identifier of the field in an external source, such as a government registry. `null` when not set.",
      ),
    b_geometry: GeoJsonGeometrySchema.nullable().describe(
      "Field boundary as GeoJSON Polygon or MultiPolygon in WGS84 (EPSG:4326). `null` when unknown.",
    ),
    b_centroid: z
      .tuple([z.number(), z.number()])
      .describe("Centroid of the field as [longitude, latitude] in WGS84 (EPSG:4326)."),
    b_area: z
      .number()
      .nullable()
      .describe("Area of the field (ha), rounded to 2 decimals. `null` without a geometry."),
    b_perimeter: z
      .number()
      .nullable()
      .describe(
        "Length of the outer boundary of the field (m), rounded to 2 decimals. `null` without a geometry.",
      ),
    b_bufferstrip: z
      .boolean()
      .describe(
        "Whether the field is a buffer strip. Buffer strips are excluded from most nutrient calculations.",
      ),
    b_start: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    b_end: DateStringSchema.nullable().describe(
      "Last day the field is managed (inclusive, Europe/Amsterdam), in YYYY-MM-DD format.",
    ),
    b_acquiring_method: z
      .string()
      .describe(
        "How the farm acquired the right to use the field. Dutch codes 'nl_01' to 'nl_09' follow the RVO registration (e.g. 'nl_01' ownership, 'nl_02' regular lease); 'unknown' when not specified.",
      ),
  })
  .openapi("Field")

/** Request body for creating a field. */
export const CreateFieldBodySchema = z
  .object({
    b_name: z.string().describe("Field display name."),
    b_id_source: z.string().nullable().optional().describe("External source identifier."),
    b_geometry: GeoJsonGeometrySchema.describe(
      "Field boundary as GeoJSON Polygon or MultiPolygon. Maximum 10,000 coordinates.",
    ),
    b_start: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    b_acquiring_method: z.string().describe("Method by which the field was acquired."),
    b_end: DateStringSchema.nullable()
      .optional()
      .describe(
        "Last day the field is managed (inclusive, Europe/Amsterdam), in YYYY-MM-DD format. A date on 1 January is returned as 31 December of the previous year.",
      ),
    b_bufferstrip: z.boolean().optional().describe("Whether the field is a buffer strip."),
  })
  .openapi("CreateField")

/** Request body for updating a field. Only supplied fields are changed. */
export const UpdateFieldBodySchema = z
  .object({
    b_name: z.string().optional().describe("Field display name."),
    b_id_source: z.string().nullable().optional().describe("External source identifier."),
    b_geometry: GeoJsonGeometrySchema.nullable()
      .optional()
      .describe("Field boundary as GeoJSON Polygon or MultiPolygon."),
    b_start: DateStringSchema.optional().describe("Date in YYYY-MM-DD format."),
    b_acquiring_method: z.string().optional().describe("Method by which the field was acquired."),
    b_end: DateStringSchema.nullable()
      .optional()
      .describe(
        "Last day the field is managed (inclusive, Europe/Amsterdam), in YYYY-MM-DD format. A date on 1 January is returned as 31 December of the previous year.",
      ),
    b_bufferstrip: z.boolean().optional().describe("Whether the field is a buffer strip."),
  })
  .openapi("UpdateField")

/** Path parameters that identify a field. */
export const FieldParamsSchema = z.object({ b_id: FieldIdSchema })

function serialiseField(
  field: Awaited<ReturnType<typeof core.getField>>,
): z.infer<typeof FieldSchema> {
  return {
    b_id: field.b_id,
    b_name: field.b_name,
    b_id_farm: field.b_id_farm,
    b_id_source: field.b_id_source ?? null,
    b_geometry: field.b_geometry as unknown as z.infer<typeof GeoJsonGeometrySchema> | null,
    b_centroid: field.b_centroid,
    b_area: field.b_area ?? null,
    b_perimeter: field.b_perimeter ?? null,
    b_bufferstrip: field.b_bufferstrip,
    b_start: serializeDate(field.b_start),
    b_end: serializeDate(field.b_end),
    b_acquiring_method: field.b_acquiring_method,
  }
}

/** Lists all fields on a farm. */
export const listFields = defineOperation({
  name: "listFields",
  kind: "read",
  bucket: "general",
  input: FarmParamsSchema,
  output: z.array(FieldSchema),
  run: async ({ fdm, services, principal }: OperationContext<FieldServices>, { b_id_farm }) => {
    await assertFarmSizeSupported(fdm, services, principal.effectivePrincipalId, b_id_farm)
    const fields = await services.getFields(fdm, principal.effectivePrincipalId, b_id_farm)
    return fields.map(serialiseField)
  },
})

/** Returns a single field. */
export const getField = defineOperation({
  name: "getField",
  kind: "read",
  bucket: "general",
  input: FieldParamsSchema,
  output: FieldSchema,
  run: async ({ fdm, services, principal }: OperationContext<FieldServices>, { b_id }) => {
    const field = await services.getField(fdm, principal.effectivePrincipalId, b_id)
    if (!field?.b_id) {
      throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
    }
    return serialiseField(field)
  },
})

/**
 * Creates a field on a farm. The geometry must be a GeoJSON Polygon or MultiPolygon with at
 * most 10,000 coordinates.
 */
export const createField = defineOperation({
  name: "createField",
  kind: "create",
  bucket: "write",
  input: FarmParamsSchema.extend(CreateFieldBodySchema.shape),
  output: FieldSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FieldServices>,
    { b_id_farm, ...body },
  ) => {
    await assertFieldCapacity(fdm, services, principal.effectivePrincipalId, b_id_farm, 1)
    assertGeoJsonCoordinates(body.b_geometry)
    const b_id = await services.addField(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      body.b_name,
      body.b_id_source ?? null,
      body.b_geometry as unknown as Parameters<typeof core.addField>[5],
      new Date(body.b_start),
      body.b_acquiring_method,
      body.b_end ? new Date(body.b_end) : undefined,
      body.b_bufferstrip,
    )
    const field = await services.getField(fdm, principal.effectivePrincipalId, b_id)
    if (!field?.b_id) {
      throw new ApiError(500, "internal-error", "Field created but could not be retrieved.")
    }
    return serialiseField(field)
  },
})

/** Changes the supplied properties of a field and keeps the others. */
export const updateField = defineOperation({
  name: "updateField",
  kind: "update",
  bucket: "write",
  input: FieldParamsSchema.extend(UpdateFieldBodySchema.shape),
  output: FieldSchema,
  run: async ({ fdm, services, principal }: OperationContext<FieldServices>, { b_id, ...body }) => {
    if (Object.values(body).every((value) => value === undefined)) {
      throw new ApiError(400, "validation-failed", "At least one field must be provided.")
    }
    const existing = await services.getField(fdm, principal.effectivePrincipalId, b_id)
    if (!existing?.b_id) {
      throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
    }
    if (body.b_geometry !== undefined && body.b_geometry !== null) {
      assertGeoJsonCoordinates(body.b_geometry)
    }
    const updated = await services.updateField(
      fdm,
      principal.effectivePrincipalId,
      b_id,
      body.b_name !== undefined ? body.b_name : existing.b_name,
      body.b_id_source !== undefined ? body.b_id_source : existing.b_id_source,
      body.b_geometry !== undefined
        ? (body.b_geometry as unknown as Parameters<typeof core.updateField>[5])
        : existing.b_geometry,
      body.b_start !== undefined ? new Date(body.b_start) : (existing.b_start ?? undefined),
      body.b_acquiring_method !== undefined ? body.b_acquiring_method : existing.b_acquiring_method,
      // Omit b_end when not provided, so the stored end date is left untouched
      body.b_end !== undefined ? (body.b_end !== null ? new Date(body.b_end) : null) : undefined,
      body.b_bufferstrip !== undefined ? body.b_bufferstrip : existing.b_bufferstrip,
    )
    if (!updated?.b_id) {
      throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
    }
    return serialiseField(updated)
  },
})

/** Permanently deletes a field with its cultivations and soil analyses. */
export const deleteField = defineOperation({
  name: "deleteField",
  kind: "delete",
  bucket: "write",
  input: FieldParamsSchema,
  output: DeletedSchema,
  run: async ({ fdm, services, principal }: OperationContext<FieldServices>, { b_id }) => {
    await services.removeField(fdm, principal.effectivePrincipalId, b_id)
    return DELETED
  },
})
