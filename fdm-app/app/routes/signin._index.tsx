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
import { LandingHeader } from "~/components/blocks/signin/landing-header"
import { LandingHero } from "~/components/blocks/signin/landing-hero"
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
import { getSafeRedirect } from "~/lib/url-utils"
import { extractFormValuesFromRequest } from "../lib/form"

/** Product screenshot used as the social preview image. */
const SOCIAL_IMAGE_PATH = "/fdm-screenshot-atlas-cultivations.png"

export const meta: MetaFunction = () => {
  const title = `${clientConfig.name}: Bemestingsadvies, Doelsturing & Perceelsdata`
  const description = `Faciliteert datagedreven inzicht in bodem en bemesting voor ondernemers en adviseurs. ${clientConfig.name} ondersteunt doelsturing via de stikstofbalans, optimalisatie van de organische stofbalans, bemestingsadvies, wettelijke gebruiksruimte en BLN-bodemindicatoren (waaronder Open Bodem Index/OBI en BedrijfsBodemWaterPlan/BBWP) met maatregelen voor bodemgezondheid, aangevuld met gedetailleerde perceelsdata zoals AHN4 en gewashistorie.`
  const ogImage = new URL(SOCIAL_IMAGE_PATH, clientConfig.url).toString()

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: ogImage },
    { property: "og:url", content: clientConfig.url },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImage },
  ]
}

export const links: LinksFunction = () => {
  return [{ rel: "canonical", href: clientConfig.url }]
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
        <LandingRecord />
        <LandingBalances />
        <LandingNormsAndAdvice />
        <LandingSoilQuality />
        <LandingAtlas />
        <LandingPlan />
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
