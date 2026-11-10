import { type FdmType, fdmSchema } from "@nmi-agro/fdm-core"
import { count, inArray } from "drizzle-orm"
import { ApiError } from "./error"
import { consumeWindow } from "./rate-limit"

/**
 * Usage limits of the API and the MCP server that protect the service against misuse. The web
 * application does not use these limits.
 */
export const USAGE_LIMITS = {
  /** Largest number of fields a farm may have. Larger farms are not supported through the API. */
  maxFieldsPerFarm: 500,
  /**
   * Largest number of farms one user may create through the API in 24 hours, across all their
   * API keys. The 24 hours start at the first farm the user creates in a new window.
   */
  maxFarmsCreatedPerDay: 10,
} as const

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Counts the fields of each farm: every field that was ever linked to the farm, including fields
 * that the farm no longer manages.
 *
 * @param fdm - Database to query.
 * @param b_id_farms - Identifiers of the farms to count.
 * @returns The number of fields per farm identifier. Farms without fields are left out.
 */
export type CountFieldsOfFarms = (
  fdm: FdmType,
  b_id_farms: string[],
) => Promise<Record<string, number>>

/**
 * Default implementation of {@link CountFieldsOfFarms}, reading the `field_acquiring` table.
 */
export const countFieldsOfFarms: CountFieldsOfFarms = async (fdm, b_id_farms) => {
  if (b_id_farms.length === 0) return {}
  const rows = await fdm
    .select({ b_id_farm: fdmSchema.fieldAcquiring.b_id_farm, fields: count() })
    .from(fdmSchema.fieldAcquiring)
    .where(inArray(fdmSchema.fieldAcquiring.b_id_farm, b_id_farms))
    .groupBy(fdmSchema.fieldAcquiring.b_id_farm)
  return Object.fromEntries(rows.map((row) => [row.b_id_farm, Number(row.fields)]))
}

/** The services the usage limits need. */
export interface LimitServices {
  /** Counts the fields of farms, to enforce the maximum farm size. */
  countFieldsOfFarms: CountFieldsOfFarms
}

/**
 * Refuses farm-level reads and calculations for farms larger than the supported size.
 *
 * @param fdm - Database to query.
 * @param services - Provides `countFieldsOfFarms`.
 * @param b_id_farms - The farm or farms the operation covers.
 * @throws {ApiError} 422 `unprocessable-entity` when a farm has more fields than {@link USAGE_LIMITS}.maxFieldsPerFarm.
 */
export async function assertFarmSizeSupported(
  fdm: FdmType,
  services: LimitServices,
  b_id_farms: string | string[],
): Promise<void> {
  const ids = Array.isArray(b_id_farms) ? b_id_farms : [b_id_farms]
  const counts = await services.countFieldsOfFarms(fdm, ids)
  const tooLarge = ids.find((id) => (counts[id] ?? 0) > USAGE_LIMITS.maxFieldsPerFarm)
  if (tooLarge) {
    throw new ApiError(
      422,
      "unprocessable-entity",
      `Farm '${tooLarge}' has more than ${USAGE_LIMITS.maxFieldsPerFarm} fields. Farms of this size are not supported through the API.`,
    )
  }
}

/**
 * Refuses new fields that would take a farm over the supported size.
 *
 * @param fdm - Database to query.
 * @param services - Provides `countFieldsOfFarms`.
 * @param b_id_farm - The farm that receives the fields.
 * @param adding - Number of fields to add.
 * @throws {ApiError} 422 `unprocessable-entity` when the farm would have more fields than {@link USAGE_LIMITS}.maxFieldsPerFarm.
 */
export async function assertFieldCapacity(
  fdm: FdmType,
  services: LimitServices,
  b_id_farm: string,
  adding: number,
): Promise<void> {
  const counts = await services.countFieldsOfFarms(fdm, [b_id_farm])
  const current = counts[b_id_farm] ?? 0
  if (current + adding > USAGE_LIMITS.maxFieldsPerFarm) {
    throw new ApiError(
      422,
      "unprocessable-entity",
      `A farm can have at most ${USAGE_LIMITS.maxFieldsPerFarm} fields through the API. Farm '${b_id_farm}' has ${current}, so ${adding} more cannot be added.`,
    )
  }
}

/**
 * Counts a farm creation for a user and refuses it when the user already created the maximum
 * number of farms in the current 24-hour window, across all their API keys.
 *
 * @param fdm - Database used to store the count.
 * @param userId - The user who creates the farm.
 * @throws {ApiError} 429 `rate-limit-exceeded`, with a `Retry-After` header, when the limit is reached.
 */
export async function consumeFarmCreation(fdm: FdmType, userId: string): Promise<void> {
  const result = await consumeWindow(
    fdm,
    `fdm-api:farms-created:${userId}`,
    USAGE_LIMITS.maxFarmsCreatedPerDay,
    DAY_MS,
  )
  if (!result.allowed) {
    throw new ApiError(
      429,
      "rate-limit-exceeded",
      `You can create at most ${USAGE_LIMITS.maxFarmsCreatedPerDay} farms per 24 hours through the API. Try again in ${result.resetIn}s.`,
      { retry_after: result.resetIn },
      undefined,
      { "Retry-After": String(result.resetIn) },
    )
  }
}
