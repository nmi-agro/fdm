import { motion } from "framer-motion"
import { ArrowDown } from "lucide-react"
import { clientConfig } from "~/lib/config"
import { SignInCard } from "./sign-in-card"

/** The hero photo of the landing page; the route preloads the same URL. */
export const HERO_PHOTO_URL =
  "https://images.unsplash.com/photo-1717702576954-c07131c54169?q=80&w=1974&auto=format&fit=crop"

const EASE_OUT = [0.16, 1, 0.3, 1] as const

/** Facts a visitor can check: each one is backed by the repository, the pilot or the access model. */
function HeroFacts({ className }: { className?: string }) {
  return (
    <ul className={className}>
      <li>
        <a
          href="https://github.com/nmi-agro/fdm"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:no-underline"
        >
          Open source
        </a>
      </li>
      <li>Gratis tijdens de pilot</li>
      <li>U blijft eigenaar van uw data</li>
    </ul>
  )
}

/**
 * First screen of the public landing page: the sign-in card next to the hero photo
 * and a brand panel that says what the product does.
 */
export function LandingHero({
  redirectTo,
  redirectError,
}: {
  redirectTo: string
  redirectError: string | null
}) {
  return (
    <div className="lg:grid lg:min-h-[calc(100svh-3.5rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex flex-col bg-[#122023] text-white lg:order-2">
        {/* The photo keeps its own area, so the text below never depends on its contrast */}
        <div className="relative h-28 sm:h-40 lg:h-auto lg:min-h-48 lg:flex-1">
          <img
            src={HERO_PHOTO_URL}
            alt="Een trekker bewerkt een akker bij zonsondergang"
            fetchPriority="high"
            className="absolute inset-0 size-full object-cover"
          />
        </div>
        <motion.div
          className="flex flex-col px-4 py-8 sm:px-8 lg:px-14 lg:py-12"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl xl:text-5xl xl:leading-[1.1]">
            Agronomisch inzicht in nutriënten, bodem en emissies
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-white/80 lg:text-lg">
            {clientConfig.name} laat per perceel en voor het hele bedrijf zien hoe het staat met de
            nutriënten: de stikstof- en organische-stofbalans, de emissies, de gebruiksruimte, het
            bemestingsadvies en de bodemkwaliteit, met de maatregelen die daarbij passen. In
            samenhang, en met rekenregels die u kunt nalezen.
          </p>
          <HeroFacts className="mt-6 hidden flex-wrap gap-x-6 gap-y-2 text-sm text-white/80 lg:flex" />
          <a
            href="#mogelijkheden"
            className="mt-6 hidden items-center gap-2 self-start text-sm font-medium text-white underline underline-offset-4 hover:no-underline lg:inline-flex"
          >
            <span>Bekijk wat u ermee kunt</span>
            <ArrowDown className="size-4" aria-hidden="true" />
          </a>
        </motion.div>
      </div>

      <div className="bg-background flex flex-col items-center justify-center px-4 py-10 lg:order-1 lg:py-12">
        <div className="w-full max-w-sm">
          <SignInCard redirectTo={redirectTo} redirectError={redirectError} />
          <HeroFacts className="text-muted-foreground mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm lg:hidden" />
          <a
            href="#mogelijkheden"
            className="text-foreground mt-6 flex items-center justify-center gap-2 text-sm font-medium underline underline-offset-4 hover:no-underline lg:hidden"
          >
            <span>Bekijk wat u ermee kunt</span>
            <ArrowDown className="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  )
}
