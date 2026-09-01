import { useEffect, useState } from "react"

export const ZOOM_LEVEL_FIELDS = 12

export function useStableSet<T>(array?: T[]) {
  const [set, setSet] = useState<Set<T>>(new Set(array))
  useEffect(() => {
    // if items have changed update our set
    const newSorted = [...(array || [])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    const currentSorted = [...set].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    if (
      newSorted.length !== currentSorted.length ||
      newSorted.some((v, i) => v !== currentSorted[i])
    ) {
      setSet(new Set(newSorted))
    }
  }, [array, set])
  return set
}
