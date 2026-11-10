import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { addSoilParameterEstimatesToField } from "@nmi-agro/fdm-calculator"
import type { FdmType, Field, getCultivationsFromCatalogue } from "@nmi-agro/fdm-core"
import type {
  applyRvoImport,
  ImportChoice,
  ImportReviewAction,
  reviewShapefileImport,
  RvoImportReviewItem,
} from "@nmi-agro/fdm-rvo"
import { createRoute, z } from "@hono/zod-openapi"
import {
  forEachAddedField,
  getAllowedImportActions,
  getImportItemValues,
  getItemId,
  ImportChoiceError,
  resolveImportChoices,
  ShapefileReadError,
} from "@nmi-agro/fdm-rvo"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError } from "../error"
import { FarmIdSchema, FieldIdSchema } from "../fields"
import { rateLimitMiddleware } from "../rate-limit"
import {
  DateStringSchema,
  GeoJsonGeometrySchema,
  problemResponseDefinition,
  serializeDate,
  uploadErrorResponses,
} from "../schemas"

/** Defines the functions required by the field import routes. */
export interface FieldImportServices {
  reviewShapefileImport: typeof reviewShapefileImport
  applyRvoImport: typeof applyRvoImport
  getCultivationsFromCatalogue: typeof getCultivationsFromCatalogue
  addSoilParameterEstimatesToField: typeof addSoilParameterEstimatesToField
  getNmiApiKey: () => string | undefined
}

const ACTIONS = [
  "ADD_REMOTE",
  "UPDATE_FROM_REMOTE",
  "KEEP_LOCAL",
  "REMOVE_LOCAL",
  "CLOSE_LOCAL",
  "IGNORE",
] as const satisfies readonly ImportReviewAction[]

const ACQUIRING_METHODS = [
  "nl_01",
  "nl_02",
  "nl_03",
  "nl_04",
  "nl_07",
  "nl_09",
  "nl_10",
  "nl_11",
  "nl_12",
  "nl_13",
  "nl_61",
  "nl_63",
  "unknown",
] as const

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ActionSchema = z
  .enum(ACTIONS)
  .describe(
    "What to do with the item: `ADD_REMOTE` (add the field from the shapefile), `UPDATE_FROM_REMOTE` (update the field with the shapefile values that differ), `KEEP_LOCAL` (keep the field; with `values`, only those values change), `REMOVE_LOCAL` (remove the field), `CLOSE_LOCAL` (end the field on 31 December of the previous year) or `IGNORE` (do not add the new field). Each status has one action that changes nothing: `KEEP_LOCAL` for items with a local field, `IGNORE` for new fields from the shapefile.",
  )

const fileField = (description: string) =>
  z
    .custom<File>((value) => value instanceof File, { message: "Must be a file." })
    .openapi({ type: "string", format: "binary" })
    .describe(description)

const ShapefileBodyShape = {
  shp: fileField("The `.shp` file of the RVO Mijn Percelen export (field geometries)."),
  shx: fileField("The `.shx` file of the export (index of the geometries)."),
  dbf: fileField("The `.dbf` file of the export (field properties)."),
  prj: fileField("The `.prj` file of the export (coordinate system)."),
  year: z
    .string()
    .regex(/^\d{4}$/, "year must be a four-digit calendar year.")
    .describe(
      "Calendar year of the import (four digits). New fields get the main cultivation of this year, and fields missing from the export that started before this year can be closed.",
    ),
}

// The multipart bodies are inline schemas with an `encoding`, so documentation tools show the
// text fields as text and the shapefile parts as files.
const CompareBodySchema = z.object(ShapefileBodyShape)

const ChoiceValuesSchema = z
  .object({
    b_name: z.string().trim().min(1).optional().describe("Name of the field."),
    b_geometry: z
      .enum(["local", "remote"])
      .optional()
      .describe(
        "Which geometry to keep: `local` (the current one) or `remote` (the one from the shapefile). A geometry cannot be sent in.",
      ),
    b_lu_catalogue: z
      .string()
      .nullable()
      .optional()
      .describe(
        "Cultivation catalogue code of the main cultivation. `null` removes the main cultivation (or adds none to a new field).",
      ),
    b_start: DateStringSchema.optional().describe("Start date of the field, in YYYY-MM-DD format."),
    b_end: DateStringSchema.nullable()
      .optional()
      .describe("End date of the field, in YYYY-MM-DD format. `null` keeps the field in use."),
    b_acquiring_method: z
      .enum(ACQUIRING_METHODS)
      .optional()
      .describe("Acquiring method of the field, for example `nl_01` (ownership)."),
    b_bufferstrip: z.boolean().optional().describe("Whether the field is a buffer strip."),
  })
  .describe(
    "Values that override the values of the action, the same choices as in the review screen of the web app.",
  )

const ChoiceSchema = z.object({
  action: ActionSchema,
  values: ChoiceValuesSchema.optional(),
})

const ChoicesSchema = z
  .record(z.string(), ChoiceSchema)
  .describe("Choice per `item_id`. Items without a choice get `default_action`.")

const ApplyBodySchema = z.object({
  ...ShapefileBodyShape,
  choices: z
    .string()
    .optional()
    .describe(
      'JSON object with a choice per `item_id`, for example `{"rvo-123": {"action": "ADD_REMOTE", "values": {"b_name": "Achter de schuur"}}}`. See FieldImportChoice for the shape of a choice.',
    ),
  default_action: z
    .enum(["ADD_REMOTE", "UPDATE_FROM_REMOTE", "IGNORE"])
    .optional()
    .describe(
      "Action for items without a choice, where it is allowed for their status: `ADD_REMOTE` adds all new fields, `UPDATE_FROM_REMOTE` adds new fields and updates changed ones. `IGNORE`, the default, leaves items without a choice unchanged.",
    ),
  review_hash: z
    .string()
    .optional()
    .describe(
      "`review_hash` from the compare step. When it is given and the farm has changed since, nothing is saved and the response is 409 with the new review.",
    ),
})

const shapefileEncoding = {
  shp: { contentType: "application/octet-stream" },
  shx: { contentType: "application/octet-stream" },
  dbf: { contentType: "application/octet-stream" },
  prj: { contentType: "text/plain" },
}

const FieldValuesSchema = z.object({
  b_name: z.string().nullable().describe("Name of the field."),
  b_area: z.number().nullable().describe("Area of the field (ha)."),
  b_start: DateStringSchema.nullable().describe("Start date of the field, in YYYY-MM-DD format."),
  b_end: DateStringSchema.nullable().describe(
    "End date of the field, in YYYY-MM-DD format. `null` when the field stays in use.",
  ),
  b_acquiring_method: z.string().nullable().describe("Acquiring method, for example `nl_01`."),
  b_bufferstrip: z
    .boolean()
    .nullable()
    .describe("Whether the field is a buffer strip. For the shapefile, an estimate."),
  b_lu_catalogue: z
    .string()
    .nullable()
    .describe("Cultivation catalogue code of the main cultivation. `null` when there is none."),
})

const ReviewItemSchema = z
  .object({
    item_id: z
      .string()
      .describe(
        "Stable identifier of the item: the `b_id` of the local field, or the RVO `CropFieldID` for a field only in the shapefile.",
      ),
    status: z
      .enum(["MATCH", "NEW_REMOTE", "NEW_LOCAL", "CONFLICT", "EXPIRED_LOCAL"])
      .describe(
        "`MATCH` (same in both), `NEW_REMOTE` (only in the shapefile), `NEW_LOCAL` (only in FDM), `CONFLICT` (in both, with differences) or `EXPIRED_LOCAL` (in FDM, started before the year and missing from the shapefile).",
      ),
    diffs: z
      .array(z.string())
      .describe("Values that differ, for example `b_name`, `b_geometry` or `b_lu_catalogue`."),
    allowed_actions: z.array(ActionSchema).describe("Actions that can be chosen for this item."),
    local_field: FieldValuesSchema.extend({ b_id: FieldIdSchema })
      .nullable()
      .describe("The field in FDM. `null` for a field only in the shapefile."),
    remote_field: FieldValuesSchema.extend({
      b_id_source: z.string().describe("RVO `CropFieldID` of the field."),
      b_geometry: GeoJsonGeometrySchema.describe("Geometry of the field in the shapefile (WGS84)."),
    })
      .nullable()
      .describe("The field in the shapefile. `null` for a field only in FDM."),
  })
  .openapi("FieldImportItem")

const ReviewSchema = z
  .object({
    b_id_farm: FarmIdSchema.describe("Unique identifier of the farm."),
    year: z.number().int().describe("Calendar year of the import."),
    review_hash: z
      .string()
      .describe("Hash of the items. Send it with the apply step to detect changes in between."),
    items: z.array(ReviewItemSchema).describe("One item per field in the shapefile or the farm."),
  })
  .openapi("FieldImportReview")

const ApplyResultSchema = z
  .object({
    created: z.array(FieldIdSchema).describe("IDs of the fields that were added."),
    updated: z.array(FieldIdSchema).describe("IDs of the fields that were updated."),
    closed: z.array(FieldIdSchema).describe("IDs of the updated fields that received an end date."),
    removed: z.array(FieldIdSchema).describe("IDs of the fields that were removed."),
  })
  .openapi("FieldImportResult")

// Documents the shape of one choice in the `choices` JSON.
const FieldImportChoiceSchema = ChoiceSchema.openapi("FieldImportChoice")

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const compareRoute = createRoute({
  operationId: "compareFieldImport",
  method: "post",
  path: "/farms/{b_id_farm}/fields/import/compare",
  tags: ["Field Import"],
  summary: "Compare a shapefile with the fields of a farm",
  description:
    "Step 1 of a field import. Reads an RVO Mijn Percelen shapefile export and compares it with the fields and cultivations of the farm for the year. Nothing is saved. Returns one item per field with its status, the differences and the actions that can be chosen. A shapefile has no buffer strip information, so it is estimated from the shape and name of each field. Returns 422 with `suggested_year` when the shapefile contains fields that start after `year`.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: z.object({ b_id_farm: FarmIdSchema }),
    body: {
      content: {
        "multipart/form-data": { schema: CompareBodySchema, encoding: shapefileEncoding },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "The review of the import.",
      content: { "application/json": { schema: ReviewSchema } },
    },
    ...uploadErrorResponses,
  },
})

const applyRoute = createRoute({
  operationId: "applyFieldImport",
  method: "post",
  path: "/farms/{b_id_farm}/fields/import/apply",
  tags: ["Field Import"],
  summary: "Apply a shapefile import",
  description:
    "Step 2 of a field import. Send the same shapefile again with a choice per item. The server compares again and applies all choices in one transaction; new fields get estimated soil parameters afterwards. When `review_hash` is given and the farm changed since the compare step, or when a choice refers to an item that no longer exists, nothing is saved and the response is 409 with the new review. An action that does not fit the status of an item, or an invalid value, returns 422 with the `item_ids` involved.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: z.object({ b_id_farm: FarmIdSchema }),
    body: {
      content: {
        "multipart/form-data": {
          schema: ApplyBodySchema,
          encoding: { ...shapefileEncoding, choices: { contentType: "application/json" } },
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "The fields that were added, updated, closed and removed.",
      content: { "application/json": { schema: ApplyResultSchema } },
    },
    409: problemResponseDefinition(
      "Conflict — the farm changed since the compare step. The problem document has the new review in `review`.",
    ),
    ...uploadErrorResponses,
  },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serialiseItem(item: RvoImportReviewItem<Field>, year: number) {
  const { localValues, remoteValues } = getImportItemValues(item, year)
  const values = (v: Record<string, unknown>) => ({
    b_name: (v.b_name as string | undefined) ?? null,
    b_area: (v.b_area as number | null | undefined) ?? null,
    b_start: serializeDate((v.b_start as Date | undefined) ?? null),
    b_end: serializeDate((v.b_end as Date | null | undefined) ?? null),
    b_acquiring_method: (v.b_acquiring_method as string | undefined) ?? null,
    b_bufferstrip: (v.b_bufferstrip as boolean | undefined) ?? null,
    b_lu_catalogue: (v.b_lu_catalogue as string | null | undefined) ?? null,
  })
  return {
    item_id: getItemId(item),
    status: item.status,
    diffs: item.diffs,
    allowed_actions: getAllowedImportActions(item.status),
    local_field:
      item.localField && localValues
        ? { b_id: item.localField.b_id, ...values(localValues) }
        : null,
    remote_field:
      item.rvoField && remoteValues
        ? {
            b_id_source: item.rvoField.properties.CropFieldID,
            ...values(remoteValues),
            b_geometry: item.rvoField.geometry,
          }
        : null,
  }
}

function toChoice(choice: z.infer<typeof ChoiceSchema>): ImportChoice {
  const values = choice.values
  return {
    action: choice.action,
    values: values && {
      ...values,
      b_start: values.b_start ? new Date(values.b_start) : undefined,
      b_end:
        values.b_end === undefined
          ? undefined
          : values.b_end === null
            ? null
            : new Date(values.b_end),
    },
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Registers the routes to import fields from an RVO Mijn Percelen shapefile export.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by the route handlers.
 * @param services - Field import service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerFieldImportRoutes(app, fdm, services)
 * ```
 */
export function registerFieldImportRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: FieldImportServices,
): void {
  // Compare is covered by the /farms/* middleware in farms.ts; apply requests soil estimates
  // from the NMI API and counts in the "nmi" bucket.
  app.use("/farms/:b_id_farm/fields/import/apply", (c, next) =>
    rateLimitMiddleware(fdm, "nmi")(c, next),
  )

  async function review(
    principal_id: string,
    b_id_farm: string,
    form: z.infer<typeof CompareBodySchema>,
  ) {
    const year = Number.parseInt(form.year, 10)
    let result: Awaited<ReturnType<typeof reviewShapefileImport>>
    try {
      result = await services.reviewShapefileImport(
        fdm,
        principal_id,
        b_id_farm,
        { shp: form.shp, shx: form.shx, dbf: form.dbf, prj: form.prj },
        year,
      )
    } catch (err) {
      if (err instanceof ShapefileReadError) {
        throw new ApiError(
          422,
          "unprocessable-entity",
          "The shapefile could not be read. Upload the .shp, .shx, .dbf and .prj files of an RVO Mijn Percelen export.",
        )
      }
      throw err
    }
    if (!result.valid) {
      throw new ApiError(
        422,
        "unprocessable-entity",
        `The shapefile contains fields that start in ${result.suggestedYear}, after ${year}. Check the year or the file.`,
        { suggested_year: result.suggestedYear },
      )
    }
    return {
      year,
      review_hash: result.review_hash,
      items: result.items,
      body: {
        b_id_farm,
        year,
        review_hash: result.review_hash,
        items: result.items.map((item) => serialiseItem(item, year)),
      },
    }
  }

  const compareHandler: RouteHandler<typeof compareRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const form = c.req.valid("form") as z.infer<typeof CompareBodySchema>
    const { body } = await review(principal.effectivePrincipalId, b_id_farm, form)
    return c.json(body as z.infer<typeof ReviewSchema>, 200)
  }

  const applyHandler: RouteHandler<typeof applyRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const form = c.req.valid("form") as z.infer<typeof ApplyBodySchema>

    let rawChoices: unknown = {}
    if (form.choices) {
      try {
        rawChoices = JSON.parse(form.choices)
      } catch {
        throw new ApiError(400, "validation-failed", "choices must be a JSON object.")
      }
    }
    const parsedChoices = ChoicesSchema.safeParse(rawChoices)
    if (!parsedChoices.success) {
      throw new ApiError(400, "validation-failed", "choices is not valid.", {
        errors: parsedChoices.error.issues,
      })
    }

    const current = await review(principal.effectivePrincipalId, b_id_farm, form)
    const itemIds = new Set(current.items.map((item) => getItemId(item)))
    const unknownIds = Object.keys(parsedChoices.data).filter((id) => !itemIds.has(id))
    if ((form.review_hash && form.review_hash !== current.review_hash) || unknownIds.length > 0) {
      throw new ApiError(
        409,
        "conflict",
        "The fields of the farm changed since the compare step. Review the new items and choose again.",
        { review: current.body, item_ids: unknownIds },
      )
    }

    const choices: Record<string, ImportChoice> = {}
    for (const item of current.items) {
      const item_id = getItemId(item)
      const explicit = parsedChoices.data[item_id]
      if (explicit) {
        choices[item_id] = toChoice(explicit)
      } else if (
        form.default_action &&
        getAllowedImportActions(item.status).includes(form.default_action)
      ) {
        choices[item_id] = { action: form.default_action }
      } else if (form.default_action === "UPDATE_FROM_REMOTE" && item.status === "NEW_REMOTE") {
        choices[item_id] = { action: "ADD_REMOTE" }
      }
    }

    // A cultivation chosen by the client must be in the catalogues of the farm.
    const chosenCrops = Object.entries(choices).filter(
      ([, choice]) => typeof choice.values?.b_lu_catalogue === "string",
    )
    if (chosenCrops.length > 0) {
      const catalogue = await services.getCultivationsFromCatalogue(
        fdm,
        principal.effectivePrincipalId,
        b_id_farm,
      )
      const known = new Set(catalogue.map((item) => item.b_lu_catalogue))
      const unknown = chosenCrops.filter(
        ([, choice]) => !known.has(choice.values?.b_lu_catalogue as string),
      )
      if (unknown.length > 0) {
        throw new ApiError(
          422,
          "unprocessable-entity",
          "Some choices have a cultivation that is not in the catalogues of the farm.",
          { item_ids: unknown.map(([item_id]) => item_id) },
        )
      }
    }

    let plan: ReturnType<typeof resolveImportChoices>
    try {
      plan = resolveImportChoices(current.items, choices, current.year)
    } catch (err) {
      if (err instanceof ImportChoiceError) {
        throw new ApiError(422, "unprocessable-entity", "Some choices are not valid.", {
          item_ids: [...new Set(err.issues.map((issue) => issue.item_id))],
          issues: err.issues,
        })
      }
      throw err
    }

    const result = await services.applyRvoImport(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      plan,
      current.year,
    )

    // Soil estimates are added after the import; a failure keeps the field without them.
    const nmiApiKey = services.getNmiApiKey()
    if (nmiApiKey) {
      await forEachAddedField(
        result.created,
        async (b_id, geometry) => {
          await services.addSoilParameterEstimatesToField(
            fdm,
            principal.effectivePrincipalId,
            b_id,
            geometry,
            nmiApiKey,
          )
        },
        (b_id, error) => console.warn(`[fdm-api] soil estimates failed for field ${b_id}:`, error),
      )
    }

    return c.json(
      {
        created: result.created.map((field) => field.b_id),
        updated: result.updated,
        closed: result.closed,
        removed: result.removed,
      },
      200,
    )
  }

  // Register the choice schema as a component, so clients can see its shape.
  app.openAPIRegistry.register("FieldImportChoice", FieldImportChoiceSchema)
  app.openapi(compareRoute, compareHandler)
  app.openapi(applyRoute, applyHandler)
}
