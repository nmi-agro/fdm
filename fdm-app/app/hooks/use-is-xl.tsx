import * as React from "react"

const XL_BREAKPOINT = 1280

export function useIsXl() {
  const [isXl, setIsXl] = React.useState<boolean | undefined>(true)

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      setIsXl(true)
      return
    }
    const mql = window.matchMedia(`(min-width: ${XL_BREAKPOINT}px)`)
    const onChange = (e: MediaQueryListEvent) => {
      setIsXl(e.matches)
    }
    mql.addEventListener("change", onChange)
    setIsXl(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isXl
}
