import type * as core from "@nmi-agro/fdm-core"
import { z } from "@hono/zod-openapi"
import { FarmIdSchema } from "../fields"
import { DELETED, DeletedSchema } from "./common"
import { FarmParamsSchema } from "./farms"
import { defineOperation, type OperationContext } from "./types"

/** Defines the grazing intention data access functions required by the grazing intention operations. */
export interface GrazingIntentionServices {
  /** Returns the grazing intentions of a farm for all years. */
  getGrazingIntentions: typeof core.getGrazingIntentions
  /** Creates or replaces the grazing intention of a farm for a year. */
  setGrazingIntention: typeof core.setGrazingIntention
  /** Deletes the grazing intention of a farm for a year. */
  removeGrazingIntention: typeof core.removeGrazingIntention
}

/** The grazing intention of a farm for one calendar year. */
export const GrazingIntentionSchema = z
  .object({
    b_id_farm: FarmIdSchema,
    b_grazing_intention_year: z
      .number()
      .int()
      .describe("Calendar year the grazing intention applies to, for example 2025."),
    b_grazing_intention: z
      .boolean()
      .describe("Whether the farm intends to graze livestock in that year."),
  })
  .openapi("GrazingIntention")

/** Request body for setting a grazing intention. */
export const SetGrazingIntentionBodySchema = z
  .object({
    b_grazing_intention: z
      .boolean()
      .describe("Whether the farm intends to graze in the specified year."),
  })
  .openapi("SetGrazingIntention")

/** Path parameters that identify the grazing intention of a farm for a year. */
export const GrazingIntentionParamsSchema = z.object({
  b_id_farm: FarmIdSchema,
  b_grazing_intention_year: z.coerce
    .number()
    .int()
    .openapi({ type: "integer", param: { required: true } })
    .describe("Calendar year the grazing intention applies to, for example 2025."),
})

/** Lists the grazing intentions of a farm. */
export const listGrazingIntentions = defineOperation({
  name: "listGrazingIntentions",
  kind: "read",
  bucket: "general",
  input: FarmParamsSchema,
  output: z.array(GrazingIntentionSchema),
  run: async (
    { fdm, services, principal }: OperationContext<GrazingIntentionServices>,
    { b_id_farm },
  ) => {
    const intentions = await services.getGrazingIntentions(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
    )
    // The stored rows are returned as they are, so the REST response keeps any additional
    // columns (such as `created` and `updated`) that it has always included.
    return intentions as unknown as z.infer<typeof GrazingIntentionSchema>[]
  },
})

/** Creates or replaces the grazing intention of a farm for a year. */
export const setGrazingIntention = defineOperation({
  name: "setGrazingIntention",
  kind: "update",
  bucket: "write",
  input: GrazingIntentionParamsSchema.extend(SetGrazingIntentionBodySchema.shape),
  output: GrazingIntentionSchema,
  run: async (
    { fdm, services, principal }: OperationContext<GrazingIntentionServices>,
    { b_id_farm, b_grazing_intention_year, b_grazing_intention },
  ) => {
    await services.setGrazingIntention(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      b_grazing_intention_year,
      b_grazing_intention,
    )
    return { b_id_farm, b_grazing_intention_year, b_grazing_intention }
  },
})

/** Deletes the grazing intention of a farm for a year. */
export const deleteGrazingIntention = defineOperation({
  name: "deleteGrazingIntention",
  kind: "delete",
  bucket: "write",
  input: GrazingIntentionParamsSchema,
  output: DeletedSchema,
  run: async (
    { fdm, services, principal }: OperationContext<GrazingIntentionServices>,
    { b_id_farm, b_grazing_intention_year },
  ) => {
    await services.removeGrazingIntention(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      b_grazing_intention_year,
    )
    return DELETED
  },
})
