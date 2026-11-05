import { useSyncExternalStore } from "react"

const noopSubscribe = () => () => {}

function getClientSnapshot(): boolean {
  return true
}

function getServerSnapshot(): boolean {
  return false
}

/**
 * Reports whether the component is rendering after hydration.
 *
 * Returns `false` during server-side rendering and during the first client render that hydrates
 * the server markup, and `true` on every render after that, including renders after client-side
 * navigation. Use it to keep values that only exist in the browser (such as feature flags from an
 * analytics client) out of the hydration render, so the browser produces the same markup as the
 * server and React does not report a hydration mismatch.
 *
 * @returns `true` once the component renders outside of hydration, otherwise `false`.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, getClientSnapshot, getServerSnapshot)
}
