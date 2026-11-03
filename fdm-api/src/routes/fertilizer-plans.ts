import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
  FdmType,
  FertilizerPlan,
  getFertilizerPlan,
  getFertilizerPlans,
} from "@nmi-agro/fdm-core"
import type {
  createFertilizerPlanStatusChecker,
  establishFertilizerPlan,
  ReportBranding,
  removeFertilizerPlanWithFile,
} from "@nmi-agro/fdm-reports"
import type { FileStorage } from "@nmi-agro/fdm-storage"
import { createRoute, z } from "@hono/zod-openapi"
import { FileNotFoundError } from "@nmi-agro/fdm-storage"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError } from "../error"
import { FarmIdSchema } from "../fields"
import { rateLimitMiddleware } from "../rate-limit"
import {
  binaryResponse,
  commonErrorResponses,
  problemResponseDefinition,
  serializeDate,
  writeErrorResponses,
} from "../schemas"
import { requireStorage } from "../storage"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

/** Defines the functions required by the fertilizer plan routes. */
export interface FertilizerPlanServices {
  getFertilizerPlans: typeof getFertilizerPlans
  getFertilizerPlan: typeof getFertilizerPlan
  establishFertilizerPlan: typeof establishFertilizerPlan
  removeFertilizerPlanWithFile: typeof removeFertilizerPlanWithFile
  createFertilizerPlanStatusChecker: typeof createFertilizerPlanStatusChecker
  getStorage: () => FileStorage | undefined
  getNmiApiKey: () => string | undefined
  getReportBranding: () => Promise<ReportBranding>
}

const PlanIdSchema = z
  .string()
  .min(1)
  .describe("Unique identifier of the fertilizer plan.")
  .openapi({ param: { name: "p_id_plan", in: "path" } })

const YearSchema = z.string().regex(/^\d{4}$/, "year must be a four-digit calendar year.")

const FertilizerPlanSchema = z
  .object({
    p_id_plan: z.string().describe("Unique identifier of the fertilizer plan."),
    b_id_farm: FarmIdSchema.describe("Unique identifier of the farm."),
    p_plan_year: z.number().int().describe("Calendar year the plan is for."),
    p_plan_date: z
      .string()
      .describe("Date the data of the plan was collected, in YYYY-MM-DD format."),
    status: z
      .enum(["fresh", "expired", "unknown"])
      .describe(
        "Whether the plan still matches the current data of the farm: `fresh` (nothing changed), `expired` (data or calculation method changed; generate a new plan) or `unknown` (the current data could not be read).",
      ),
  })
  .openapi("FertilizerPlan")

const CreateFertilizerPlanBodySchema = z
  .object({
    year: z.number().int().min(2000).max(2100).describe("Calendar year of the plan."),
  })
  .openapi("CreateFertilizerPlan")

const fileUnavailable = problemResponseDefinition(
  "Service unavailable — file storage is not configured on this server.",
)

const listPlansRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/fertilizer-plans",
  tags: ["Fertilizer Plans"],
  summary: "List the fertilizer plans of a farm",
  description:
    "Returns the saved fertilizer plans of the farm, newest year first, with whether each plan still matches the current data. Checking the status reads the data of each year, so this request counts towards the NMI rate limit.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: z.object({ b_id_farm: FarmIdSchema }),
    query: z.object({
      year: YearSchema.optional().describe("Return only the plans of this calendar year."),
    }),
  },
  responses: {
    200: {
      description: "The fertilizer plans.",
      content: { "application/json": { schema: z.array(FertilizerPlanSchema) } },
    },
    ...commonErrorResponses,
  },
})

const createPlanRoute = createRoute({
  method: "post",
  path: "/farms/{b_id_farm}/fertilizer-plans",
  tags: ["Fertilizer Plans"],
  summary: "Generate a fertilizer plan",
  description:
    "Generates the fertilizer plan (bemestingsplan) of the farm for a year: a PDF with the usage norms and their filling, the nutrient advice, the planned doses and the organic matter balance, per field and for the farm. It is the same plan as in the web app. Generating takes a while for large farms. Counts towards the NMI rate limit.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: z.object({ b_id_farm: FarmIdSchema }),
    body: {
      content: { "application/json": { schema: CreateFertilizerPlanBodySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: "The new fertilizer plan.",
      content: { "application/json": { schema: FertilizerPlanSchema } },
    },
    ...writeErrorResponses,
    503: fileUnavailable,
  },
})

const getPlanRoute = createRoute({
  method: "get",
  path: "/fertilizer-plans/{p_id_plan}",
  tags: ["Fertilizer Plans"],
  summary: "Get a fertilizer plan",
  description: "Returns a fertilizer plan with whether it still matches the current data.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: { params: z.object({ p_id_plan: PlanIdSchema }) },
  responses: {
    200: {
      description: "The fertilizer plan.",
      content: { "application/json": { schema: FertilizerPlanSchema } },
    },
    ...commonErrorResponses,
  },
})

const downloadPlanRoute = createRoute({
  method: "get",
  path: "/fertilizer-plans/{p_id_plan}/pdf",
  tags: ["Fertilizer Plans"],
  summary: "Download a fertilizer plan",
  description: "Returns the PDF of the fertilizer plan.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: { params: z.object({ p_id_plan: PlanIdSchema }) },
  responses: {
    200: binaryResponse("application/pdf", "The fertilizer plan."),
    ...commonErrorResponses,
    503: fileUnavailable,
  },
})

const deletePlanRoute = createRoute({
  method: "delete",
  path: "/fertilizer-plans/{p_id_plan}",
  tags: ["Fertilizer Plans"],
  summary: "Delete a fertilizer plan",
  description: "Permanently deletes a fertilizer plan and its PDF.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: { params: z.object({ p_id_plan: PlanIdSchema }) },
  responses: {
    204: { description: "Fertilizer plan deleted." },
    ...commonErrorResponses,
    503: fileUnavailable,
  },
})

/**
 * Registers the fertilizer plan routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Fertilizer plan service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerFertilizerPlanRoutes(app, fdm, services)
 * ```
 */
export function registerFertilizerPlanRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: FertilizerPlanServices,
): void {
  // /farms/*/fertilizer-plans counts in the "nmi" bucket (see rate-limit.ts).
  app.use("/farms/:b_id_farm/fertilizer-plans", (c, next) =>
    rateLimitMiddleware(fdm, "nmi")(c, next),
  )
  app.use("/fertilizer-plans/*", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )

  async function serialisePlans(principal_id: string, b_id_farm: string, plans: FertilizerPlan[]) {
    const checkStatus = services.createFertilizerPlanStatusChecker(fdm, principal_id, b_id_farm)
    return Promise.all(
      plans.map(async (plan) => ({
        p_id_plan: plan.p_id_plan,
        b_id_farm,
        p_plan_year: plan.p_plan_year,
        p_plan_date: serializeDate(plan.p_plan_date) ?? "",
        status: await checkStatus(plan),
      })),
    )
  }

  async function requirePlan(principal_id: string, p_id_plan: string) {
    const plan = await services.getFertilizerPlan(fdm, principal_id, p_id_plan).catch((err) => {
      if (err instanceof Error && /not found/i.test(String(err.cause ?? err.message))) {
        return undefined
      }
      throw err
    })
    if (!plan?.b_id_farm) {
      throw new ApiError(404, "not-found", `Fertilizer plan '${p_id_plan}' not found.`)
    }
    return plan as FertilizerPlan & { b_id_farm: string }
  }

  const listPlansHandler: RouteHandler<typeof listPlansRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { year } = c.req.valid("query") as { year?: string }
    const plans = await services.getFertilizerPlans(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      year ? Number.parseInt(year, 10) : undefined,
    )
    return c.json(await serialisePlans(principal.effectivePrincipalId, b_id_farm, plans), 200)
  }

  const createPlanHandler: RouteHandler<typeof createPlanRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { year } = c.req.valid("json") as z.infer<typeof CreateFertilizerPlanBodySchema>
    const storage = requireStorage(services.getStorage)
    const p_id_plan = await services.establishFertilizerPlan({
      fdm,
      principal_id: principal.effectivePrincipalId,
      b_id_farm,
      year,
      storage,
      nmiApiKey: services.getNmiApiKey(),
      branding: await services.getReportBranding(),
    })
    const plan = await requirePlan(principal.effectivePrincipalId, p_id_plan)
    const [serialised] = await serialisePlans(principal.effectivePrincipalId, b_id_farm, [plan])
    c.header("Location", `${new URL(c.req.url).origin}/fertilizer-plans/${p_id_plan}`)
    return c.json(serialised as z.infer<typeof FertilizerPlanSchema>, 201)
  }

  const getPlanHandler: RouteHandler<typeof getPlanRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { p_id_plan } = c.req.valid("param") as { p_id_plan: string }
    const plan = await requirePlan(principal.effectivePrincipalId, p_id_plan)
    const [serialised] = await serialisePlans(principal.effectivePrincipalId, plan.b_id_farm, [
      plan,
    ])
    return c.json(serialised as z.infer<typeof FertilizerPlanSchema>, 200)
  }

  const downloadPlanHandler: RouteHandler<typeof downloadPlanRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { p_id_plan } = c.req.valid("param") as { p_id_plan: string }
    const storage = requireStorage(services.getStorage)
    const plan = await requirePlan(principal.effectivePrincipalId, p_id_plan)
    let file: Awaited<ReturnType<FileStorage["download"]>>
    try {
      file = await storage.download(plan.p_plan_file_path)
    } catch (err) {
      if (err instanceof FileNotFoundError) {
        throw new ApiError(
          404,
          "not-found",
          `The PDF of fertilizer plan '${p_id_plan}' is missing.`,
        )
      }
      throw err
    }
    return c.body(new Uint8Array(file.buffer), 200, {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="bemestingsplan-${plan.p_plan_year}-${p_id_plan}.pdf"`,
    }) as never
  }

  const deletePlanHandler: RouteHandler<typeof deletePlanRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { p_id_plan } = c.req.valid("param") as { p_id_plan: string }
    const plan = await requirePlan(principal.effectivePrincipalId, p_id_plan)
    const storage = services.getStorage()
    if (storage) {
      const fileError = await services.removeFertilizerPlanWithFile(
        fdm,
        principal.effectivePrincipalId,
        plan,
        storage,
      )
      if (fileError) {
        // The plan is deleted; only the file is left behind.
        console.warn(
          `[fdm-api] could not delete the PDF of fertilizer plan ${p_id_plan}:`,
          fileError,
        )
      }
    } else {
      throw new ApiError(
        503,
        "service-unavailable",
        "File storage is not configured on this server.",
      )
    }
    return c.newResponse(null, 204)
  }

  app.openapi(listPlansRoute, listPlansHandler)
  app.openapi(createPlanRoute, createPlanHandler)
  app.openapi(getPlanRoute, getPlanHandler)
  app.openapi(downloadPlanRoute, downloadPlanHandler)
  app.openapi(deletePlanRoute, deletePlanHandler)
}
