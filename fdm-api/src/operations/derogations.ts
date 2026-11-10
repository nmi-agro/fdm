import type * as core from "@nmi-agro/fdm-core"
import { z } from "@hono/zod-openapi"
import { DerogationIdSchema, FarmIdSchema } from "../fields"
import { DELETED, DeletedSchema } from "./common"
import { defineOperation, type OperationContext } from "./types"

/** Defines the derogation data access functions required by the derogation operations. */
export interface DerogationServices {
  /** Lists the derogations granted to a farm. */
  listDerogations: typeof core.listDerogations
  /** Records a derogation for a farm and year. */
  addDerogation: typeof core.addDerogation
  /** Permanently deletes a derogation. */
  removeDerogation: typeof core.removeDerogation
}

/** A derogation granted to a farm for a calendar year. */
export const DerogationSchema = z
  .object({
    b_id_derogation: DerogationIdSchema,
    b_id_farm: FarmIdSchema,
    b_derogation_year: z
      .number()
      .int()
      .describe("Calendar year for which the farm is granted derogation, for example 2025."),
  })
  .openapi("Derogation")

/** Request body for recording a derogation. */
export const CreateDerogationBodySchema = z
  .object({
    b_derogation_year: z.number().int().describe("Derogation year."),
  })
  .openapi("CreateDerogation")

/** Path parameters that identify a farm. */
export const DerogationFarmParamsSchema = z.object({ b_id_farm: FarmIdSchema })

/** Path parameters that identify a derogation. */
export const DerogationParamsSchema = z.object({ b_id_derogation: DerogationIdSchema })

/** Lists the derogations granted to a farm. */
export const listDerogations = defineOperation({
  name: "listDerogations",
  kind: "read",
  bucket: "general",
  input: DerogationFarmParamsSchema,
  output: z.array(DerogationSchema),
  run: async (
    { fdm, services, principal }: OperationContext<DerogationServices>,
    { b_id_farm },
  ) => {
    const derogations = await services.listDerogations(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
    )
    // The records are returned as fdm-core stores them.
    return derogations as unknown as z.infer<typeof DerogationSchema>[]
  },
})

/** Records a derogation for a farm and calendar year. */
export const createDerogation = defineOperation({
  name: "createDerogation",
  kind: "create",
  bucket: "write",
  input: DerogationFarmParamsSchema.extend(CreateDerogationBodySchema.shape),
  output: DerogationSchema,
  run: async (
    { fdm, services, principal }: OperationContext<DerogationServices>,
    { b_id_farm, b_derogation_year },
  ) => {
    const b_id_derogation = await services.addDerogation(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      b_derogation_year,
    )
    return { b_id_derogation, b_id_farm, b_derogation_year }
  },
})

/** Permanently deletes a derogation. */
export const deleteDerogation = defineOperation({
  name: "deleteDerogation",
  kind: "delete",
  bucket: "write",
  input: DerogationParamsSchema,
  output: DeletedSchema,
  run: async (
    { fdm, services, principal }: OperationContext<DerogationServices>,
    { b_id_derogation },
  ) => {
    await services.removeDerogation(fdm, principal.effectivePrincipalId, b_id_derogation)
    return DELETED
  },
})
