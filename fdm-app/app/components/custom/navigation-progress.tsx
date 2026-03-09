import * as Sentry from "@sentry/react-router"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useMatches, useNavigation } from "react-router"
import { clientConfig } from "~/lib/config"

/**
 * Shows a blurred overlay with a loading card when navigation takes longer than 500ms.
 * Fast navigations never trigger the indicator.
 * Tracks show frequency and duration as Sentry metrics.
 *
 * Routes can opt out by exporting `export const handle = { hideNavigationProgress: true }`.
 */
export function NavigationProgress() {
    const { state } = useNavigation()
    const matches = useMatches()
    const hideProgress = matches.some(
        (m) =>
            m.handle !== null &&
            typeof m.handle === "object" &&
            (m.handle as Record<string, unknown>).hideNavigationProgress ===
                true,
    )
    const [show, setShow] = useState(false)
    const startTimeRef = useRef<number | null>(null)

    // Show after 500ms — emit a count metric when it appears
    useEffect(() => {
        if (state !== "idle" && !hideProgress) {
            if (startTimeRef.current === null) {
                startTimeRef.current = Date.now()
            }
            const timer = setTimeout(() => {
                setShow(true)
                if (clientConfig.analytics.sentry) {
                    Sentry.metrics.count("navigation_progress.shown", 1)
                }
            }, 500)
            return () => clearTimeout(timer)
        }

        // Navigation finished — emit duration metric and hide
        if (show && startTimeRef.current !== null) {
            const duration = Date.now() - startTimeRef.current
            if (clientConfig.analytics.sentry) {
                Sentry.metrics.distribution(
                    "navigation_progress.duration_ms",
                    duration,
                )
            }
        }
        setShow(false)
        startTimeRef.current = null
    }, [state, show])

    return (
        <AnimatePresence>
            {show && (
                <>
                    {/* Backdrop blur */}
                    <motion.div
                        key="nav-backdrop"
                        className="fixed inset-0 z-9998 bg-background/50 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                    />

                    {/* Loading card */}
                    <motion.div
                        key="nav-card"
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-9999 flex flex-col items-center gap-3 rounded-xl border border-border bg-background px-8 py-6 shadow-xl"
                        initial={{ opacity: 0, scale: 0.92, y: "-48%" }}
                        animate={{ opacity: 1, scale: 1, y: "-50%" }}
                        exit={{ opacity: 0, scale: 0.96, y: "-48%" }}
                        transition={{
                            type: "spring",
                            stiffness: 420,
                            damping: 28,
                        }}
                    >
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">
                            Even geduld…
                        </p>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
