import { useMemo } from "react"

export const ZOOM_LEVEL_FIELDS = 12

/**
 * A `Set` of `array`'s items, stable across renders (same identity) as long as its sorted
 * contents haven't changed — even when `array` itself is a new reference each time.
 */
export function useStableSet(array?: string[]) {
  const key = [...(array || [])].sort().join(",")
  return useMemo(() => new Set(key ? key.split(",") : []), [key])
}
