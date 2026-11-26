import { Cookie, X } from "lucide-react"
import posthog from "posthog-js"
import { useEffect } from "react"
import { Button } from "~/components/ui/button"
import { clientConfig } from "~/lib/config"
import { useCookieConsentStore } from "~/store/cookie-consent"

/** Marks the open banner, so a page can keep content it scrolls to clear of it. */
export const COOKIE_BANNER_ATTRIBUTE = "data-cookie-banner"

export function Banner() {
  const consentGiven = useCookieConsentStore((state) => state.consent)
  const isVisible = useCookieConsentStore((state) => state.isBannerVisible)
  const acceptCookies = useCookieConsentStore((state) => state.acceptCookies)
  const declineCookies = useCookieConsentStore((state) => state.declineCookies)
  const resetCookieConsent = useCookieConsentStore((state) => state.resetCookieConsent)
  const closeCookieSettings = useCookieConsentStore((state) => state.closeCookieSettings)

  useEffect(() => {
    // Set PostHog persistence based on consent, if PostHog is configured
    if (clientConfig.analytics.posthog && consentGiven !== "undecided") {
      try {
        posthog.set_config({
          persistence: consentGiven === "yes" ? "localStorage+cookie" : "memory",
        })
      } catch (error) {
        console.error("Failed to configure PostHog:", error)
      }
    }
  }, [consentGiven])

  return (
    <div>
      {isVisible && (
        <div
          {...{ [COOKIE_BANNER_ATTRIBUTE]: "" }}
          className="fixed right-0 bottom-0 left-0 z-200 w-full translate-y-0 opacity-100 transition-[opacity,transform] duration-700 sm:bottom-4 sm:left-4 sm:max-w-md"
        >
          {/* Compact below sm, so the banner leaves most of a phone screen free */}
          <section
            aria-label="Cookies"
            className="bg-background border-border m-2 rounded-md border shadow-lg sm:m-3"
          >
            <div className="grid sm:gap-2">
              <div className="border-border flex h-11 items-center justify-between border-b px-3 sm:h-14 sm:p-4">
                <h2 className="text-base font-medium sm:text-lg">{`Cookies op ${clientConfig.name}`}</h2>
                <div className="flex items-center gap-2">
                  <Cookie className="h-5 w-5" />
                  {(consentGiven === "yes" || consentGiven === "no") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={closeCookieSettings}
                      aria-label="Sluiten"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="px-3 py-2.5 sm:p-4">
                <p className="text-start text-sm font-normal">
                  <span>
                    {`Wij gebruiken cookies enkel om ${clientConfig.name} te verbeteren, zodat we weten wat er goed en fout gaat.`}
                  </span>{" "}
                  <span className="sm:mt-1 sm:block">
                    Geen zorgen, we gebruiken ze niet voor advertenties en ook niet om je online te
                    volgen.
                  </span>{" "}
                  <span className="mt-4 hidden text-xs sm:block">
                    Klik op "<span className="font-medium opacity-80">Accepteren</span>" om cookies
                    toe te staan.
                  </span>
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Naar privacybeleid (opent in nieuw tabblad)"
                    className="text-xs underline sm:block"
                  >
                    Meer over cookies.
                  </a>
                </p>
              </div>
              <div className="border-border flex gap-2 border-t px-3 py-2.5 sm:p-4 sm:py-5">
                {consentGiven === "yes" ? (
                  <Button onClick={resetCookieConsent} className="w-full" variant="outline">
                    Reset keuze: Geaccepteerd
                  </Button>
                ) : consentGiven === "no" ? (
                  <Button onClick={resetCookieConsent} className="w-full" variant="outline">
                    Reset keuze: Geweigerd
                  </Button>
                ) : (
                  <>
                    <Button onClick={acceptCookies} className="w-1/2">
                      Accepteren
                    </Button>
                    <Button onClick={declineCookies} className="w-1/2" variant="secondary">
                      Weigeren
                    </Button>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
