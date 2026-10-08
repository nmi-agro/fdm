import { useMemo, useSyncExternalStore } from "react"

const noopSubscribe = () => () => {}

function getTodayKey(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getTodayKeyServerSnapshot(): string | undefined {
  return undefined
}

/**
 * Client-only "today" (day granularity), safe to call during render. Returns `undefined` during
 * SSR and on the first client render before hydration, to avoid a hydration mismatch — the
 * component should treat that as "unknown yet" rather than falling back to another `new Date()`.
 */
export function useToday(): Date | undefined {
  const key = useSyncExternalStore(noopSubscribe, getTodayKey, getTodayKeyServerSnapshot)
  return useMemo(() => {
    if (!key) return undefined
    const [year, month, day] = key.split("-").map(Number)
    return new Date(year, month - 1, day)
  }, [key])
}
