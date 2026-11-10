import type * as core from "@nmi-agro/fdm-core"
import { z } from "@hono/zod-openapi"
import { ApiError } from "../error"
import { FarmIdSchema } from "../fields"
import { consumeFarmCreation, type LimitServices } from "../limits"
import { DELETED, DeletedSchema } from "./common"
import { defineOperation, type OperationContext } from "./types"

/**
 * Defines the farm data access functions required by the farm operations.
 */
export interface FarmServices extends LimitServices {
  /** Returns all farms visible to the authenticated principal. */
  getFarms: typeof core.getFarms
  /** Returns a single farm visible to the authenticated principal. */
  getFarm: typeof core.getFarm
  /** Creates a new farm owned by the authenticated principal. */
  addFarm: typeof core.addFarm
  /** Enables a fertilizer catalogue for the farm. */
  enableFertilizerCatalogue: typeof core.enableFertilizerCatalogue
  /** Enables a cultivation catalogue for the farm. */
  enableCultivationCatalogue: typeof core.enableCultivationCatalogue
  /** Enables a field measure catalogue for the farm. */
  enableMeasureCatalogue: typeof core.enableMeasureCatalogue
  /** Lists the fertilizers in the catalogues enabled on a farm. */
  getFertilizersFromCatalogue: typeof core.getFertilizersFromCatalogue
  /** Adds a catalogue fertilizer to the farm's fertilizer list. */
  addFertilizer: typeof core.addFertilizer
  /** Updates the metadata of an existing farm. */
  updateFarm: typeof core.updateFarm
  /** Permanently deletes a farm and all its associated resources. */
  removeFarm: typeof core.removeFarm
  /** Returns a farm group, used to filter farms by group. */
  getFarmGroup: typeof core.getFarmGroup
}

/** A farm as returned by the API. */
export const FarmSchema = z
  .object({
    b_id_farm: FarmIdSchema,
    b_name_farm: z.string().nullable().describe("Farm display name. `null` when not set."),
    b_businessid_farm: z
      .string()
      .nullable()
      .describe("Chamber of commerce or business registration number. `null` when not set."),
    b_address_farm: z
      .string()
      .nullable()
      .describe("Street address of the farm. `null` when not set."),
    b_postalcode_farm: z
      .string()
      .nullable()
      .describe("Postal code of the farm address. `null` when not set."),
  })
  .openapi("Farm")

/** Request body for creating a farm. */
export const CreateFarmBodySchema = z
  .object({
    b_name_farm: z.string().optional().describe("Farm display name."),
    b_businessid_farm: z
      .string()
      .nullable()
      .optional()
      .describe("Chamber of commerce or business registration number."),
    b_address_farm: z.string().nullable().optional().describe("Street address of the farm."),
    b_postalcode_farm: z
      .string()
      .nullable()
      .optional()
      .describe("Postal code of the farm address."),
  })
  .openapi("CreateFarm")

/** Request body for updating a farm. Only supplied fields are changed. */
export const UpdateFarmBodySchema = z
  .object({
    b_name_farm: z.string().nullable().optional().describe("Farm display name."),
    b_businessid_farm: z
      .string()
      .nullable()
      .optional()
      .describe("Chamber of commerce or business registration number."),
    b_address_farm: z.string().nullable().optional().describe("Street address of the farm."),
    b_postalcode_farm: z
      .string()
      .nullable()
      .optional()
      .describe("Postal code of the farm address."),
  })
  .openapi("UpdateFarm")

/** Path parameters that identify a farm. */
export const FarmParamsSchema = z.object({ b_id_farm: FarmIdSchema })

/** Filters for listing farms. */
export const ListFarmsFilterSchema = z.object({
  b_id_group: z
    .string()
    .optional()
    .describe("Only list the farms that are a member of this group."),
})

function serialiseFarm(farm: {
  b_id_farm: string
  b_name_farm: string | null
  b_businessid_farm: string | null
  b_address_farm: string | null
  b_postalcode_farm: string | null
}): z.infer<typeof FarmSchema> {
  return {
    b_id_farm: farm.b_id_farm,
    b_name_farm: farm.b_name_farm ?? null,
    b_businessid_farm: farm.b_businessid_farm ?? null,
    b_address_farm: farm.b_address_farm ?? null,
    b_postalcode_farm: farm.b_postalcode_farm ?? null,
  }
}

/** Lists the farms the principal can access, optionally only those in a farm group. */
export const listFarms = defineOperation({
  name: "listFarms",
  kind: "read",
  bucket: "general",
  input: ListFarmsFilterSchema,
  output: z.array(FarmSchema),
  run: async ({ fdm, services, principal }: OperationContext<FarmServices>, { b_id_group }) => {
    let farms = await services.getFarms(fdm, principal.effectivePrincipalId)
    if (b_id_group) {
      const group = await services.getFarmGroup(fdm, principal.effectivePrincipalId, b_id_group)
      const members = new Set(group.b_id_farms)
      farms = farms.filter((farm) => members.has(farm.b_id_farm))
    }
    return farms.map(serialiseFarm)
  },
})

/** Returns a single farm. */
export const getFarm = defineOperation({
  name: "getFarm",
  kind: "read",
  bucket: "general",
  input: FarmParamsSchema,
  output: FarmSchema,
  run: async ({ fdm, services, principal }: OperationContext<FarmServices>, { b_id_farm }) => {
    const farm = await services.getFarm(fdm, principal.effectivePrincipalId, b_id_farm)
    if (!farm?.b_id_farm) {
      throw new ApiError(404, "not-found", `Farm '${b_id_farm}' not found.`)
    }
    return serialiseFarm(farm)
  },
})

/**
 * Creates a farm owned by the principal, enables the default catalogues and adds the
 * catalogue fertilizers to the farm, all in one transaction.
 */
export const createFarm = defineOperation({
  name: "createFarm",
  kind: "create",
  bucket: "write",
  input: CreateFarmBodySchema,
  output: FarmSchema,
  run: async ({ fdm, services, principal }: OperationContext<FarmServices>, body) => {
    await consumeFarmCreation(fdm, principal.userId)
    const farm = await fdm.transaction(async (tx) => {
      // Add the farm.
      const b_id_farm = await services.addFarm(
        tx,
        principal.effectivePrincipalId,
        body.b_name_farm ?? null,
        body.b_businessid_farm ?? null,
        body.b_address_farm ?? null,
        body.b_postalcode_farm ?? null,
      )
      // Enable default catalogues.
      const fertilizerCatalogueEnablement = ["baat", b_id_farm].map((p_source) =>
        services.enableFertilizerCatalogue(tx, principal.effectivePrincipalId, b_id_farm, p_source),
      )
      const cultivationCatalogueEnablement = ["brp"].map((b_lu_source) =>
        services.enableCultivationCatalogue(
          tx,
          principal.effectivePrincipalId,
          b_id_farm,
          b_lu_source,
        ),
      )
      const measureCatalogueEnablement = ["bln"].map((m_source) =>
        services.enableMeasureCatalogue(tx, principal.effectivePrincipalId, b_id_farm, m_source),
      )
      const catEnablementResult = await Promise.allSettled([
        ...fertilizerCatalogueEnablement,
        ...cultivationCatalogueEnablement,
        ...measureCatalogueEnablement,
      ])
      for (const result of catEnablementResult) {
        if (result.status === "rejected") {
          throw result.reason
        }
      }
      // Add the catalogue fertilizers to the farm's fertilizer list.
      const fertilizers = await services.getFertilizersFromCatalogue(
        tx,
        principal.effectivePrincipalId,
        b_id_farm,
      )
      const addFertilizerResults = await Promise.allSettled(
        fertilizers.map((fertilizer) =>
          services.addFertilizer(
            tx,
            principal.effectivePrincipalId,
            fertilizer.p_id_catalogue,
            b_id_farm,
            null,
            null,
          ),
        ),
      )
      const rejectedAddFertilizer = addFertilizerResults.find((r) => r.status === "rejected")
      if (rejectedAddFertilizer) {
        throw rejectedAddFertilizer.reason
      }
      // Get the newly created farm.
      const farm = await services.getFarm(tx, principal.effectivePrincipalId, b_id_farm)
      if (!farm?.b_id_farm) {
        throw new ApiError(500, "internal-error", "Farm created but could not be retrieved.")
      }
      return farm
    })
    return serialiseFarm(farm)
  },
})

/** Changes the supplied metadata fields of a farm and keeps the others. */
export const updateFarm = defineOperation({
  name: "updateFarm",
  kind: "update",
  bucket: "write",
  input: FarmParamsSchema.extend(UpdateFarmBodySchema.shape),
  output: FarmSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FarmServices>,
    { b_id_farm, ...body },
  ) => {
    if (Object.values(body).every((v) => v === undefined)) {
      throw new ApiError(400, "validation-failed", "At least one field must be provided.")
    }
    const existing = await services.getFarm(fdm, principal.effectivePrincipalId, b_id_farm)
    if (!existing?.b_id_farm) {
      throw new ApiError(404, "not-found", `Farm '${b_id_farm}' not found.`)
    }
    const updated = await services.updateFarm(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      body.b_name_farm !== undefined ? body.b_name_farm : existing.b_name_farm,
      body.b_businessid_farm !== undefined ? body.b_businessid_farm : existing.b_businessid_farm,
      body.b_address_farm !== undefined ? body.b_address_farm : existing.b_address_farm,
      body.b_postalcode_farm !== undefined ? body.b_postalcode_farm : existing.b_postalcode_farm,
    )
    if (!updated?.b_id_farm) {
      throw new ApiError(404, "not-found", `Farm '${b_id_farm}' not found.`)
    }
    return serialiseFarm(updated)
  },
})

/** Permanently deletes a farm with its fields, cultivations and soil analyses. */
export const deleteFarm = defineOperation({
  name: "deleteFarm",
  kind: "delete",
  bucket: "write",
  input: FarmParamsSchema,
  output: DeletedSchema,
  run: async ({ fdm, services, principal }: OperationContext<FarmServices>, { b_id_farm }) => {
    await services.removeFarm(fdm, principal.effectivePrincipalId, b_id_farm)
    return DELETED
  },
})
