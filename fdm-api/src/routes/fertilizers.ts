import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
  Fertilizer,
  FertilizerCatalogue,
  getFertilizer,
  getFertilizers,
  getFertilizersFromCatalogue,
  removeFertilizer,
} from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import {
  type addFertilizer,
  type addFertilizerToCatalogue,
  type FdmType,
  getFertilizerTypesByRvoCode,
  type updateFertilizerFromCatalogue,
} from "@nmi-agro/fdm-core"
import { fertilizerCatalogueNames } from "@nmi-agro/fdm-data"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError } from "../error"
import { FarmIdSchema, FertilizerIdSchema } from "../fields"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  DateStringSchema,
  PaginationQuerySchema,
  paginatedResponse,
  paginatedSchema,
  serializeDate,
  writeErrorResponses,
} from "../schemas"
import { FertilizerCatalogueSchema } from "./catalogues"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])
const FERTILIZER_NUMERIC_FIELDS = [
  "p_dm",
  "p_density",
  "p_om",
  "p_a",
  "p_hc",
  "p_eom",
  "p_eoc",
  "p_c_rt",
  "p_c_of",
  "p_c_if",
  "p_c_fr",
  "p_cn_of",
  "p_n_rt",
  "p_n_if",
  "p_n_of",
  "p_n_wc",
  "p_no3_rt",
  "p_nh4_rt",
  "p_p_rt",
  "p_k_rt",
  "p_mg_rt",
  "p_ca_rt",
  "p_ne",
  "p_s_rt",
  "p_s_wc",
  "p_cu_rt",
  "p_zn_rt",
  "p_na_rt",
  "p_si_rt",
  "p_b_rt",
  "p_mn_rt",
  "p_ni_rt",
  "p_fe_rt",
  "p_mo_rt",
  "p_co_rt",
  "p_as_rt",
  "p_cd_rt",
  "p_cr_rt",
  "p_cr_vi",
  "p_pb_rt",
  "p_hg_rt",
  "p_cl_rt",
  "p_ef_nh3",
] as const

/** Defines the fertilizer data access functions required by the fertilizer routes. */
export interface FertilizerServices {
  getFertilizers: typeof getFertilizers
  addFertilizer: typeof addFertilizer
  addFertilizerToCatalogue: typeof addFertilizerToCatalogue
  updateFertilizerFromCatalogue: typeof updateFertilizerFromCatalogue
  getFertilizer: typeof getFertilizer
  removeFertilizer: typeof removeFertilizer
  getFertilizersFromCatalogue: typeof getFertilizersFromCatalogue
}

const FertilizerSchema = z
  .object({
    p_id: FertilizerIdSchema,
    p_date_acquiring: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    p_picking_date: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    p_app_amount: z
      .number()
      .nullable()
      .describe("Amount of the product acquired by the farm (kg). `null` when unknown."),
    ...FertilizerCatalogueSchema.shape,
  })
  .openapi("Fertilizer")

const CreateFertilizerBodySchema = z
  .object({
    p_id_catalogue: z.string().describe("Fertilizer catalogue identifier."),
    p_acquiring_amount: z.number().optional().nullable().describe("Acquired amount in kg."),
    p_acquiring_date: DateStringSchema.optional().nullable().describe("Date in YYYY-MM-DD format."),
  })
  .openapi("CreateFertilizer")

/** Properties of a custom fertilizer that a client can set. */
const customFertilizerShape = FertilizerCatalogueSchema.omit({
  p_id_catalogue: true,
  p_source: true,
}).shape

type CustomFertilizerKey = keyof typeof customFertilizerShape

const optionalCustomFertilizerShape = Object.fromEntries(
  Object.entries(customFertilizerShape).map(([key, schema]) => [key, schema.optional()]),
) as { [K in CustomFertilizerKey]: z.ZodOptional<(typeof customFertilizerShape)[K]> }

const CreateCustomFertilizerBodySchema = z
  .object({
    ...optionalCustomFertilizerShape,
    p_name_nl: customFertilizerShape.p_name_nl,
    p_acquiring_amount: z
      .number()
      .min(0)
      .optional()
      .nullable()
      .describe("Amount of the product acquired by the farm (kg). Omit or `null` when unknown."),
    p_acquiring_date: DateStringSchema.optional()
      .nullable()
      .describe(
        "Date the product was acquired, in YYYY-MM-DD format. Omit or `null` when unknown.",
      ),
  })
  .openapi("CreateCustomFertilizer")

const UpdateCustomFertilizerBodySchema = z
  .object(optionalCustomFertilizerShape)
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one property to update.",
  })
  .openapi("UpdateCustomFertilizer")

const listFertilizersRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/fertilizers",
  tags: ["Fertilizers"],
  summary: "List fertilizers on a farm",
  description: "Returns all fertilizers acquired for the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id_farm: FarmIdSchema }),
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of fertilizers.",
      content: {
        "application/json": {
          schema: paginatedSchema(FertilizerSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

const createFertilizerRoute = createRoute({
  method: "post",
  path: "/farms/{b_id_farm}/fertilizers",
  tags: ["Fertilizers"],
  summary: "Acquire a fertilizer",
  description: "Creates a fertilizer acquisition for the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id_farm: FarmIdSchema }),
    body: {
      content: {
        "application/json": { schema: CreateFertilizerBodySchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Fertilizer acquired.",
      content: { "application/json": { schema: FertilizerSchema } },
    },
    ...writeErrorResponses,
  },
})

const createCustomFertilizerRoute = createRoute({
  method: "post",
  path: "/farms/{b_id_farm}/fertilizers/custom",
  tags: ["Fertilizers"],
  summary: "Create a custom fertilizer",
  description:
    "Creates a fertilizer with its own composition, available only to this farm, and acquires it for the farm. Properties that are omitted are stored as unknown (`null`). When `p_type` is omitted, it is derived from the other fertilizers of the farm with the same `p_type_rvo`. When `p_app_amount_unit` is omitted, `kg/ha` is used.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: z.object({ b_id_farm: FarmIdSchema }),
    body: {
      content: {
        "application/json": { schema: CreateCustomFertilizerBodySchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Custom fertilizer created and acquired.",
      content: { "application/json": { schema: FertilizerSchema } },
    },
    ...writeErrorResponses,
  },
})

const updateCustomFertilizerRoute = createRoute({
  method: "patch",
  path: "/fertilizers/{p_id}",
  tags: ["Fertilizers"],
  summary: "Update a custom fertilizer",
  description:
    "Updates the properties of a custom fertilizer, one created with `POST /farms/{b_id_farm}/fertilizers/custom`. Only the properties in the body change. Fertilizers from a standard catalogue cannot be changed and return `422`.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: z.object({ p_id: FertilizerIdSchema }),
    body: {
      content: {
        "application/json": { schema: UpdateCustomFertilizerBodySchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "The updated fertilizer.",
      content: { "application/json": { schema: FertilizerSchema } },
    },
    ...writeErrorResponses,
  },
})

const getFertilizerRoute = createRoute({
  method: "get",
  path: "/fertilizers/{p_id}",
  tags: ["Fertilizers"],
  summary: "Get a fertilizer",
  description: "Returns a single fertilizer by ID.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ p_id: FertilizerIdSchema }) },
  responses: {
    200: {
      description: "The requested fertilizer.",
      content: { "application/json": { schema: FertilizerSchema } },
    },
    ...commonErrorResponses,
  },
})

const deleteFertilizerRoute = createRoute({
  method: "delete",
  path: "/fertilizers/{p_id}",
  tags: ["Fertilizers"],
  summary: "Delete a fertilizer",
  description: "Permanently deletes a fertilizer.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ p_id: FertilizerIdSchema }) },
  responses: {
    204: { description: "Fertilizer deleted." },
    ...commonErrorResponses,
  },
})

function serialiseFertilizerCatalogueBase(fertilizer: Fertilizer | FertilizerCatalogue) {
  const serialised: Record<string, unknown> = {
    p_id_catalogue: fertilizer.p_id_catalogue,
    p_source: fertilizer.p_source,
    p_name_nl: fertilizer.p_name_nl ?? null,
    p_name_en: fertilizer.p_name_en ?? null,
    p_description: fertilizer.p_description ?? null,
    p_app_method_options: fertilizer.p_app_method_options ?? null,
    p_app_amount_unit: fertilizer.p_app_amount_unit,
    p_type: fertilizer.p_type ?? null,
    p_type_rvo: fertilizer.p_type_rvo ?? null,
  }
  for (const field of FERTILIZER_NUMERIC_FIELDS) {
    serialised[field] = fertilizer[field] ?? null
  }
  return serialised
}

function serialiseFertilizer(fertilizer: Fertilizer) {
  const withLegacyNames = fertilizer as Fertilizer & {
    p_acquiring_date?: Date | string | null
    p_acquiring_amount?: number | null
  }
  return {
    p_id: fertilizer.p_id,
    p_date_acquiring: serializeDate(
      fertilizer.p_date_acquiring ?? withLegacyNames.p_acquiring_date ?? null,
    ),
    p_picking_date: serializeDate(fertilizer.p_picking_date),
    p_app_amount: fertilizer.p_app_amount ?? withLegacyNames.p_acquiring_amount ?? null,
    ...serialiseFertilizerCatalogueBase(fertilizer),
  }
}

/**
 * Registers the fertilizer CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Fertilizer service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested fertilizer cannot be found.
 * @example
 * ```ts
 * registerFertilizerRoutes(app, fdm, services)
 * ```
 */
export function registerFertilizerRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: FertilizerServices,
): void {
  // /farms/*/fertilizers and /farms/*/fertilizer-catalogue are covered by the /farms/* middleware in farms.ts
  app.use("/fertilizers", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )
  app.use("/fertilizers/*", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )

  const listFertilizersHandler: RouteHandler<typeof listFertilizersRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const fertilizers = await services.getFertilizers(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
    )
    return c.json(paginatedResponse(fertilizers.map(serialiseFertilizer), limit, offset), 200)
  }

  const createFertilizerHandler: RouteHandler<typeof createFertilizerRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateFertilizerBodySchema>
    const p_id = await services.addFertilizer(
      fdm,
      principal.effectivePrincipalId,
      body.p_id_catalogue,
      b_id_farm,
      body.p_acquiring_amount ?? undefined,
      body.p_acquiring_date ? new Date(body.p_acquiring_date) : undefined,
    )
    const fertilizer = await services.getFertilizer(fdm, p_id, principal.effectivePrincipalId)
    if (!(fertilizer as Partial<Fertilizer>)?.p_id) {
      throw new ApiError(500, "internal-error", "Fertilizer created but could not be retrieved.")
    }
    const createdUrl = new URL(c.req.url)
    const basePath = createdUrl.pathname.replace(/\/+fertilizers.*$/, "")
    c.header("Location", `${createdUrl.origin}${basePath}/fertilizers/${p_id}`)
    return c.json(serialiseFertilizer(fertilizer), 201)
  }

  const createCustomFertilizerHandler: RouteHandler<typeof createCustomFertilizerRoute> = async (
    c,
  ) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateCustomFertilizerBodySchema>
    const { p_acquiring_amount, p_acquiring_date, ...properties } = body

    const catalogueProperties: Record<string, unknown> = {}
    for (const key of Object.keys(customFertilizerShape) as CustomFertilizerKey[]) {
      catalogueProperties[key] = properties[key] ?? null
    }
    if (properties.p_type === undefined && properties.p_type_rvo) {
      // Same rule as the web app: take the type of a fertilizer of the farm with this RVO code.
      const fertilizers = await services.getFertilizers(
        fdm,
        principal.effectivePrincipalId,
        b_id_farm,
      )
      catalogueProperties.p_type =
        getFertilizerTypesByRvoCode(fertilizers)[properties.p_type_rvo] ?? null
    }
    catalogueProperties.p_app_amount_unit = properties.p_app_amount_unit ?? "kg/ha"

    const p_id_catalogue = await services.addFertilizerToCatalogue(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      catalogueProperties as Parameters<typeof addFertilizerToCatalogue>[3],
    )
    const p_id = await services.addFertilizer(
      fdm,
      principal.effectivePrincipalId,
      p_id_catalogue,
      b_id_farm,
      p_acquiring_amount ?? undefined,
      p_acquiring_date ? new Date(p_acquiring_date) : undefined,
    )
    const fertilizer = await services.getFertilizer(fdm, p_id, principal.effectivePrincipalId)
    const createdUrl = new URL(c.req.url)
    const basePath = createdUrl.pathname.replace(/\/+farms\/.*$/, "")
    c.header("Location", `${createdUrl.origin}${basePath}/fertilizers/${p_id}`)
    return c.json(serialiseFertilizer(fertilizer), 201)
  }

  const updateCustomFertilizerHandler: RouteHandler<typeof updateCustomFertilizerRoute> = async (
    c,
  ) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { p_id } = c.req.valid("param") as { p_id: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateCustomFertilizerBodySchema>

    const fertilizer = await services.getFertilizer(fdm, p_id, principal.effectivePrincipalId)
    if (!(fertilizer as Partial<Fertilizer>)?.p_id) {
      throw new ApiError(404, "not-found", `Fertilizer '${p_id}' not found.`)
    }
    // A custom fertilizer is in the catalogue of its own farm, so its source is a farm ID.
    // fdm-core only updates catalogue items whose source is the given farm and checks write
    // access to that farm.
    if ((fertilizerCatalogueNames as readonly string[]).includes(fertilizer.p_source)) {
      throw new ApiError(
        422,
        "unprocessable-entity",
        "Only custom fertilizers can be updated. This fertilizer is from a standard catalogue.",
      )
    }

    await services.updateFertilizerFromCatalogue(
      fdm,
      principal.effectivePrincipalId,
      fertilizer.p_source,
      fertilizer.p_id_catalogue,
      body as Parameters<typeof updateFertilizerFromCatalogue>[4],
    )
    const updated = await services.getFertilizer(fdm, p_id, principal.effectivePrincipalId)
    return c.json(serialiseFertilizer(updated), 200)
  }

  const getFertilizerHandler: RouteHandler<typeof getFertilizerRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { p_id } = c.req.valid("param") as { p_id: string }
    const fertilizer = await services.getFertilizer(fdm, p_id, principal.effectivePrincipalId)
    if (!(fertilizer as Partial<Fertilizer>)?.p_id) {
      throw new ApiError(404, "not-found", `Fertilizer '${p_id}' not found.`)
    }
    return c.json(serialiseFertilizer(fertilizer), 200)
  }

  const deleteFertilizerHandler: RouteHandler<typeof deleteFertilizerRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { p_id } = c.req.valid("param") as { p_id: string }
    await services.removeFertilizer(fdm, p_id, principal.effectivePrincipalId)
    return c.newResponse(null, 204)
  }

  app.openapi(listFertilizersRoute, listFertilizersHandler)
  app.openapi(createFertilizerRoute, createFertilizerHandler)
  app.openapi(createCustomFertilizerRoute, createCustomFertilizerHandler)
  app.openapi(updateCustomFertilizerRoute, updateCustomFertilizerHandler)
  app.openapi(getFertilizerRoute, getFertilizerHandler)
  app.openapi(deleteFertilizerRoute, deleteFertilizerHandler)
}
