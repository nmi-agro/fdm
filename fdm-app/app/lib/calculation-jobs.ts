/**
 * Isomorphic (client + server safe) types and helpers for the per-field calculation jobs used by
 * the cached-while-recomputing farm/organization-level pages (nitrogen balance, norms, nutrient
 * advice). The actual calculation/locking logic lives in `calculation-jobs.server.ts`, which is
 * server-only; this file only holds the shared shape so client components can reference it too.
 */

/** The calculation job types that support cached-while-recomputing behavior. */
export type CalculationJobType =
  | "nitrogenBalance"
  | "nutrientAdvice"
  | "normNitrogen"
  | "normPhosphate"
  | "normManure"
  | "normRenure"

/** Identifies a single per-field calculation job. */
export interface CalculationJobRequest {
  type: CalculationJobType
  b_id: string
  b_id_farm: string
  calendar: string
}

/** A unique string key for a job, suitable for use as a client-side map key / NDJSON identifier. */
export function getCalculationJobKey(job: CalculationJobRequest): string {
  return `${job.type}:${job.calendar}:${job.b_id}`
}
