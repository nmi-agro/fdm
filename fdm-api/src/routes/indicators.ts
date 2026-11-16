import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createRoute, type z } from "@hono/zod-openapi"
import type { ApiEnv } from "../types"
import {
  FarmIndicatorsSchema,
  FieldIndicatorsSchema,
  FieldMeasureOptionsSchema,
  getFarmIndicators,
  getFieldIndicators,
  IndicatorFarmParamsSchema,
  IndicatorFieldParamsSchema,
  type IndicatorServices,
  IndicatorYearQuerySchema,
  listFieldMeasureOptions,
} from "../operations/indicators"
import { rateLimitMiddleware } from "../rate-limit"
import { commonErrorResponses, ProblemDetailsSchema } from "../schemas"
import { operationContext } from "./operation-context"

export type { IndicatorServices } from "../operations/indicators"

/** Badge shown in the API reference next to recently added operations. Remove it once the endpoints are no longer new. */
const NEW_BADGE = { name: "New", color: "#16a34a" }

const indicatorErrorResponses = {
  ...commonErrorResponses,
  400: {
    description: "Bad request — `year` is missing or not a four-digit calendar year.",
    content: { "application/problem+json": { schema: ProblemDetailsSchema } },
  },
  503: {
    description:
      "Service unavailable — scores, measure applicability or advice cannot be produced, or the server is not configured for indicator calculations.",
    content: { "application/problem+json": { schema: ProblemDetailsSchema } },
  },
}

const fieldIndicatorsRoute = createRoute({
  operationId: getFieldIndicators.name,
  method: "get",
  path: "/fields/{b_id}/indicators",
  tags: ["Indicators"],
  "x-badges": [NEW_BADGE],
  summary: "Get indicator scores of a field",
  description:
    "Returns the indicator and aggregation scores of a field for a calendar year. Buffer strips and nature fields return `is_excluded: true` with empty arrays. Counts against the `nmi` rate limit.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: IndicatorFieldParamsSchema, query: IndicatorYearQuerySchema },
  responses: {
    200: {
      description: "indicator scores of the field.",
      content: { "application/json": { schema: FieldIndicatorsSchema } },
    },
    ...indicatorErrorResponses,
  },
})

const farmIndicatorsRoute = createRoute({
  operationId: getFarmIndicators.name,
  method: "get",
  path: "/farms/{b_id_farm}/indicators",
  tags: ["Indicators"],
  "x-badges": [NEW_BADGE],
  summary: "Get indicator scores of a farm",
  description:
    "Returns indicator scores of all eligible fields of a farm and the area-weighted farm scores for a calendar year. Fields that cannot be scored fail the whole request with 503. A farm without eligible fields returns empty `fields` and empty farm aggregates. Counts as one request against the `nmi` rate limit, regardless of the number of fields.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: IndicatorFarmParamsSchema, query: IndicatorYearQuerySchema },
  responses: {
    200: {
      description: "indicator scores of the farm.",
      content: { "application/json": { schema: FarmIndicatorsSchema } },
    },
    ...indicatorErrorResponses,
  },
})

const fieldMeasureOptionsRoute = createRoute({
  operationId: listFieldMeasureOptions.name,
  method: "get",
  path: "/fields/{b_id}/measures/catalogue",
  tags: ["Measures"],
  "x-badges": [NEW_BADGE],
  summary: "Get measure options and recommendations for a field",
  description:
    "Lists field-level catalogue measures with descriptions, applicability, active and conflicting status, predicted impacts and recommendations for a calendar year. These are catalogue candidates, not adopted measures; use `m_id` of a selectable option with `POST /fields/{b_id}/measures`. Predicted impacts are advice for this field and year, not stored properties. Counts against the `nmi` rate limit.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: IndicatorFieldParamsSchema, query: IndicatorYearQuerySchema },
  responses: {
    200: {
      description: "Measure options of the field.",
      content: { "application/json": { schema: FieldMeasureOptionsSchema } },
    },
    ...indicatorErrorResponses,
  },
})

/**
 * Registers the read-only indicator endpoints: field and farm indicator scores and the field
 * measure options.
 *
 * @param app - The OpenAPI application.
 * @param fdm - The FDM instance.
 * @param services - Injectable services.
 */
export function registerIndicatorRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: IndicatorServices,
): void {
  // Requests to the NMI API have their own bucket; the general middleware skips these paths.
  app.use("/fields/:b_id/indicators", (c, next) => rateLimitMiddleware(fdm, "nmi")(c, next))
  app.use("/farms/:b_id_farm/indicators", (c, next) => rateLimitMiddleware(fdm, "nmi")(c, next))
  app.use("/fields/:b_id/measures/catalogue", (c, next) => rateLimitMiddleware(fdm, "nmi")(c, next))

  const fieldIndicatorsHandler: RouteHandler<typeof fieldIndicatorsRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof IndicatorFieldParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof IndicatorYearQuerySchema>
    const result = await getFieldIndicators.run(operationContext(c, fdm, services), {
      ...params,
      ...query,
    })
    return c.json(result, 200)
  }

  const farmIndicatorsHandler: RouteHandler<typeof farmIndicatorsRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof IndicatorFarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof IndicatorYearQuerySchema>
    const result = await getFarmIndicators.run(operationContext(c, fdm, services), {
      ...params,
      ...query,
    })
    return c.json(result, 200)
  }

  const fieldMeasureOptionsHandler: RouteHandler<typeof fieldMeasureOptionsRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof IndicatorFieldParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof IndicatorYearQuerySchema>
    const result = await listFieldMeasureOptions.run(operationContext(c, fdm, services), {
      ...params,
      ...query,
    })
    return c.json(result, 200)
  }

  app.openapi(fieldIndicatorsRoute, fieldIndicatorsHandler)
  app.openapi(farmIndicatorsRoute, farmIndicatorsHandler)
  app.openapi(fieldMeasureOptionsRoute, fieldMeasureOptionsHandler)
}
