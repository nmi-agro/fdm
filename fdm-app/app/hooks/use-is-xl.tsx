import * as React from "react"

const XL_BREAKPOINT = 1280

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const mql = window.matchMedia(`(min-width: ${XL_BREAKPOINT}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.matchMedia(`(min-width: ${XL_BREAKPOINT}px)`).matches
}

function getServerSnapshot() {
  return true
}

export function useIsXl() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
