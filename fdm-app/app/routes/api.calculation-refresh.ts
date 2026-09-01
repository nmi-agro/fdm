import type { ActionFunctionArgs } from "react-router"
import { getSession } from "~/lib/auth.server"
import {
  type CalculationJobRequest,
  type CalculationJobType,
  getCalculationJobKey,
} from "~/lib/calculation-jobs"
import { runCalculationJob } from "~/lib/calculation-jobs.server"
import { fdm } from "~/lib/fdm.server"

/**
 * API Route: Background recompute for cached farm/organization-level calculations
 *
 * WHY THIS EXISTS:
 * Farm- and organization-level pages for nitrogen balance, norms, and nutrient advice render
 * immediately from whatever is already cached per field (see the loaders for those routes).
 * Any field whose cache entry is missing or stale (its input hash changed) still needs to be
 * recomputed — but that must not block the initial page response. This route lets the client
 * kick off those recomputations after the page has already rendered.
 *
 * THIS SOLUTION:
 * 1. The client posts the list of stale/missing jobs identified by the loader.
 * 2. The server recomputes them in parallel (bounded concurrency), attaching to (rather than
 *    duplicating) any recompute already in flight via the `calculation_cache.is_processing` lock.
 * 3. Results are streamed back as NDJSON (Newline Delimited JSON), one line per completed job, so
 *    the client can clear per-field spinners as they finish and show a single "click to update"
 *    prompt once everything is done — instead of waiting for every field before showing anything.
 *
 * No new infrastructure (SSE/websockets/queues) is introduced; this follows the same pattern as
 * `api.soil-analysis.extract.ts`. Each job is bounded, cheap-to-collect-input work plus at most
 * one real calculation, keeping the request compatible with the platform's request timeout.
 */

const JOB_TYPES: CalculationJobType[] = [
  "nitrogenBalance",
  "nutrientAdvice",
  "normNitrogen",
  "normPhosphate",
  "normManure",
  "normRenure",
]

/** Bounds how much recompute work a single request can trigger; excess jobs are dropped. */
const MAX_JOBS_PER_BATCH = 100

function parseJob(value: unknown): CalculationJobRequest | null {
  if (!value || typeof value !== "object") return null
  const job = value as Record<string, unknown>
  if (typeof job.type !== "string" || !JOB_TYPES.includes(job.type as CalculationJobType)) {
    return null
  }
  if (typeof job.b_id !== "string" || !job.b_id) return null
  if (typeof job.b_id_farm !== "string" || !job.b_id_farm) return null
  if (typeof job.calendar !== "string" || !job.calendar) return null

  return {
    type: job.type as CalculationJobType,
    b_id: job.b_id,
    b_id_farm: job.b_id_farm,
    calendar: job.calendar,
  }
}

export async function action({ request }: ActionFunctionArgs) {
  // Single session check for the entire batch of jobs; per-job authorization is enforced by the
  // underlying fdm-core reads (getField, getFarm, checkPermission, ...) triggered while collecting
  // each job's input, so a job for a farm/field the caller cannot access simply fails as an error.
  const session = await getSession(request)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const rawJobs = Array.isArray((body as { jobs?: unknown[] })?.jobs)
    ? (body as { jobs: unknown[] }).jobs
    : []
  const parsedJobs = rawJobs
    .map(parseJob)
    .filter((job): job is CalculationJobRequest => job !== null)

  // Deduplicate by job key so a client retry/re-render can't cause the same job to be processed
  // (and reported) more than once in a batch, then cap the batch size to bound server work.
  const seenKeys = new Set<string>()
  const jobs: CalculationJobRequest[] = []
  for (const job of parsedJobs) {
    const key = getCalculationJobKey(job)
    if (seenKeys.has(key)) continue
    seenKeys.add(key)
    jobs.push(job)
    if (jobs.length >= MAX_JOBS_PER_BATCH) break
  }

  if (jobs.length === 0) {
    return new Response(JSON.stringify({ error: "No valid jobs provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let nextIndex = 0
      const concurrency = 4

      const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
        while (nextIndex < jobs.length) {
          const job = jobs[nextIndex++]
          if (!job) continue

          try {
            const result = await runCalculationJob(
              {
                fdm,
                principal_id: session.principal_id,
                timeframe: {
                  start: new Date(`${job.calendar}-01-01T00:00:00.000Z`),
                  end: new Date(`${job.calendar}-12-31T23:59:59.999Z`),
                },
              },
              job,
            )

            controller.enqueue(
              encoder.encode(
                `${JSON.stringify({
                  key: getCalculationJobKey(job),
                  outcome: result.outcome,
                  error: result.error,
                })}\n`,
              ),
            )
          } catch (err) {
            controller.enqueue(
              encoder.encode(
                `${JSON.stringify({
                  key: getCalculationJobKey(job),
                  outcome: "error",
                  error: err instanceof Error ? err.message : "Recompute mislukt",
                })}\n`,
              ),
            )
          }
        }
      })

      await Promise.all(workers)
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
