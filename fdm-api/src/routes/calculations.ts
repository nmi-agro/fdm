import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createRoute, type z } from "@hono/zod-openapi"
import type { ApiEnv } from "../types"
import {
  CalculationFarmParamsSchema,
  CalculationFieldParamsSchema,
  type CalculationServices,
  calculateFarmNitrogenBalance,
  calculateFarmOrganicMatterBalance,
  calculateFieldNitrogenBalance,
  calculateFieldOrganicMatterBalance,
  DoseSchema,
  FarmNormsSchema,
  FarmNutrientAdviceSchema,
  FieldNormsSchema,
  FieldNutrientAdviceSchema,
  getFarmFertilizationNorms,
  getFarmNutrientAdvice,
  getFieldDose,
  getFieldFertilizationNorms,
  getFieldNutrientAdvice,
  NitrogenBalanceFieldResultSchema,
  NitrogenBalanceQuerySchema,
  NitrogenBalanceSchema,
  NormsYearQuerySchema,
  NutrientAdviceYearQuerySchema,
  OrganicMatterBalanceFieldResultSchema,
  OrganicMatterBalanceSchema,
  TimeframeQuerySchema,
} from "../operations/calculations"
import { rateLimitMiddleware } from "../rate-limit"
import { commonErrorResponses, ProblemDetailsSchema } from "../schemas"
import { operationContext } from "./operation-context"

export type { CalculationServices } from "../operations/calculations"

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const farmNitrogenBalanceRoute = createRoute({
  operationId: calculateFarmNitrogenBalance.name,
  method: "get",
  path: "/farms/{b_id_farm}/calculations/nitrogen-balance",
  summary: "Calculate nitrogen balance for a farm",
  description:
    "Computes the weighted-average nitrogen balance across all fields for the given farm and timeframe. Set `effective_nitrogen=true` for the balance with effective nitrogen. All values in kg N/ha.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: CalculationFarmParamsSchema,
    query: NitrogenBalanceQuerySchema,
  },
  responses: {
    200: {
      description: "Nitrogen balance result",
      content: { "application/json": { schema: NitrogenBalanceSchema } },
    },
    ...commonErrorResponses,
  },
})

const farmOrganicMatterBalanceRoute = createRoute({
  operationId: calculateFarmOrganicMatterBalance.name,
  method: "get",
  path: "/farms/{b_id_farm}/calculations/organic-matter-balance",
  summary: "Calculate organic matter balance for a farm",
  description:
    "Computes the weighted-average organic matter balance across all fields for the given farm and timeframe. All values in kg EOM/ha/year.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: CalculationFarmParamsSchema,
    query: TimeframeQuerySchema,
  },
  responses: {
    200: {
      description: "Organic matter balance result",
      content: {
        "application/json": { schema: OrganicMatterBalanceSchema },
      },
    },
    ...commonErrorResponses,
  },
})

const fieldNitrogenBalanceRoute = createRoute({
  operationId: calculateFieldNitrogenBalance.name,
  method: "get",
  path: "/fields/{b_id}/calculations/nitrogen-balance",
  summary: "Calculate nitrogen balance for a field",
  description:
    "Computes the nitrogen balance for a single field for the given timeframe. Set `effective_nitrogen=true` for the balance with effective nitrogen. All values in kg N/ha.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: CalculationFieldParamsSchema,
    query: NitrogenBalanceQuerySchema,
  },
  responses: {
    200: {
      description: "Field nitrogen balance result",
      content: {
        "application/json": {
          schema: NitrogenBalanceFieldResultSchema,
        },
      },
    },
    ...commonErrorResponses,
  },
})

const fieldOrganicMatterBalanceRoute = createRoute({
  operationId: calculateFieldOrganicMatterBalance.name,
  method: "get",
  path: "/fields/{b_id}/calculations/organic-matter-balance",
  summary: "Calculate organic matter balance for a field",
  description:
    "Computes the organic matter balance for a single field for the given timeframe. All values in kg EOM/ha/year.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: CalculationFieldParamsSchema,
    query: TimeframeQuerySchema,
  },
  responses: {
    200: {
      description: "Field organic matter balance result",
      content: {
        "application/json": {
          schema: OrganicMatterBalanceFieldResultSchema,
        },
      },
    },
    ...commonErrorResponses,
  },
})

const fieldDoseRoute = createRoute({
  operationId: getFieldDose.name,
  method: "get",
  path: "/fields/{b_id}/calculations/dose",
  summary: "Calculate fertilizer dose for a field",
  description:
    "Computes the total NPK and micro-nutrient doses applied to a specific field based on all recorded fertilizer applications.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: CalculationFieldParamsSchema,
  },
  responses: {
    200: {
      description: "Dose result",
      content: { "application/json": { schema: DoseSchema } },
    },
    ...commonErrorResponses,
  },
})

const farmNormsRoute = createRoute({
  operationId: getFarmFertilizationNorms.name,
  method: "get",
  path: "/farms/{b_id_farm}/calculations/norms",
  summary: "Calculate usage norms for all fields on a farm",
  description:
    "Computes the NL nitrogen, manure, and phosphate usage norms per field for the given calendar year. Only years 2025 and 2026 are currently supported.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: CalculationFarmParamsSchema,
    query: NormsYearQuerySchema,
  },
  responses: {
    200: {
      description: "Farm usage norms",
      content: { "application/json": { schema: FarmNormsSchema } },
    },
    ...commonErrorResponses,
  },
})

const fieldNormsRoute = createRoute({
  operationId: getFieldFertilizationNorms.name,
  method: "get",
  path: "/fields/{b_id}/calculations/norms",
  summary: "Calculate usage norms for a field",
  description:
    "Computes the NL nitrogen, manure, and phosphate usage norms for the given field and calendar year. Only years 2025 and 2026 are currently supported.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: CalculationFieldParamsSchema,
    query: NormsYearQuerySchema,
  },
  responses: {
    200: {
      description: "Field usage norms",
      content: { "application/json": { schema: FieldNormsSchema } },
    },
    ...commonErrorResponses,
  },
})

const nutrientAdviceResponses = {
  ...commonErrorResponses,
  503: {
    description: "Service unavailable — nutrient advice is not configured on this server.",
    content: { "application/problem+json": { schema: ProblemDetailsSchema } },
  },
}

const farmNutrientAdviceRoute = createRoute({
  operationId: getFarmNutrientAdvice.name,
  method: "get",
  path: "/farms/{b_id_farm}/calculations/nutrient-advice",
  summary: "Get nutrient advice for all fields on a farm",
  description:
    "Returns the nutrient advice, the dose already applied with fertilizers and the remaining advice for every field of the farm, for the main cultivation of the year. The advice comes from the NMI nutrient advice service and is the same as in the web app. A field whose advice cannot be calculated is returned with `error` set; the other fields are still calculated. Counts towards the NMI rate limit.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: CalculationFarmParamsSchema,
    query: NutrientAdviceYearQuerySchema,
  },
  responses: {
    200: {
      description: "Nutrient advice per field.",
      content: { "application/json": { schema: FarmNutrientAdviceSchema } },
    },
    ...nutrientAdviceResponses,
  },
})

const fieldNutrientAdviceRoute = createRoute({
  operationId: getFieldNutrientAdvice.name,
  method: "get",
  path: "/fields/{b_id}/calculations/nutrient-advice",
  summary: "Get nutrient advice for a field",
  description:
    "Returns the nutrient advice, the dose already applied with fertilizers and the remaining advice for the field, for the main cultivation of the year. The result is the same as for this field in `GET /farms/{b_id_farm}/calculations/nutrient-advice`. When the advice cannot be calculated, `error` is set. Counts towards the NMI rate limit.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: CalculationFieldParamsSchema,
    query: NutrientAdviceYearQuerySchema,
  },
  responses: {
    200: {
      description: "Nutrient advice of the field.",
      content: { "application/json": { schema: FieldNutrientAdviceSchema } },
    },
    ...nutrientAdviceResponses,
  },
})

// ---------------------------------------------------------------------------
// registerCalculationRoutes
// ---------------------------------------------------------------------------

/**
 * Registers the calculation endpoints on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Calculation service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerCalculationRoutes(app, fdm, services)
 * ```
 */
export function registerCalculationRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: CalculationServices,
): void {
  // Use the "calc" rate bucket (10 req/min) for all calculation endpoints.
  // These paths are narrow enough to avoid double-counting with farm/field middleware.
  app.use("/farms/:b_id_farm/calculations/*", (c, next) =>
    rateLimitMiddleware(fdm, "calc")(c, next),
  )
  app.use("/fields/:b_id/calculations/*", (c, next) => rateLimitMiddleware(fdm, "calc")(c, next))
  // The nutrient advice calls the NMI API and counts in the "nmi" bucket instead.
  app.use("/farms/:b_id_farm/calculations/nutrient-advice", (c, next) =>
    rateLimitMiddleware(fdm, "nmi")(c, next),
  )
  app.use("/fields/:b_id/calculations/nutrient-advice", (c, next) =>
    rateLimitMiddleware(fdm, "nmi")(c, next),
  )

  // --- Farm-level nitrogen balance ---
  const farmNitrogenBalanceHandler: RouteHandler<typeof farmNitrogenBalanceRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof CalculationFarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof NitrogenBalanceQuerySchema>
    const result = await calculateFarmNitrogenBalance.run(operationContext(c, fdm, services), {
      ...params,
      ...query,
    })
    return c.json(result, 200)
  }

  // --- Farm-level organic matter balance ---
  const farmOrganicMatterBalanceHandler: RouteHandler<
    typeof farmOrganicMatterBalanceRoute
  > = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof CalculationFarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof TimeframeQuerySchema>
    const result = await calculateFarmOrganicMatterBalance.run(operationContext(c, fdm, services), {
      ...params,
      ...query,
    })
    return c.json(result, 200)
  }

  // --- Field-level nitrogen balance ---
  const fieldNitrogenBalanceHandler: RouteHandler<typeof fieldNitrogenBalanceRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof CalculationFieldParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof NitrogenBalanceQuerySchema>
    const result = await calculateFieldNitrogenBalance.run(operationContext(c, fdm, services), {
      ...params,
      ...query,
    })
    return c.json(result, 200)
  }

  // --- Field-level organic matter balance ---
  const fieldOrganicMatterBalanceHandler: RouteHandler<
    typeof fieldOrganicMatterBalanceRoute
  > = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof CalculationFieldParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof TimeframeQuerySchema>
    const result = await calculateFieldOrganicMatterBalance.run(
      operationContext(c, fdm, services),
      { ...params, ...query },
    )
    return c.json(result, 200)
  }

  // --- Field-level dose ---
  const fieldDoseHandler: RouteHandler<typeof fieldDoseRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof CalculationFieldParamsSchema>
    return c.json(await getFieldDose.run(operationContext(c, fdm, services), params), 200)
  }

  const farmNormsHandler: RouteHandler<typeof farmNormsRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof CalculationFarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof NormsYearQuerySchema>
    const result = await getFarmFertilizationNorms.run(operationContext(c, fdm, services), {
      ...params,
      ...query,
    })
    return c.json(result, 200)
  }

  const fieldNormsHandler: RouteHandler<typeof fieldNormsRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof CalculationFieldParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof NormsYearQuerySchema>
    const result = await getFieldFertilizationNorms.run(operationContext(c, fdm, services), {
      ...params,
      ...query,
    })
    return c.json(result, 200)
  }

  const farmNutrientAdviceHandler: RouteHandler<typeof farmNutrientAdviceRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof CalculationFarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof NutrientAdviceYearQuerySchema>
    const result = await getFarmNutrientAdvice.run(operationContext(c, fdm, services), {
      ...params,
      ...query,
    })
    return c.json(result, 200)
  }

  const fieldNutrientAdviceHandler: RouteHandler<typeof fieldNutrientAdviceRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof CalculationFieldParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof NutrientAdviceYearQuerySchema>
    const result = await getFieldNutrientAdvice.run(operationContext(c, fdm, services), {
      ...params,
      ...query,
    })
    return c.json(result, 200)
  }

  app.openapi(farmNitrogenBalanceRoute, farmNitrogenBalanceHandler)
  app.openapi(farmOrganicMatterBalanceRoute, farmOrganicMatterBalanceHandler)
  app.openapi(fieldNitrogenBalanceRoute, fieldNitrogenBalanceHandler)
  app.openapi(fieldOrganicMatterBalanceRoute, fieldOrganicMatterBalanceHandler)
  app.openapi(fieldDoseRoute, fieldDoseHandler)
  app.openapi(farmNormsRoute, farmNormsHandler)
  app.openapi(fieldNormsRoute, fieldNormsHandler)
  app.openapi(farmNutrientAdviceRoute, farmNutrientAdviceHandler)
  app.openapi(fieldNutrientAdviceRoute, fieldNutrientAdviceHandler)
}
