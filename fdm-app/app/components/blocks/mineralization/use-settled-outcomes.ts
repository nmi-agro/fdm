import { useEffect, useState } from "react"
import type { FieldMineralizationOutcome } from "~/lib/mineralization"

/**
 * Collects the per-field outcomes as their promises settle.
 *
 * Outcomes from an earlier load stay visible until the new outcome of that field arrives, so a
 * revalidation does not flash the table back to skeletons.
 *
 * @param rows - Fields with their streamed outcome.
 * @returns The settled outcomes by `b_id`.
 */
export function useSettledOutcomes(
  rows: { b_id: string; outcome: Promise<FieldMineralizationOutcome> }[],
): Record<string, FieldMineralizationOutcome> {
  const [settled, setSettled] = useState<Record<string, FieldMineralizationOutcome>>({})

  useEffect(() => {
    let cancelled = false
    for (const row of rows) {
      void row.outcome.then((outcome) => {
        if (!cancelled) setSettled((prev) => ({ ...prev, [row.b_id]: outcome }))
      })
    }
    return () => {
      cancelled = true
    }
  }, [rows])

  return settled
}
