import { motion } from "framer-motion"
import { ArrowDown } from "lucide-react"
import { clientConfig } from "~/lib/config"
import { SignInCard } from "./sign-in-card"

/** The hero photo of the landing page; the route preloads the same URL. */
export const HERO_PHOTO_URL =
  "https://images.unsplash.com/photo-1717702576954-c07131c54169?q=80&w=1974&auto=format&fit=crop"

const EASE_OUT = [0.16, 1, 0.3, 1] as const

/**
 * First screen of the public landing page: the sign-in card next to the hero photo
 * and a brand panel that says what the product does.
 *
 * Below `lg` the card comes first, on the photo, and the panel follows it.
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
      <div className="lg:bg-background relative flex flex-col items-center justify-center bg-[#122023] px-4 py-8 lg:py-12">
        {/* Below lg the photo sits behind the card; the card is opaque, so nothing is read on the photo */}
        <img
          src={HERO_PHOTO_URL}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover lg:hidden"
        />
        <div className="relative w-full max-w-sm">
          <SignInCard redirectTo={redirectTo} redirectError={redirectError} />
        </div>
      </div>

      <div className="flex flex-col bg-[#122023] text-white">
        {/* The photo keeps its own area, so the text below never depends on its contrast */}
        <div className="relative hidden lg:block lg:min-h-48 lg:flex-1">
          <img
            src={HERO_PHOTO_URL}
            alt="Een trekker bewerkt een akker bij zonsondergang"
            fetchPriority="high"
            className="absolute inset-0 size-full object-cover"
          />
        </div>
        <motion.div
          className="flex flex-col px-4 py-8 sm:px-8 lg:px-14 lg:py-12"
          initial={{ y: 16 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl xl:text-5xl xl:leading-[1.1]">
            Inzicht in bodem, nutriënten en emissies
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-white/80 lg:text-lg">
            {clientConfig.name} rekent per perceel en voor het hele bedrijf de balansen, de
            emissies, de gebruiksruimte, het bemestingsadvies en de bodemkwaliteit door. Zo ziet u
            wat goede landbouwpraktijk op uw percelen vraagt en kunt u sturen op doelen, met de
            stikstofbalans als basis voor doelsturing.
          </p>
          {/* Facts a visitor can check: the repository, the pilot and the access model */}
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
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
          <a
            href="#mogelijkheden"
            className="mt-6 inline-flex items-center gap-2 self-start text-sm font-medium text-white underline underline-offset-4 hover:no-underline"
          >
            <span>Bekijk wat u ermee kunt</span>
            <ArrowDown className="size-4" aria-hidden="true" />
          </a>
        </motion.div>
      </div>
    </div>
  )
}
