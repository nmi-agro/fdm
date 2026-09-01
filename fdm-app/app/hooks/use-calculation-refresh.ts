import { useEffect, useRef, useState } from "react"
import type { CalculationJobRequest } from "~/lib/calculation-jobs"
import { getCalculationJobKey } from "~/lib/calculation-jobs"

/** Per-job outcome as reported by the `/api/calculation-refresh` NDJSON stream. */
export type CalculationRefreshJobState = "pending" | "computed" | "attached" | "error"

/**
 * Wire outcome from the NDJSON stream, which also includes `"timeout"`: the attach-wait loop gave
 * up without observing a terminal result. This is not a completed state — the job's cache entry
 * may still be processing — so it is never stored in `jobStates` directly; the corresponding job
 * is instead resubmitted until it resolves to a genuinely terminal outcome.
 */
type CalculationRefreshOutcome = CalculationRefreshJobState | "timeout"

export interface CalculationRefreshState {
  /** Per-job state, keyed by `getCalculationJobKey(job)`. Only contains jobs sent to the API. */
  jobStates: Map<string, CalculationRefreshJobState>
  /**
   * `true` once every job has finished (successfully or not). Fresh results now exist in the
   * database, but the currently rendered page data is not touched — the caller decides when to
   * show a "click to update" prompt and to call `useRevalidator().revalidate()`.
   */
  refreshReady: boolean
}

/**
 * Posts the given stale/missing calculation jobs to the background NDJSON refresh route and
 * tracks their completion incrementally, so callers can render a scoped spinner per field while a
 * job is in flight and a single "click to update" prompt once everything is done.
 *
 * Recomputation is deduplicated server-side via the `calculation_cache.is_processing` lock — if
 * the same job is already being computed (e.g. the user re-opened the page in another tab), this
 * hook attaches to it instead of triggering a duplicate calculation.
 *
 * Never silently swaps rendered data: it only exposes state for the UI to react to explicitly.
 */
export function useCalculationRefresh(jobs: CalculationJobRequest[]): CalculationRefreshState {
  const [jobStates, setJobStates] = useState<Map<string, CalculationRefreshJobState>>(() => {
    return new Map(jobs.map((job) => [getCalculationJobKey(job), "pending"]))
  })
  // Track the set of job keys we've already started a request for, so effect re-runs (e.g. from
  // unrelated re-renders) don't re-trigger the same batch.
  const startedKeyRef = useRef<string>("")
  const abortControllerRef = useRef<AbortController | null>(null)

  const batchKey = jobs.map(getCalculationJobKey).sort().join(",")

  useEffect(() => {
    // Check if the set of jobs is actually the same
    const keys = jobs.map(getCalculationJobKey)
    if (startedKeyRef.current === batchKey) {
      return
    }

    // Start a new set of jobs
    startedKeyRef.current = batchKey

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    if (jobs.length === 0) {
      setJobStates(new Map())
      return
    }

    setJobStates(new Map(keys.map((key) => [key, "pending"])))

    const controller = new AbortController()
    abortControllerRef.current = controller

    // Posts a (sub)batch of jobs and applies their outcomes. Jobs that come back as "timeout" are
    // not terminal — the underlying calculation may still be running elsewhere — so they are
    // resubmitted here instead of being reflected as done, until a real outcome arrives.
    async function postBatch(batchJobs: CalculationJobRequest[]) {
      const batchKeys = batchJobs.map(getCalculationJobKey)
      try {
        const response = await fetch("/api/calculation-refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobs: batchJobs }),
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          setJobStates((prev) => {
            const next = new Map(prev)
            for (const key of batchKeys) next.set(key, "error")
            return next
          })
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const parsed = JSON.parse(line) as {
                key: string
                outcome: CalculationRefreshOutcome
              }
              if (parsed.outcome === "timeout") {
                const retryJob = batchJobs.find((j) => getCalculationJobKey(j) === parsed.key)
                if (retryJob && !controller.signal.aborted) void postBatch([retryJob])
                continue
              }
              const outcome = parsed.outcome
              setJobStates((prev) => {
                const next = new Map(prev)
                next.set(parsed.key, outcome)
                return next
              })
            } catch {
              // Ignore malformed lines; the corresponding job simply stays "pending" and the
              // page keeps showing cached/stale data until the user next revalidates.
            }
          }
        }
      } catch {
        if (controller.signal.aborted) return
        setJobStates((prev) => {
          const next = new Map(prev)
          for (const key of batchKeys) {
            if (next.get(key) === "pending") next.set(key, "error")
          }
          return next
        })
      }
    }

    void postBatch(jobs)

    // oxlint-disable-next-line react-hooks/exhaustive-deps -- jobs is recreated every render; we dedupe on batchKey (derived from job keys) instead of the array identity.
  }, [batchKey])

  const refreshReady =
    jobStates.size > 0 && [...jobStates.values()].every((state) => state !== "pending")

  return { jobStates, refreshReady }
}
