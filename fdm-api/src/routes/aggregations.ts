import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createRoute, type z } from "@hono/zod-openapi"
import type { ApiEnv } from "../types"
import {
  type AggregationScope,
  type AggregationServices,
  aggregationQuerySchema,
  calculateFarmGroupNitrogenBalance,
  calculateFarmGroupOrganicMatterBalance,
  calculateOrganizationNitrogenBalance,
  calculateOrganizationOrganicMatterBalance,
  FarmGroupAggregationInputSchema,
  FarmGroupAggregationParamsSchema,
  getFarmGroupIndicators,
  getOrganizationIndicators,
  listFarmGroupMeasures,
  listOrganizationMeasures,
  MultiFarmIndicatorsSchema,
  MultiFarmMeasuresSchema,
  MultiFarmNitrogenBalanceSchema,
  MultiFarmOrganicMatterBalanceSchema,
  OrganizationAggregationInputSchema,
  OrganizationAggregationParamsSchema,
} from "../operations/aggregations"
import { rateLimitMiddleware } from "../rate-limit"
import { commonErrorResponses, problemResponseDefinition } from "../schemas"
import { operationContext } from "./operation-context"

export type { AggregationServices } from "../operations/aggregations"

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

type Scope = AggregationScope

const SCOPES = {
  group: {
    base: "/farm-groups/{b_id_group}",
    params: FarmGroupAggregationParamsSchema,
    tag: "Farm Groups",
    of: "the farms of the group",
  },
  organization: {
    base: "/organizations/{organization_id}",
    params: OrganizationAggregationParamsSchema,
    tag: "Organizations",
    of: "the farms of the organization",
  },
} as const

/** The operations behind the aggregation routes, per scope. */
const OPERATIONS = {
  group: {
    nitrogenBalance: calculateFarmGroupNitrogenBalance,
    organicMatterBalance: calculateFarmGroupOrganicMatterBalance,
    indicators: getFarmGroupIndicators,
    measures: listFarmGroupMeasures,
  },
  organization: {
    nitrogenBalance: calculateOrganizationNitrogenBalance,
    organicMatterBalance: calculateOrganizationOrganicMatterBalance,
    indicators: getOrganizationIndicators,
    measures: listOrganizationMeasures,
  },
} as const

function aggregationRoute<T extends z.ZodTypeAny>(
  scope: Scope,
  operationId: string,
  path: string,
  summary: string,
  description: string,
  schema: T,
) {
  const config = SCOPES[scope]
  return createRoute({
    operationId,
    method: "get",
    path: `${config.base}${path}`,
    tags: [config.tag],
    summary,
    description: `${description} Covers ${config.of}${scope === "organization" ? "; the owner of the API key must be a member of the organization" : ""}.`,
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    "x-badges": [{ name: "New", color: "#16a34a" }],
    request: { params: config.params, query: aggregationQuerySchema(scope) },
    responses: {
      200: {
        description: "Results for all selected farms together and per farm.",
        content: { "application/json": { schema } },
      },
      ...commonErrorResponses,
      400: problemResponseDefinition("Bad request — the query parameters are not valid."),
      422: problemResponseDefinition(
        "Unprocessable entity — a requested farm is not part of the selection.",
      ),
      503: problemResponseDefinition(
        "Service unavailable — indicator calculations are not available on this server.",
      ),
    },
  })
}

const routes = (scope: Scope) => ({
  nitrogenBalance: aggregationRoute(
    scope,
    OPERATIONS[scope].nitrogenBalance.name,
    "/calculations/nitrogen-balance",
    "Nitrogen balance of several farms",
    "Calculates the nitrogen balance for a year: for all selected farms together and per farm. A farm or field that cannot be calculated is reported and does not stop the others. Counts towards the calculation rate limit.",
    MultiFarmNitrogenBalanceSchema,
  ),
  organicMatterBalance: aggregationRoute(
    scope,
    OPERATIONS[scope].organicMatterBalance.name,
    "/calculations/organic-matter-balance",
    "Organic matter balance of several farms",
    "Calculates the organic matter balance for a year: for all selected farms together and per farm. A farm or field that cannot be calculated is reported and does not stop the others. Counts towards the calculation rate limit.",
    MultiFarmOrganicMatterBalanceSchema,
  ),
  indicators: aggregationRoute(
    scope,
    OPERATIONS[scope].indicators.name,
    "/indicators",
    "Indicator scores of several farms",
    "Returns the soil quality indicator scores for a year: the area-weighted scores and the lowest score per indicator, for all selected farms together and per farm. Counts towards the NMI rate limit.",
    MultiFarmIndicatorsSchema,
  ),
  measures: aggregationRoute(
    scope,
    OPERATIONS[scope].measures.name,
    "/measures",
    "Measures of several farms",
    "Returns the measures taken on the fields that count for the indicators, and the main cultivations of those fields, for all selected farms together and per farm.",
    MultiFarmMeasuresSchema,
  ),
})

const groupRoutes = routes("group")
const organizationRoutes = routes("organization")

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Input accepted by the operations of both scopes. Each route validates the path parameters of
 * its own scope, which are exactly the parameters of the operation of that scope; this type only
 * lets one handler serve both scopes.
 */
type AggregationRunInput = z.infer<typeof FarmGroupAggregationInputSchema> &
  z.infer<typeof OrganizationAggregationInputSchema>

/**
 * Registers the aggregation routes of farm groups and organizations: balances, indicators and
 * measures of several farms, in total and per farm.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerAggregationRoutes(app, fdm, services)
 * ```
 */
export function registerAggregationRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: AggregationServices,
): void {
  for (const base of ["/farm-groups/:id", "/organizations/:id"]) {
    app.use(`${base}/calculations/*`, (c, next) => rateLimitMiddleware(fdm, "calc")(c, next))
    app.use(`${base}/indicators`, (c, next) => rateLimitMiddleware(fdm, "nmi")(c, next))
  }

  function register(scope: Scope, r: ReturnType<typeof routes>) {
    const ops = OPERATIONS[scope]

    const nitrogenBalanceHandler: RouteHandler<typeof r.nitrogenBalance> = async (c) => {
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const params = c.req.valid("param") as { b_id_group?: string; organization_id?: string }
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const query = c.req.valid("query") as z.infer<ReturnType<typeof aggregationQuerySchema>>
      const input = { ...params, ...query } as AggregationRunInput
      const result = await ops.nitrogenBalance.run(operationContext(c, fdm, services), input)
      return c.json(result, 200)
    }

    const organicMatterBalanceHandler: RouteHandler<typeof r.organicMatterBalance> = async (c) => {
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const params = c.req.valid("param") as { b_id_group?: string; organization_id?: string }
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const query = c.req.valid("query") as z.infer<ReturnType<typeof aggregationQuerySchema>>
      const input = { ...params, ...query } as AggregationRunInput
      const result = await ops.organicMatterBalance.run(operationContext(c, fdm, services), input)
      return c.json(result, 200)
    }

    const indicatorsHandler: RouteHandler<typeof r.indicators> = async (c) => {
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const params = c.req.valid("param") as { b_id_group?: string; organization_id?: string }
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const query = c.req.valid("query") as z.infer<ReturnType<typeof aggregationQuerySchema>>
      const input = { ...params, ...query } as AggregationRunInput
      const result = await ops.indicators.run(operationContext(c, fdm, services), input)
      return c.json(result, 200)
    }

    const measuresHandler: RouteHandler<typeof r.measures> = async (c) => {
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const params = c.req.valid("param") as { b_id_group?: string; organization_id?: string }
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const query = c.req.valid("query") as z.infer<ReturnType<typeof aggregationQuerySchema>>
      const input = { ...params, ...query } as AggregationRunInput
      const result = await ops.measures.run(operationContext(c, fdm, services), input)
      return c.json(result, 200)
    }

    app.openapi(r.nitrogenBalance, nitrogenBalanceHandler)
    app.openapi(r.organicMatterBalance, organicMatterBalanceHandler)
    app.openapi(r.indicators, indicatorsHandler)
    app.openapi(r.measures, measuresHandler)
  }

  register("group", groupRoutes)
  register("organization", organizationRoutes)
}
