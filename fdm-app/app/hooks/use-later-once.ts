import { useEffect, useRef } from "react"

/**
 * Calls the function once per render after the component renders by using
 * setTimeout. This is intended for use with useEffect.
 *
 * Calls aren't distinguished by the arguments, if called multiple times per
 * render, the previous ones might get cancelled.
 *
 * @param callback function to call.
 * @returns a function which calls the passed function "later" or cancels
 * any previous calls appropriately.
 */
export function useLaterOnce<A extends any[]>(callback: (...args: A) => void) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(
    () => () => {
      if (typeof timeoutRef.current !== "undefined") {
        clearTimeout(timeoutRef.current)
      }
    },
    [],
  )

  return (...args: A) => {
    if (typeof timeoutRef.current !== "undefined") {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => callback(...args)) as any
  }
}
