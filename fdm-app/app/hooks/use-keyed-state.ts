import { useCallback, useLayoutEffect, useRef, useState } from "react"

/**
 * State that resets to `initial(key)` whenever `key` changes, without setting state during render
 * or in an effect. A value set by the user only counts for the key it was set under.
 *
 * The returned setter is referentially stable across renders, like `useState`'s own setter, so it
 * can safely be included in a `useEffect`/`useCallback`/`useMemo` dependency array.
 */
export function useKeyedState<K, V>(
  key: K,
  initial: (key: K) => V,
): [V, (next: V | ((prev: V) => V)) => void] {
  const [stored, setStored] = useState<{ key: K; value: V } | null>(null)
  const value = stored !== null && Object.is(stored.key, key) ? stored.value : initial(key)

  // Keeps the setter below referentially stable: it reads the latest key/initial through this
  // ref instead of closing over them directly. Refs can't be written during render, so the ref
  // is synced in a layout effect, which still runs before the user can act on the new render.
  const latestRef = useRef({ key, initial })
  useLayoutEffect(() => {
    latestRef.current = { key, initial }
  })

  const setValue = useCallback((next: V | ((prev: V) => V)) => {
    setStored((prev) => {
      const { key, initial } = latestRef.current
      const current = prev !== null && Object.is(prev.key, key) ? prev.value : initial(key)
      return { key, value: typeof next === "function" ? (next as (prev: V) => V)(current) : next }
    })
  }, [])

  return [value, setValue]
}
