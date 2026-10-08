import * as Sentry from "@sentry/react-router"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useLocation, useMatches, useNavigation } from "react-router"
import { clientConfig } from "~/lib/config"
import { normalizePage } from "~/lib/url-utils"

/**
 * Shows a blurred overlay with a loading card when navigation takes longer than 500ms.
 * Fast navigations never trigger the indicator.
 * Tracks show frequency and duration as Sentry metrics, tagged with the source page pathname.
 *
 * Routes can opt out by exporting `export const handle = { hideNavigationProgress: true }`.
 */
export function NavigationProgress() {
  const navigation = useNavigation()
  const { state } = navigation
  const { pathname } = useLocation()
  const matches = useMatches()
  const hideProgress = matches.some(
    (m) =>
      m.handle !== null &&
      typeof m.handle === "object" &&
      (m.handle as Record<string, unknown>).hideNavigationProgress === true,
  )
  // The navigation key the 500ms timer last fired for. Comparing against the current
  // navigation's key means an overlapping navigation is never shown using a stale timer.
  const [shownFor, setShownFor] = useState<string | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const startPathnameRef = useRef<string | null>(null)
  const visible =
    state !== "idle" && !hideProgress && shownFor === (navigation.location?.key ?? null)

  // Show after 500ms — emit a count metric when it appears
  useEffect(() => {
    if (state !== "idle" && !hideProgress) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now()
        startPathnameRef.current = pathname
      }
      const key = navigation.location?.key ?? null
      const timer = setTimeout(() => {
        setShownFor(key)
        if (clientConfig.analytics.sentry) {
          Sentry.withScope((scope) => {
            scope.setTag("page", normalizePage(startPathnameRef.current ?? pathname))
            Sentry.metrics.count("navigation_progress.shown", 1)
          })
        }
      }, 500)
      return () => clearTimeout(timer)
    }

    // Navigation finished — emit duration metric
    if (visible && startTimeRef.current !== null) {
      const duration = Date.now() - startTimeRef.current
      if (clientConfig.analytics.sentry) {
        Sentry.withScope((scope) => {
          scope.setTag("page", normalizePage(startPathnameRef.current ?? pathname))
          Sentry.metrics.distribution("navigation_progress.duration_ms", duration)
        })
      }
    }
    startTimeRef.current = null
    startPathnameRef.current = null
  }, [state, visible, hideProgress, pathname, navigation.location])

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop blur */}
          <motion.div
            key="nav-backdrop"
            className="bg-background/50 fixed inset-0 z-9998 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />

          {/* Loading card */}
          <motion.div
            key="nav-card"
            className="border-border bg-background fixed top-1/2 left-1/2 z-9999 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-xl border px-8 py-6 shadow-xl"
            initial={{ opacity: 0, scale: 0.92, y: "-48%" }}
            animate={{ opacity: 1, scale: 1, y: "-50%" }}
            exit={{ opacity: 0, scale: 0.96, y: "-48%" }}
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 28,
            }}
          >
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
            <p className="text-muted-foreground text-sm">Even geduld…</p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
