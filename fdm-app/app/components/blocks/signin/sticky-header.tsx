import { AnimatePresence, motion, useScroll } from "framer-motion"
import { useEffect, useState } from "react"
import { Button } from "~/components/ui/button"
import { clientConfig } from "~/lib/config"

/** Smoothly scrolls to the top of the page, respecting reduced-motion preferences. */
export function scrollToTop() {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  window.scrollTo({ top: 0, behavior: reduce ? "instant" : "smooth" })
}

/** Sticky header that fades in once the user scrolls past the hero on the sign-in page. */
export function StickyHeader() {
  const { scrollY } = useScroll()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    return scrollY.on("change", (latest) => {
      setIsVisible(latest > 600)
    })
  }, [scrollY])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.header
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-background/80 fixed top-0 right-0 left-0 z-50 border-b px-4 py-3 shadow-xs backdrop-blur-md"
        >
          <div className="container mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#122023]">
                <img className="size-6" src={clientConfig.logomark} alt={clientConfig.name} />
              </div>
              <span className="font-semibold">{clientConfig.name}</span>
            </div>
            <Button onClick={scrollToTop}>Aanmelden</Button>
          </div>
        </motion.header>
      )}
    </AnimatePresence>
  )
}
