import { useEffect, useMemo, useState } from "react"

/** Rows received so far from a list of streamed promises. */
export type StreamedRows<T> = {
  /** One entry per promise, in the same order; `undefined` until that promise has resolved. */
  rows: (T | undefined)[]
  /** Number of promises that have settled (resolved or rejected). */
  settled: number
  /** Number of promises. */
  total: number
  /** `true` once every promise has settled. */
  complete: boolean
  /** `true` when at least one promise rejected (a network or transport error). */
  failed: boolean
}

type ResolvedState<T> = {
  source: Promise<T>[]
  rows: (T | undefined)[]
  settled: number
  failed: boolean
}

/**
 * Resolves a list of streamed promises (for example one per field, returned by a React Router
 * loader) into state, one row at a time, so the page can show each row as soon as it arrives.
 *
 * Deliberately not `Suspense` + `use()`: that would wait for the slowest promise, and a map source
 * must stay mounted while the data loads. The received rows are stored together with the array they
 * came from, so a new array (farm or year switch, retry) reads as "nothing received yet" during
 * render instead of resetting state inside the effect, which `react/set-state-in-effect` forbids.
 * State is only set from the async callbacks.
 *
 * A rejected promise (network or transport error) sets `failed`; rows that already arrived are
 * kept.
 *
 * @param promises - Streamed promises, or `null` when there is nothing to load.
 * @returns The rows received so far and the loading progress.
 */
export function useStreamedRows<T>(promises: Promise<T>[] | null): StreamedRows<T> {
  const [resolved, setResolved] = useState<ResolvedState<T> | null>(null)

  useEffect(() => {
    if (!promises) return
    let cancelled = false

    const update = (index: number, row: T | undefined, failed: boolean) => {
      if (cancelled) return
      setResolved((previous) => {
        const base =
          previous && previous.source === promises
            ? previous
            : {
                source: promises,
                rows: Array.from<T | undefined>({ length: promises.length }),
                settled: 0,
                failed: false,
              }
        const rows = base.rows.slice()
        rows[index] = row
        return {
          source: promises,
          rows,
          settled: base.settled + 1,
          failed: base.failed || failed,
        }
      })
    }

    promises.forEach((promise, index) => {
      promise.then(
        (row) => update(index, row, false),
        (error: unknown) => {
          console.error("Failed to load a streamed row:", error)
          update(index, undefined, true)
        },
      )
    })

    return () => {
      cancelled = true
    }
  }, [promises])

  const total = promises?.length ?? 0
  // Stable empty list, so memoised consumers do not recompute on every render.
  const empty = useMemo(() => Array.from<T | undefined>({ length: total }), [total])
  // A result from a previous array is stale and reads as "nothing received yet".
  const current = resolved && resolved.source === promises ? resolved : null
  const settled = current?.settled ?? 0
  return {
    rows: current?.rows ?? empty,
    settled,
    total,
    complete: settled >= total,
    failed: current?.failed ?? false,
  }
}
