import * as Sentry from "@sentry/react-router"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useLocation, useMatches, useNavigation } from "react-router"
import { clientConfig } from "~/lib/config"
import { normalizePage } from "~/lib/url-utils"

/** Delay before the slim progress bar at the top of the page appears. */
const BAR_DELAY_MS = 300
/** Delay before a page navigation also blurs the page with the "Even geduld…" card. */
const OVERLAY_DELAY_MS = 2000

/** The navigation that is being measured, from the moment the router left the idle state. */
interface TrackedNavigation {
  startedAt: number
  fromPage: string
  page: string
  overlayShown: boolean
  submission: boolean
}

/**
 * Shows progress while the router navigates or submits a form.
 *
 * Fast navigations show nothing. After {@link BAR_DELAY_MS} a slim bar appears at the top of the
 * page, so the current page stays readable. Only when a page navigation takes longer than
 * {@link OVERLAY_DELAY_MS}, the page is blurred and the "Even geduld…" card is shown.
 *
 * A form submission, including the redirect after it, never shows the overlay: the form shows
 * its own submitting state (a spinner on its button), so the user sees what is being saved.
 *
 * Sends two Sentry metrics with the normalized destination (`page`) and source (`from_page`)
 * pages as attributes:
 * - `navigation_progress.shown`: counted when the blurred overlay appears.
 * - `navigation_progress.duration_ms`: the duration of every navigation that showed the bar, with
 *   `overlay` telling whether the overlay was shown as well and `submission` whether it was a form
 *   submission.
 *
 * Routes can opt out by exporting `export const handle = { hideNavigationProgress: true }`.
 */
export function NavigationProgress() {
  const navigation = useNavigation()
  const { pathname } = useLocation()
  const matches = useMatches()
  const hideProgress = matches.some(
    (m) =>
      m.handle !== null &&
      typeof m.handle === "object" &&
      (m.handle as Record<string, unknown>).hideNavigationProgress === true,
  )
  const active = navigation.state !== "idle" && !hideProgress
  const isSubmission =
    navigation.formMethod !== undefined && navigation.formMethod.toUpperCase() !== "GET"
  const navigationKey = navigation.location?.key ?? null
  const destination = navigation.location?.pathname ?? pathname

  // The navigation key each timer last fired for. Comparing against the current navigation's key
  // means an overlapping navigation is never shown using a stale timer.
  const [barShownFor, setBarShownFor] = useState<string | null>(null)
  const [overlayShownFor, setOverlayShownFor] = useState<string | null>(null)
  const barVisible = active && barShownFor === navigationKey
  const overlayVisible = active && !isSubmission && overlayShownFor === navigationKey
  const trackedRef = useRef<TrackedNavigation | null>(null)

  // Start the timers. The delays count from the moment the router left the idle state, so a
  // redirect after a submission (a new navigation key) shows the progress again right away.
  useEffect(() => {
    if (!active) return
    if (trackedRef.current === null) {
      trackedRef.current = {
        startedAt: Date.now(),
        fromPage: normalizePage(pathname),
        page: normalizePage(destination),
        overlayShown: false,
        submission: false,
      }
    }
    const tracked = trackedRef.current
    // A navigation that replaces a pending one keeps the start time, but measures the new page
    tracked.page = normalizePage(destination)
    if (isSubmission) tracked.submission = true
    const elapsed = Date.now() - tracked.startedAt

    const barTimer = setTimeout(
      () => setBarShownFor(navigationKey),
      Math.max(0, BAR_DELAY_MS - elapsed),
    )
    if (isSubmission) {
      return () => clearTimeout(barTimer)
    }
    const overlayTimer = setTimeout(
      () => {
        setOverlayShownFor(navigationKey)
        if (tracked.overlayShown) return
        tracked.overlayShown = true
        if (clientConfig.analytics.sentry) {
          Sentry.metrics.count("navigation_progress.shown", 1, {
            attributes: { page: tracked.page, from_page: tracked.fromPage },
          })
        }
      },
      Math.max(0, OVERLAY_DELAY_MS - elapsed),
    )
    return () => {
      clearTimeout(barTimer)
      clearTimeout(overlayTimer)
    }
  }, [active, navigationKey, isSubmission, pathname, destination])

  // Navigation finished: record how long a navigation that showed progress took
  useEffect(() => {
    if (active) return
    const tracked = trackedRef.current
    trackedRef.current = null
    if (!tracked) return
    const duration = Date.now() - tracked.startedAt
    if (duration < BAR_DELAY_MS || !clientConfig.analytics.sentry) return
    Sentry.metrics.distribution("navigation_progress.duration_ms", duration, {
      unit: "millisecond",
      attributes: {
        page: tracked.page,
        from_page: tracked.fromPage,
        overlay: tracked.overlayShown,
        submission: tracked.submission,
      },
    })
  }, [active])

  return (
    <>
      <AnimatePresence>{barVisible && <ProgressBar key="nav-bar" />}</AnimatePresence>
      <AnimatePresence>
        {overlayVisible && (
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
    </>
  )
}

/** A slim, indeterminate progress bar along the top edge of the viewport. */
function ProgressBar() {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      role="status"
      className="bg-primary/15 pointer-events-none fixed inset-x-0 top-0 z-9999 h-1 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <span className="sr-only">Pagina wordt geladen</span>
      {reduceMotion ? (
        <div className="bg-primary h-full w-1/3" />
      ) : (
        <motion.div
          className="bg-primary h-full w-1/3"
          initial={{ x: "-100%" }}
          animate={{ x: "300%" }}
          transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity }}
        />
      )}
    </motion.div>
  )
}
