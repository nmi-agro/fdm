import type * as core from "@nmi-agro/fdm-core"
import { z } from "@hono/zod-openapi"
import { ApiError } from "../error"
import { FarmIdSchema, OrganicCertificationIdSchema } from "../fields"
import { DateStringSchema, serializeDate } from "../schemas"
import { DELETED, DeletedSchema } from "./common"
import { defineOperation, type OperationContext } from "./types"

/** Defines the organic certification data access functions required by the organic certification operations. */
export interface OrganicCertificationServices {
  /** Lists the organic certifications of a farm. */
  listOrganicCertifications: typeof core.listOrganicCertifications
  /** Adds an organic certification to a farm. */
  addOrganicCertification: typeof core.addOrganicCertification
  /** Returns a single organic certification. */
  getOrganicCertification: typeof core.getOrganicCertification
  /** Permanently deletes an organic certification. */
  removeOrganicCertification: typeof core.removeOrganicCertification
}

/** An organic certification of a farm. */
export const OrganicCertificationSchema = z
  .object({
    b_id_organic: OrganicCertificationIdSchema,
    b_organic_traces: z
      .string()
      .nullable()
      .describe("TRACES number of the organic certificate. `null` when not set."),
    b_organic_skal: z
      .string()
      .nullable()
      .describe("SKAL number of the organic certificate. `null` when not set."),
    b_organic_issued: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    b_organic_expires: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
  })
  .openapi("OrganicCertification")

/** Request body for adding an organic certification to a farm. */
export const CreateOrganicCertificationBodySchema = z
  .object({
    b_organic_traces: z.string().nullable().optional().describe("Organic TRACES number."),
    b_organic_skal: z.string().nullable().optional().describe("Organic SKAL number."),
    b_organic_issued: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    b_organic_expires: DateStringSchema.describe("Date in YYYY-MM-DD format."),
  })
  .openapi("CreateOrganicCertification")

/** Path parameters that identify a farm. */
export const OrganicCertificationFarmParamsSchema = z.object({ b_id_farm: FarmIdSchema })

/** Path parameters that identify an organic certification. */
export const OrganicCertificationParamsSchema = z.object({
  b_id_organic: OrganicCertificationIdSchema,
})

function serialiseOrganicCertification(
  certification: core.OrganicCertification,
): z.infer<typeof OrganicCertificationSchema> {
  return {
    b_id_organic: certification.b_id_organic,
    b_organic_traces: certification.b_organic_traces ?? null,
    b_organic_skal: certification.b_organic_skal ?? null,
    b_organic_issued: serializeDate(certification.b_organic_issued),
    b_organic_expires: serializeDate(certification.b_organic_expires),
  }
}

/** Lists the organic certifications of a farm. */
export const listOrganicCertifications = defineOperation({
  name: "listOrganicCertifications",
  kind: "read",
  bucket: "general",
  input: OrganicCertificationFarmParamsSchema,
  output: z.array(OrganicCertificationSchema),
  run: async (
    { fdm, services, principal }: OperationContext<OrganicCertificationServices>,
    { b_id_farm },
  ) => {
    const certifications = await services.listOrganicCertifications(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
    )
    return certifications.map(serialiseOrganicCertification)
  },
})

/** Adds an organic certification to a farm. */
export const createOrganicCertification = defineOperation({
  name: "createOrganicCertification",
  kind: "create",
  bucket: "write",
  input: OrganicCertificationFarmParamsSchema.extend(CreateOrganicCertificationBodySchema.shape),
  output: OrganicCertificationSchema,
  run: async (
    { fdm, services, principal }: OperationContext<OrganicCertificationServices>,
    { b_id_farm, ...body },
  ) => {
    const b_id_organic = await services.addOrganicCertification(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      body.b_organic_traces ?? null,
      body.b_organic_skal ?? null,
      new Date(body.b_organic_issued),
      new Date(body.b_organic_expires),
    )
    const certification = await services.getOrganicCertification(
      fdm,
      principal.effectivePrincipalId,
      b_id_organic,
    )
    if (!certification?.b_id_organic) {
      throw new ApiError(
        500,
        "internal-error",
        "Organic certification created but could not be retrieved.",
      )
    }
    return serialiseOrganicCertification(certification)
  },
})

/** Returns a single organic certification. */
export const getOrganicCertification = defineOperation({
  name: "getOrganicCertification",
  kind: "read",
  bucket: "general",
  input: OrganicCertificationParamsSchema,
  output: OrganicCertificationSchema,
  run: async (
    { fdm, services, principal }: OperationContext<OrganicCertificationServices>,
    { b_id_organic },
  ) => {
    const certification = await services.getOrganicCertification(
      fdm,
      principal.effectivePrincipalId,
      b_id_organic,
    )
    if (!certification?.b_id_organic) {
      throw new ApiError(404, "not-found", `Organic certification '${b_id_organic}' not found.`)
    }
    return serialiseOrganicCertification(certification)
  },
})

/** Permanently deletes an organic certification. */
export const deleteOrganicCertification = defineOperation({
  name: "deleteOrganicCertification",
  kind: "delete",
  bucket: "write",
  input: OrganicCertificationParamsSchema,
  output: DeletedSchema,
  run: async (
    { fdm, services, principal }: OperationContext<OrganicCertificationServices>,
    { b_id_organic },
  ) => {
    await services.removeOrganicCertification(fdm, principal.effectivePrincipalId, b_id_organic)
    return DELETED
  },
})
