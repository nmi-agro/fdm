import type * as core from "@nmi-agro/fdm-core"
import { z } from "@hono/zod-openapi"
import {
  getDefaultsForHarvestParameters,
  getEffectiveHarvestable,
  getParametersForHarvestCat,
} from "@nmi-agro/fdm-core"
import { ApiError } from "../error"
import { CultivationIdSchema, HarvestIdSchema, harvestAnalysisShape } from "../fields"
import { assertFarmSizeSupported, type LimitServices } from "../limits"
import {
  DateStringSchema,
  parseTimeframeQuery,
  serializeDate,
  TimeframeQuerySchema,
} from "../schemas"
import { DELETED, DeletedSchema } from "./common"
import { CultivationParamsSchema } from "./cultivations"
import { FarmParamsSchema } from "./farms"
import { defineOperation, type OperationContext } from "./types"

/** Defines the harvest data access functions required by the harvest operations. */
export interface HarvestServices extends LimitServices {
  /** Returns the harvests of a cultivation, optionally within a timeframe. */
  getHarvests: typeof core.getHarvests
  /** Returns a single cultivation, to look up its harvest category. */
  getCultivation: typeof core.getCultivation
  /** Returns a single field, to find the farm of a cultivation. */
  getField: typeof core.getField
  /** Lists the cultivations in the catalogues enabled on a farm. */
  getCultivationsFromCatalogue: typeof core.getCultivationsFromCatalogue
  /** Returns the harvests of all cultivations on a farm, optionally within a timeframe. */
  getHarvestsForFarm: typeof core.getHarvestsForFarm
  /** Returns a single harvest. */
  getHarvest: typeof core.getHarvest
  /** Creates a new harvest on an existing cultivation. */
  addHarvest: typeof core.addHarvest
  /** Updates an existing harvest. */
  updateHarvest: typeof core.updateHarvest
  /** Permanently deletes a harvest. */
  removeHarvest: typeof core.removeHarvest
}

const HarvestPropertyShape = harvestAnalysisShape((schema) => schema.nullable().optional())

const HarvestableAnalysisSchema = z.object({
  b_id_harvestable_analysis: z
    .string()
    .describe("Unique identifier of the analysis of the harvested product."),
  ...harvestAnalysisShape((schema) => schema.nullable()),
})

/** A harvest as returned by the API, with the analyses of the harvested product. */
export const HarvestSchema = z
  .object({
    b_id_harvesting: HarvestIdSchema,
    b_lu_harvest_date: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    b_lu: CultivationIdSchema.describe("Unique identifier of the harvested cultivation."),
    harvestable: z
      .object({
        b_id_harvestable: z.string().describe("Unique identifier of the harvested product."),
        harvestable_analyses: z
          .array(HarvestableAnalysisSchema)
          .describe("Analyses of the harvested product. Values are `null` when not measured."),
      })
      .describe("The product that was harvested."),
  })
  .openapi("Harvest")

/** Request body for creating a harvest. */
export const CreateHarvestBodySchema = z
  .object({
    b_lu_harvest_date: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    ...HarvestPropertyShape,
  })
  .openapi("CreateHarvest")

/** Request body for updating a harvest. */
export const UpdateHarvestBodySchema = z
  .object({
    b_lu_harvest_date: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    ...HarvestPropertyShape,
  })
  .openapi("UpdateHarvest")

/** Path parameters that identify a harvest. */
export const HarvestParamsSchema = z.object({ b_id_harvesting: HarvestIdSchema })

const harvestParameterCodes = [
  "b_lu_yield",
  "b_lu_yield_fresh",
  "b_lu_yield_bruto",
  "b_lu_tarra",
  "b_lu_uww",
  "b_lu_moist",
  "b_lu_dm",
  "b_lu_cp",
  "b_lu_n_harvestable",
] as const

/** The parameters a harvest of a cultivation needs, with their default values. */
export const HarvestParametersSchema = z
  .object({
    b_lu: CultivationIdSchema.describe("Unique identifier of the cultivation."),
    b_lu_catalogue: z.string().describe("Cultivation catalogue code of the cultivation."),
    b_lu_harvestcat: z
      .string()
      .nullable()
      .describe(
        "Harvest category of the crop (HC010–HC050), which decides the parameters of a harvest. `null` when the crop has no harvest category.",
      ),
    b_lu_harvestable: z
      .enum(["none", "once", "multiple"])
      .describe(
        "How often the cultivation can be harvested: `none`, `once`, or `multiple` (several cuts, only for grassland).",
      ),
    parameters: z
      .array(z.enum(harvestParameterCodes))
      .describe(
        "Parameters required to register a harvest of this cultivation. Send these in `POST /cultivations/{b_lu}/harvests`. Empty when the crop is not harvested.",
      ),
    defaults: z
      .object(harvestAnalysisShape((schema) => schema.optional()))
      .pick(
        Object.fromEntries(harvestParameterCodes.map((code) => [code, true])) as {
          [K in (typeof harvestParameterCodes)[number]]: true
        },
      )
      .describe(
        "Default value of each required parameter, based on the typical yield and dry matter content of the crop. Only parameters in `parameters` can be present; a parameter without a typical value is omitted.",
      ),
  })
  .openapi("HarvestParameters")

function serialiseHarvest(harvest: core.Harvest): z.infer<typeof HarvestSchema> {
  return {
    b_id_harvesting: harvest.b_id_harvesting,
    // Every harvest has a harvest date, so the serialised value is never null.
    b_lu_harvest_date: serializeDate(harvest.b_lu_harvest_date) as string,
    b_lu: harvest.b_lu,
    harvestable: {
      b_id_harvestable: harvest.harvestable.b_id_harvestable,
      harvestable_analyses: harvest.harvestable.harvestable_analyses.map((analysis) => ({
        b_id_harvestable_analysis: analysis.b_id_harvestable_analysis,
        b_lu_yield: analysis.b_lu_yield ?? null,
        b_lu_yield_fresh: analysis.b_lu_yield_fresh ?? null,
        b_lu_yield_bruto: analysis.b_lu_yield_bruto ?? null,
        b_lu_tarra: analysis.b_lu_tarra ?? null,
        b_lu_dm: analysis.b_lu_dm ?? null,
        b_lu_moist: analysis.b_lu_moist ?? null,
        b_lu_uww: analysis.b_lu_uww ?? null,
        b_lu_cp: analysis.b_lu_cp ?? null,
        b_lu_n_harvestable: analysis.b_lu_n_harvestable ?? null,
        b_lu_n_residue: analysis.b_lu_n_residue ?? null,
        b_lu_p_harvestable: analysis.b_lu_p_harvestable ?? null,
        b_lu_p_residue: analysis.b_lu_p_residue ?? null,
        b_lu_k_harvestable: analysis.b_lu_k_harvestable ?? null,
        b_lu_k_residue: analysis.b_lu_k_residue ?? null,
      })),
    },
  }
}

function getHarvestProperties(
  body: z.infer<typeof CreateHarvestBodySchema> | z.infer<typeof UpdateHarvestBodySchema>,
) {
  const properties = {
    b_lu_yield: body.b_lu_yield,
    b_lu_yield_bruto: body.b_lu_yield_bruto,
    b_lu_yield_fresh: body.b_lu_yield_fresh,
    b_lu_tarra: body.b_lu_tarra,
    b_lu_dm: body.b_lu_dm,
    b_lu_moist: body.b_lu_moist,
    b_lu_uww: body.b_lu_uww,
    b_lu_cp: body.b_lu_cp,
    b_lu_n_harvestable: body.b_lu_n_harvestable,
    b_lu_n_residue: body.b_lu_n_residue,
    b_lu_p_harvestable: body.b_lu_p_harvestable,
    b_lu_p_residue: body.b_lu_p_residue,
    b_lu_k_harvestable: body.b_lu_k_harvestable,
    b_lu_k_residue: body.b_lu_k_residue,
  }
  return Object.values(properties).some((value) => value !== undefined) ? properties : undefined
}

/**
 * Lists the harvests of all cultivations on a farm, sorted by harvest date. Use `from` and `to`
 * to limit the period.
 */
export const listFarmHarvests = defineOperation({
  name: "listFarmHarvests",
  kind: "read",
  bucket: "general",
  input: FarmParamsSchema.extend(TimeframeQuerySchema.shape),
  output: z.array(HarvestSchema),
  run: async (
    { fdm, services, principal }: OperationContext<HarvestServices>,
    { b_id_farm, ...timeframe },
  ) => {
    await assertFarmSizeSupported(fdm, services, principal.effectivePrincipalId, b_id_farm)
    const byKey = await services.getHarvestsForFarm(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      parseTimeframeQuery(timeframe),
    )
    const items = [...byKey.values()].flat()
    items.sort(
      (a, b) =>
        String(serializeDate(a.b_lu_harvest_date)).localeCompare(
          String(serializeDate(b.b_lu_harvest_date)),
        ) || a.b_id_harvesting.localeCompare(b.b_id_harvesting),
    )
    return items.map(serialiseHarvest)
  },
})

/**
 * Returns which parameters a harvest of a cultivation needs and their default values, based on
 * the harvest category and the typical yield of the crop.
 */
export const getCultivationHarvestParameters = defineOperation({
  name: "getCultivationHarvestParameters",
  kind: "read",
  bucket: "general",
  input: CultivationParamsSchema,
  output: HarvestParametersSchema,
  run: async ({ fdm, services, principal }: OperationContext<HarvestServices>, { b_lu }) => {
    const cultivation = await services.getCultivation(fdm, principal.effectivePrincipalId, b_lu)
    if (!cultivation) {
      throw new ApiError(404, "not-found", `Cultivation '${b_lu}' not found.`)
    }
    const field = await services.getField(fdm, principal.effectivePrincipalId, cultivation.b_id)
    if (!field) {
      throw new ApiError(404, "not-found", `Cultivation '${b_lu}' not found.`)
    }
    const catalogue = await services.getCultivationsFromCatalogue(
      fdm,
      principal.effectivePrincipalId,
      field.b_id_farm,
    )
    const b_lu_harvestable = getEffectiveHarvestable(
      cultivation.b_lu_harvestable,
      cultivation.b_lu_croprotation,
    )
    const parameters =
      b_lu_harvestable === "none" ? [] : getParametersForHarvestCat(cultivation.b_lu_harvestcat)
    const defaults =
      parameters.length > 0 &&
      catalogue.some((item) => item.b_lu_catalogue === cultivation.b_lu_catalogue)
        ? getDefaultsForHarvestParameters(cultivation.b_lu_catalogue, catalogue)
        : {}
    return {
      b_lu,
      b_lu_catalogue: cultivation.b_lu_catalogue,
      b_lu_harvestcat: cultivation.b_lu_harvestcat ?? null,
      b_lu_harvestable,
      parameters,
      defaults,
    } as z.infer<typeof HarvestParametersSchema>
  },
})

/** Lists the harvests of a cultivation. Use `from` and `to` to limit the period. */
export const listCultivationHarvests = defineOperation({
  name: "listCultivationHarvests",
  kind: "read",
  bucket: "general",
  input: CultivationParamsSchema.extend(TimeframeQuerySchema.shape),
  output: z.array(HarvestSchema),
  run: async (
    { fdm, services, principal }: OperationContext<HarvestServices>,
    { b_lu, ...timeframe },
  ) => {
    const harvests = await services.getHarvests(
      fdm,
      principal.effectivePrincipalId,
      b_lu,
      parseTimeframeQuery(timeframe),
    )
    return harvests.map(serialiseHarvest)
  },
})

/** Creates a harvest on a cultivation. */
export const createHarvest = defineOperation({
  name: "createHarvest",
  kind: "create",
  bucket: "write",
  input: CultivationParamsSchema.extend(CreateHarvestBodySchema.shape),
  output: HarvestSchema,
  run: async (
    { fdm, services, principal }: OperationContext<HarvestServices>,
    { b_lu, ...body },
  ) => {
    const b_id_harvesting = await services.addHarvest(
      fdm,
      principal.effectivePrincipalId,
      b_lu,
      new Date(body.b_lu_harvest_date),
      getHarvestProperties(body),
    )
    const harvest = await services.getHarvest(fdm, principal.effectivePrincipalId, b_id_harvesting)
    if (!harvest?.b_id_harvesting) {
      throw new ApiError(500, "internal-error", "Harvest created but could not be retrieved.")
    }
    return serialiseHarvest(harvest)
  },
})

/** Returns a single harvest. */
export const getHarvest = defineOperation({
  name: "getHarvest",
  kind: "read",
  bucket: "general",
  input: HarvestParamsSchema,
  output: HarvestSchema,
  run: async (
    { fdm, services, principal }: OperationContext<HarvestServices>,
    { b_id_harvesting },
  ) => {
    const harvest = await services.getHarvest(fdm, principal.effectivePrincipalId, b_id_harvesting)
    if (!harvest?.b_id_harvesting) {
      throw new ApiError(404, "not-found", `Harvest '${b_id_harvesting}' not found.`)
    }
    return serialiseHarvest(harvest)
  },
})

/** Replaces the harvest date and the analysis values of a harvest. */
export const updateHarvest = defineOperation({
  name: "updateHarvest",
  kind: "update",
  bucket: "write",
  input: HarvestParamsSchema.extend(UpdateHarvestBodySchema.shape),
  output: HarvestSchema,
  run: async (
    { fdm, services, principal }: OperationContext<HarvestServices>,
    { b_id_harvesting, ...body },
  ) => {
    if (Object.values(body).every((value) => value === undefined)) {
      throw new ApiError(400, "validation-failed", "At least one field must be provided.")
    }
    await services.updateHarvest(
      fdm,
      principal.effectivePrincipalId,
      b_id_harvesting,
      new Date(body.b_lu_harvest_date),
      getHarvestProperties(body),
    )
    const harvest = await services.getHarvest(fdm, principal.effectivePrincipalId, b_id_harvesting)
    if (!harvest?.b_id_harvesting) {
      throw new ApiError(404, "not-found", `Harvest '${b_id_harvesting}' not found.`)
    }
    return serialiseHarvest(harvest)
  },
})

/** Permanently deletes a harvest. */
export const deleteHarvest = defineOperation({
  name: "deleteHarvest",
  kind: "delete",
  bucket: "write",
  input: HarvestParamsSchema,
  output: DeletedSchema,
  run: async (
    { fdm, services, principal }: OperationContext<HarvestServices>,
    { b_id_harvesting },
  ) => {
    await services.removeHarvest(fdm, principal.effectivePrincipalId, b_id_harvesting)
    return DELETED
  },
})
