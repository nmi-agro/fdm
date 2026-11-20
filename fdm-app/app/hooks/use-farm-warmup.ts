import { useEffect } from "react"

/** How long a warm-up of a farm and year counts as recent, so it is not requested again. */
export const FARM_WARMUP_INTERVAL_MS = 5 * 60 * 1000

/** Prefix of the `localStorage` keys that hold when a farm and year were last warmed. */
const STORAGE_PREFIX = "fdm-farm-warmup"

/**
 * Returns whether a warm-up of the farm and year should be requested now, and if so, records
 * the moment in `localStorage`, so other tabs of this browser skip it too.
 *
 * @param key - The storage key of the farm and year.
 * @param now - The current time in milliseconds.
 * @returns `false` when the farm and year were warmed less than {@link FARM_WARMUP_INTERVAL_MS} ago.
 */
export function claimFarmWarmup(key: string, now: number): boolean {
  try {
    const last = Number(window.localStorage.getItem(key))
    if (last > 0 && now - last >= 0 && now - last < FARM_WARMUP_INTERVAL_MS) return false
    window.localStorage.setItem(key, String(now))
  } catch {
    // Without storage, warm anyway: the server joins a warm-up that is already running
  }
  return true
}

/**
 * Removes the claim of a warm-up that did not reach the server, so the next visit tries again.
 *
 * @param key - The storage key of the farm and year.
 */
export function releaseFarmWarmup(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Without storage there is no claim to remove
  }
}

/**
 * Asks the server to fill the calculation cache of a farm for a calendar year, after the page
 * has rendered, so the indicators, measures, nutrient advice, usage norms and balance pages open
 * faster.
 *
 * The request is fire-and-forget: nothing waits for it, and a failure is not shown (the server
 * reports it). It is a plain `fetch` rather than a fetcher, so it does not revalidate the
 * loaders of the page when it finishes, and it uses `keepalive`, so it stays open when the user
 * leaves the page. A farm and year are warmed at most once per {@link FARM_WARMUP_INTERVAL_MS}
 * per browser; a request that fails releases its claim, so the next visit tries again.
 *
 * @param b_id_farm - The farm.
 * @param calendar - The calendar year (e.g. `"2026"`).
 * @param enabled - `false` to skip the warm-up, for example for a farm without fields.
 */
export function useFarmWarmup(b_id_farm: string, calendar: string, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const key = `${STORAGE_PREFIX}:${b_id_farm}:${calendar}`
    if (!claimFarmWarmup(key, Date.now())) return
    fetch(`/api/farm/${encodeURIComponent(b_id_farm)}/warm`, {
      method: "POST",
      body: new URLSearchParams({ calendar }),
      keepalive: true,
    })
      .then((response) => {
        if (!response.ok) releaseFarmWarmup(key)
      })
      .catch(() => releaseFarmWarmup(key))
  }, [b_id_farm, calendar, enabled])
}
