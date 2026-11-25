import type {
  ActionFunctionArgs,
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router"
import { MotionConfig } from "framer-motion"
import { useEffect } from "react"
import { redirect, useSearchParams } from "react-router"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import {
  LandingAbout,
  LandingCallToAction,
  LandingFaq,
  LandingFooter,
} from "~/components/blocks/signin/landing-about"
import { LandingEngine } from "~/components/blocks/signin/landing-engine"
import { LandingHeader } from "~/components/blocks/signin/landing-header"
import { HERO_PHOTO_URL, LandingHero } from "~/components/blocks/signin/landing-hero"
import {
  LandingAtlas,
  LandingBalances,
  LandingNormsAndAdvice,
  LandingSoilQuality,
} from "~/components/blocks/signin/landing-insights"
import { LandingCollaborate, LandingPlan } from "~/components/blocks/signin/landing-plan-share"
import { LandingHowItWorks, LandingRecord } from "~/components/blocks/signin/landing-record"
import { SignInFormSchema } from "~/components/blocks/signin/sign-in-card"
import { auth } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { isInactiveRecipientError } from "~/lib/email.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { magicLinkCookie } from "~/lib/magic-link-cookie.server"
import { normalizeOrigin } from "~/lib/manual/seo"
import { getSafeRedirect } from "~/lib/url-utils"
import { extractFormValuesFromRequest } from "../lib/form"

/** The hero photo at the size social previews expect. */
const SOCIAL_IMAGE_URL =
  "https://images.unsplash.com/photo-1717702576954-c07131c54169?q=80&w=1200&auto=format&fit=crop"

/**
 * `/` redirects here, so this page (as listed in the sitemap) is the canonical URL. Root-relative
 * when the public URL is not configured, as in the smoke tests, so loading the module never throws.
 */
const CANONICAL_URL = `${normalizeOrigin(clientConfig.url)}/signin`

export const meta: MetaFunction = () => {
  // Search results show about 60 characters of a title and 155 of a description
  const title = `${clientConfig.name}: inzicht in bodem, nutriënten en emissies`
  const description =
    "Bereken per perceel en voor uw bedrijf de gebruiksruimte, het bemestingsadvies, de stikstofbalans en de bodemkwaliteit. Open source en gratis tijdens de pilot."
  const ogImage = SOCIAL_IMAGE_URL

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: ogImage },
    { property: "og:url", content: CANONICAL_URL },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: clientConfig.name },
    { property: "og:locale", content: "nl_NL" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImage },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: clientConfig.name,
        description,
        url: CANONICAL_URL,
        image: ogImage,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "nl-NL",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        publisher: { "@type": "Organization", name: clientConfig.name },
      },
    },
  ]
}

export const links: LinksFunction = () => {
  return [
    { rel: "canonical", href: CANONICAL_URL },
    { rel: "preload", as: "image", href: HERO_PHOTO_URL },
  ]
}

/**
 * Checks for an existing user session and redirects authenticated users.
 *
 * @param request - The HTTP request object whose headers are used to retrieve the session.
 * @returns A redirect response to "/farm" if a session exists, or an empty object otherwise.
 * @throws {Error} If session retrieval fails, the error processed by {@link handleLoaderError} is thrown.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Get the session
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    // If user has an session redirect to app
    if (session?.session) {
      return redirect("/farm")
    }

    // Return user information from loader
    return {}
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * The public landing page: the sign-in card next to what the product does, followed by
 * sections that walk from recording farm data to the insights and sharing them.
 */
export default function SignIn() {
  const [searchParams, setSearchParams] = useSearchParams()

  const rawRedirectTo = searchParams.get("redirectTo")
  const redirectTo = getSafeRedirect(rawRedirectTo) // Validate redirectTo to prevent open redirect

  useEffect(() => {
    if (rawRedirectTo && rawRedirectTo !== redirectTo) {
      setSearchParams((searchParams) => {
        searchParams.delete("redirectTo")
        return searchParams
      })
    }
  }, [rawRedirectTo, redirectTo, setSearchParams])

  // Error from the redirect back from the provider is derived from the URL, not copied into state
  const errorParam = searchParams.get("error")
  const redirectError =
    errorParam === "microsoft_no_email"
      ? "Uw Microsoft-account deelt geen e-mailadres met ons. Vul alstublieft uw e-mailadres hieronder in om een aanmeldlink te ontvangen."
      : errorParam === "account_not_linked"
        ? "Er bestaat al een account met dit e-mailadres, maar Microsoft of Google heeft niet bevestigd dat dit e-mailadres van u is. Meld u hieronder aan met een aanmeldlink via uw e-mailadres."
        : null

  return (
    <MotionConfig reducedMotion="user">
      <LandingHeader />
      <main>
        <LandingHero redirectTo={redirectTo} redirectError={redirectError} />
        <LandingHowItWorks />
        <LandingBalances />
        <LandingNormsAndAdvice />
        <LandingSoilQuality />
        <LandingAtlas />
        <LandingPlan />
        <LandingEngine />
        <LandingRecord />
        <LandingCollaborate />
        <LandingAbout />
        <LandingCallToAction />
        <LandingFaq />
      </main>
      <LandingFooter />
    </MotionConfig>
  )
}

export async function action({ request, url }: ActionFunctionArgs) {
  // Get the URL object to extract search params
  const redirectTo = url.searchParams.get("redirectTo") || "/farm"
  // Validate redirectTo to prevent open redirect
  let safeRedirectTo = getSafeRedirect(redirectTo)

  // Get form values
  const formValues = await extractFormValuesFromRequest(request, SignInFormSchema)
  const { email } = formValues

  // Validate timezone and use undefined if invalid
  let timeZone: string | undefined
  if (formValues.timeZone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: formValues.timeZone })
      timeZone = formValues.timeZone
    } catch {}
  }

  if (timeZone) {
    const safeRedirectToUrl = new URL(safeRedirectTo, "http://localhost:9999")
    safeRedirectToUrl.searchParams.set("timeZone", timeZone)
    safeRedirectTo = `${safeRedirectToUrl.pathname}${safeRedirectToUrl.search}${safeRedirectToUrl.hash}`
  }

  try {
    // This will trigger the sendMagicLink hook in fdm-core, which sends the email
    await auth.api.signInMagicLink({
      body: {
        email: email,
        callbackURL: safeRedirectTo,
      },
      headers: request.headers,
    })

    // Preserve redirectTo/callbackURL in the URL, but keep the plaintext
    // email out of it (query params leak into server logs, browser history,
    // and the Referer header). It travels instead via a short-lived,
    // httpOnly cookie that check-your-email/verify read server-side.
    const nextUrl = new URL("/signin/check-your-email", "http://localhost")
    nextUrl.searchParams.set("redirectTo", safeRedirectTo)
    const redirectUrl = `${nextUrl.pathname}${nextUrl.search}`

    return redirectWithSuccess(redirectUrl, `Een aanmeldcode is verstuurd naar ${email}.`, {
      headers: {
        "Set-Cookie": await magicLinkCookie.serialize(email),
      },
    })
  } catch (error) {
    if (isInactiveRecipientError(error)) {
      console.error(`Attempted to send magic link to inactive email: ${email}`)
      return dataWithError(null, {
        message: `We kunnen geen e-mails naar ${formValues.email} sturen omdat het als inactief is gemarkeerd. Neem contact op met de ondersteuning voor hulp.`,
      })
    }

    void handleActionError(error)
    return dataWithError(null, {
      message: "Er is iets fout gegaan. Neem contact op met de ondersteuning voor hulp.",
    })
  }
}
