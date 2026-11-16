import type * as core from "@nmi-agro/fdm-core"
import { z } from "@hono/zod-openapi"
import { getFertilizerTypesByRvoCode } from "@nmi-agro/fdm-core"
import { fertilizerCatalogueNames } from "@nmi-agro/fdm-data"
import { ApiError } from "../error"
import { FarmIdSchema, FertilizerIdSchema } from "../fields"
import { DateStringSchema, serializeDate } from "../schemas"
import { FertilizerCatalogueSchema } from "./catalogues"
import { DELETED, DeletedSchema } from "./common"
import { defineOperation, type OperationContext } from "./types"

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

/** Defines the fertilizer data access functions required by the fertilizer operations. */
export interface FertilizerServices {
  /** Lists the fertilizers acquired for a farm. */
  getFertilizers: typeof core.getFertilizers
  /** Acquires a catalogue fertilizer for a farm. */
  addFertilizer: typeof core.addFertilizer
  /** Adds a fertilizer to the farm's own catalogue. */
  addFertilizerToCatalogue: typeof core.addFertilizerToCatalogue
  /** Updates a fertilizer in the farm's own catalogue. */
  updateFertilizerFromCatalogue: typeof core.updateFertilizerFromCatalogue
  /** Returns a single fertilizer acquired by a farm. */
  getFertilizer: typeof core.getFertilizer
  /** Permanently deletes a fertilizer acquired by a farm. */
  removeFertilizer: typeof core.removeFertilizer
  /** Lists the fertilizers in the catalogues enabled on a farm. */
  getFertilizersFromCatalogue: typeof core.getFertilizersFromCatalogue
}

/** A fertilizer acquired by a farm, with its composition from the catalogue. */
export const FertilizerSchema = z
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

/** Request body for acquiring a catalogue fertilizer. */
export const CreateFertilizerBodySchema = z
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

/** Request body for creating a custom fertilizer and acquiring it for the farm. */
export const CreateCustomFertilizerBodySchema = z
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

/** Request body for updating a custom fertilizer. At least one property must be supplied. */
export const UpdateCustomFertilizerBodySchema = z
  .object(optionalCustomFertilizerShape)
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one property to update.",
  })
  .openapi("UpdateCustomFertilizer")

/** Path parameters that identify a farm. */
export const FertilizerFarmParamsSchema = z.object({ b_id_farm: FarmIdSchema })

/** Path parameters that identify a fertilizer. */
export const FertilizerParamsSchema = z.object({ p_id: FertilizerIdSchema })

function serialiseFertilizerCatalogueBase(fertilizer: core.Fertilizer | core.FertilizerCatalogue) {
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

function serialiseFertilizer(fertilizer: core.Fertilizer): z.infer<typeof FertilizerSchema> {
  const withLegacyNames = fertilizer as core.Fertilizer & {
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
  } as z.infer<typeof FertilizerSchema>
}

/** Lists the fertilizers acquired for a farm. */
export const listFarmFertilizers = defineOperation({
  name: "listFarmFertilizers",
  kind: "read",
  bucket: "general",
  input: FertilizerFarmParamsSchema,
  output: z.array(FertilizerSchema),
  run: async (
    { fdm, services, principal }: OperationContext<FertilizerServices>,
    { b_id_farm },
  ) => {
    const fertilizers = await services.getFertilizers(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
    )
    return fertilizers.map(serialiseFertilizer)
  },
})

/** Acquires a fertilizer from an enabled catalogue for a farm. */
export const createFertilizer = defineOperation({
  name: "createFertilizer",
  kind: "create",
  bucket: "write",
  input: FertilizerFarmParamsSchema.extend(CreateFertilizerBodySchema.shape),
  output: FertilizerSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FertilizerServices>,
    { b_id_farm, ...body },
  ) => {
    const p_id = await services.addFertilizer(
      fdm,
      principal.effectivePrincipalId,
      body.p_id_catalogue,
      b_id_farm,
      body.p_acquiring_amount ?? undefined,
      body.p_acquiring_date ? new Date(body.p_acquiring_date) : undefined,
    )
    const fertilizer = await services.getFertilizer(fdm, p_id, principal.effectivePrincipalId)
    if (!(fertilizer as Partial<core.Fertilizer>)?.p_id) {
      throw new ApiError(500, "internal-error", "Fertilizer created but could not be retrieved.")
    }
    return serialiseFertilizer(fertilizer)
  },
})

/**
 * Creates a fertilizer with its own composition in the farm's catalogue and acquires it for the
 * farm. Omitted properties are stored as unknown (`null`). When `p_type` is omitted, it is derived
 * from the other fertilizers of the farm with the same `p_type_rvo`. When `p_app_amount_unit` is
 * omitted, `kg/ha` is used.
 */
export const createCustomFertilizer = defineOperation({
  name: "createCustomFertilizer",
  kind: "create",
  bucket: "write",
  input: FertilizerFarmParamsSchema.extend(CreateCustomFertilizerBodySchema.shape),
  output: FertilizerSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FertilizerServices>,
    { b_id_farm, ...body },
  ) => {
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
      catalogueProperties as Parameters<typeof core.addFertilizerToCatalogue>[3],
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
    return serialiseFertilizer(fertilizer)
  },
})

/**
 * Updates the supplied properties of a custom fertilizer. Fertilizers from a standard catalogue
 * cannot be changed.
 */
export const updateCustomFertilizer = defineOperation({
  name: "updateCustomFertilizer",
  kind: "update",
  bucket: "write",
  // The body refinement is re-created here: `.extend` keeps the fields but not the refinement.
  input: FertilizerParamsSchema.extend(UpdateCustomFertilizerBodySchema.shape).refine(
    ({ p_id: _p_id, ...body }) => Object.keys(body).length > 0,
    { message: "Provide at least one property to update." },
  ),
  output: FertilizerSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FertilizerServices>,
    { p_id, ...body },
  ) => {
    const fertilizer = await services.getFertilizer(fdm, p_id, principal.effectivePrincipalId)
    if (!(fertilizer as Partial<core.Fertilizer>)?.p_id) {
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
      body as Parameters<typeof core.updateFertilizerFromCatalogue>[4],
    )
    const updated = await services.getFertilizer(fdm, p_id, principal.effectivePrincipalId)
    return serialiseFertilizer(updated)
  },
})

/** Returns a single fertilizer acquired by a farm. */
export const getFertilizer = defineOperation({
  name: "getFertilizer",
  kind: "read",
  bucket: "general",
  input: FertilizerParamsSchema,
  output: FertilizerSchema,
  run: async ({ fdm, services, principal }: OperationContext<FertilizerServices>, { p_id }) => {
    const fertilizer = await services.getFertilizer(fdm, p_id, principal.effectivePrincipalId)
    if (!(fertilizer as Partial<core.Fertilizer>)?.p_id) {
      throw new ApiError(404, "not-found", `Fertilizer '${p_id}' not found.`)
    }
    return serialiseFertilizer(fertilizer)
  },
})

/** Permanently deletes a fertilizer acquired by a farm. */
export const deleteFertilizer = defineOperation({
  name: "deleteFertilizer",
  kind: "delete",
  bucket: "write",
  input: FertilizerParamsSchema,
  output: DeletedSchema,
  run: async ({ fdm, services, principal }: OperationContext<FertilizerServices>, { p_id }) => {
    await services.removeFertilizer(fdm, p_id, principal.effectivePrincipalId)
    return DELETED
  },
})
