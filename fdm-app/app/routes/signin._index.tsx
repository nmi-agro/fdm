import type { Resolver } from "react-hook-form"
import type {
  ActionFunctionArgs,
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { SiGithub } from "@icons-pack/react-simple-icons"
import { AnimatePresence, motion, MotionConfig, useScroll } from "framer-motion"
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Calculator,
  Camera,
  CheckCircle2,
  Droplets,
  ExternalLink,
  FileUp,
  FlaskConical,
  History,
  Info,
  Landmark,
  LayersIcon,
  ListChecks,
  Mountain,
  MoveDown,
  Scale,
  ScanText,
  SearchCheck,
  ShieldCheck,
  Sprout,
  Table2,
  Target,
  Users,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Form, redirect, useSearchParams } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import { z } from "zod"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { signIn } from "~/lib/auth-client"
import { auth } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { isInactiveRecipientError } from "~/lib/email.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { modifySearchParams } from "~/lib/url-utils"
import { cn } from "~/lib/utils"
import { extractFormValuesFromRequest } from "../lib/form"

export const meta: MetaFunction = () => {
  const title = `${clientConfig.name}: Bemestingsadvies, Doelsturing & Perceelsdata`
  const description = `Faciliteert datagedreven inzicht in bodem en bemesting voor ondernemers en adviseurs. ${clientConfig.name} ondersteunt doelsturing via de stikstofbalans, optimalisatie van de organische stofbalans, bemestingsadvies en wettelijke gebruiksruimte, aangevuld met gedetailleerde perceelsdata zoals AHN4 en gewashistorie.`
  const ogImage =
    "https://images.unsplash.com/photo-1717702576954-c07131c54169?q=80&w=1200&auto=format&fit=crop"

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
  return [
    { rel: "canonical", href: clientConfig.url },
    {
      rel: "preload",
      as: "image",
      href: "https://images.unsplash.com/photo-1717702576954-c07131c54169?q=80&w=1974&auto=format&fit=crop",
    },
    {
      rel: "preload",
      as: "image",
      href: "/fdm-screenshot-atlas-cultivations.png",
    },
    {
      rel: "preload",
      as: "image",
      href: "/fdm-screenshot-atlas-elevation.png",
    },
    {
      rel: "preload",
      as: "image",
      href: "/fdm-screenshot-atlas-cultivation-history.png",
    },
    {
      rel: "preload",
      as: "image",
      href: "/fdm-screenshot-nutrient-advice-npk.png",
    },
  ]
}

const FormSchema = z.object({
  timeZone: z.string().optional(),
  email: z.email({
    error: "Dit is geen geldig e-mailadres",
  }),
})

/**
 * Checks for an existing user session and redirects authenticated users.
 *
 * This asynchronous loader function retrieves the user session from the request headers
 * via the authentication API. If a valid session exists, the function redirects the user
 * to the "/farm" route; otherwise, it returns an empty object. Any errors during session
 * retrieval are processed by {@link handleLoaderError} and thrown.
 *
 * @param request - The HTTP request object whose headers are used to retrieve the session.
 *
 * @returns A redirect response to "/farm" if a session exists, or an empty object otherwise.
 *
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

/**Normalizes the given address to be a safe redirect, or `/farm` by default.
 *
 * @param address address to check for safety, null if not specified
 * @returns the normalized, safe redirect address
 */
function getSafeRedirect(address: string | null) {
  return address?.startsWith("/") && !address.startsWith("//") ? address : "/farm"
}

function scrollToTop() {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  window.scrollTo({ top: 0, behavior: reduce ? "instant" : "smooth" })
}

const StickyHeader = () => {
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
            <Button onClick={scrollToTop}>
              Aanmelden
            </Button>
          </div>
        </motion.header>
      )}
    </AnimatePresence>
  )
}

/**
 * Renders the sign-in page with social authentication options.
 *
 * This component displays a structured interface for user sign-in. It provides social sign-in buttons for Microsoft and Google,
 * along with information about service benefits and a link to the privacy policy. If a social sign-in attempt fails, a toast notification
 * is displayed and the error is logged to the console.
 *
 * @returns A React element representing the sign-in page.
 */
export default function SignIn() {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams() // Get search params
  const moreInfoRef = useRef<HTMLDivElement>(null)
  const [socialSignInError, setSocialSignInError] = useState<string | null>(null)

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

  useEffect(() => {
    const error = searchParams.get("error")
    if (error === "microsoft_no_email") {
      setSocialSignInError(
        "Uw Microsoft-account deelt geen e-mailadres met ons. Vul alstublieft uw e-mailadres hieronder in om een aanmeldlink te ontvangen.",
      )
    }
  }, [searchParams])

  const socialProviderNewUserCallbackUrl = modifySearchParams("/welcome", (searchParams) =>
    searchParams.set("redirectTo", redirectTo),
  )

  const handleSignInError = (provider: string, error: unknown) => {
    setLoadingProvider(null)
    setSocialSignInError(
      `Er is helaas iets misgegaan bij het aanmelden met ${provider}. Probeer het opnieuw.`,
    )
    console.error("Social sign-in failed:", error)
  }
  const openCookieSettings = () => {
    if (window?.openCookieSettings) {
      window.openCookieSettings()
    }
  }
  const onOpenCookieSettings = () => {
    openCookieSettings()
  }

  const scrollToMoreInfo = () => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    moreInfoRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
    })
  }

  const form = useRemixForm<z.infer<typeof FormSchema>>({
    mode: "onTouched",
    resolver: zodResolver(FormSchema) as Resolver<z.infer<typeof FormSchema>>,
    defaultValues: {
      email: "",
      timeZone: "",
    },
  })

  useEffect(() => {
    const timeZone = Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone
    form.setValue("timeZone", timeZone)
  }, [form.setValue])

  const emailValue = form.watch("email") ?? ""
  const emailHasError = !!form.formState.errors.email
  const emailIsTouched = form.getFieldState("email").isTouched
  const emailIsValid = emailValue.length > 0 && emailIsTouched && !emailHasError

  return (
    <MotionConfig reducedMotion="user">
    <div className="relative">
      <StickyHeader />
      <div className="relative w-full lg:grid lg:min-h-[600px] lg:grid-cols-2 xl:min-h-[800px]">
        {/* Mobile Background Image */}
        <div className="absolute inset-0 z-0 bg-[#122023] lg:hidden">
          <img
            src="https://images.unsplash.com/photo-1717702576954-c07131c54169?q=80&w=1200&auto=format&fit=crop"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>

        <div className="lg:bg-muted/20 relative z-10 flex min-h-screen flex-col bg-transparent">
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
            <motion.div
              className="mx-auto grid w-full max-w-sm gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card className="border-border/40 lg:border-border shadow-sm">
                <CardHeader className="text-center">
                  <div className="mb-4 flex justify-center">
                    <div className="flex aspect-square size-16 items-center justify-center rounded-lg bg-[#122023]">
                      <img
                        className="size-12"
                        src={clientConfig.logomark}
                        alt={clientConfig.name}
                      />
                    </div>
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight">{clientConfig.name}</h1>
                  <CardDescription>
                    Meld u aan om toegang te krijgen tot uw dashboard.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid w-full items-center gap-4">
                    <div className="flex flex-col space-y-1.5">
                      <Button
                        variant={"outline"}
                        className={cn("group w-full gap-2 transition-transform active:scale-[0.98]")}
                        disabled={loadingProvider !== null}
                        onClick={async () => {
                          setLoadingProvider("microsoft")
                          try {
                            await signIn.oauth2({
                              providerId: "microsoft",
                              callbackURL: redirectTo,
                              newUserCallbackURL: socialProviderNewUserCallbackUrl,
                            })
                          } catch (error) {
                            handleSignInError("Microsoft", error)
                          }
                        }}
                      >
                        {loadingProvider === "microsoft" ? (
                          <div className="flex items-center space-x-2">
                            <Spinner />
                            <span>Aanmelden...</span>
                          </div>
                        ) : (
                          <>
                            <svg
                              role="img"
                              aria-label="Microsoft logo"
                              className="transition-transform duration-200 group-hover:scale-110"
                              width="1024"
                              height="1024"
                              viewBox="0 0 1024 1024"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M44.522 44.5217H489.739V489.739H44.522V44.5217Z"
                                fill="#F35325"
                              />
                              <path
                                d="M534.261 44.5217H979.478V489.739H534.261V44.5217Z"
                                fill="#81BC06"
                              />
                              <path
                                d="M44.522 534.261H489.739V979.478H44.522V534.261Z"
                                fill="#05A6F0"
                              />
                              <path
                                d="M534.261 534.261H979.478V979.478H534.261V534.261Z"
                                fill="#FFBA08"
                              />
                            </svg>
                            Aanmelden met Microsoft
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex flex-col space-y-1.5">
                      <Button
                        variant={"outline"}
                        className={cn("group w-full gap-2 transition-transform active:scale-[0.98]")}
                        disabled={loadingProvider !== null}
                        onClick={async () => {
                          try {
                            setLoadingProvider("google")
                            await signIn.social({
                              provider: "google",
                              callbackURL: redirectTo,
                              newUserCallbackURL: socialProviderNewUserCallbackUrl,
                              // prompt: "select_account",
                            })
                          } catch (error) {
                            handleSignInError("Google", error)
                          }
                        }}
                      >
                        {loadingProvider === "google" ? (
                          <div className="flex items-center space-x-2">
                            <Spinner />
                            <span>Aanmelden...</span>
                          </div>
                        ) : (
                          <>
                            <svg
                              role="img"
                              aria-label="Google logo"
                              className="transition-transform duration-200 group-hover:scale-110"
                              xmlns="http://www.w3.org/2000/svg"
                              width="0.98em"
                              height="1em"
                              viewBox="0 0 256 262"
                            >
                              <path
                                fill="#4285F4"
                                d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
                              />

                              <path
                                fill="#34A853"
                                d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
                              />

                              <path
                                fill="#FBBC05"
                                d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
                              />

                              <path
                                fill="#EB4335"
                                d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
                              />
                            </svg>
                            Aanmelden met Google
                          </>
                        )}
                      </Button>
                    </div>
                    {socialSignInError && (
                      <p role="alert" className="text-destructive text-center text-sm">
                        {socialSignInError}
                      </p>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background text-muted-foreground px-2">Of</span>
                    </div>
                  </div>
                  <RemixFormProvider {...form}>
                    <Form id="formSigninMagicLink" onSubmit={form.handleSubmit} method="post">
                      <fieldset disabled={form.formState.isSubmitting}>
                        <div className="grid w-full items-center gap-4">
                          <div className="flex flex-col space-y-1.5">
                            <FormField
                              control={form.control}
                              name="timeZone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input type="hidden" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>E-mailadres</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input
                                        type="email"
                                        autoComplete="email"
                                        placeholder="naam@bedrijf.nl"
                                        className={cn(emailIsValid && "pr-9")}
                                        {...field}
                                      />
                                      <AnimatePresence>
                                        {emailIsValid && (
                                          <motion.span
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.5 }}
                                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                                          >
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                          </motion.span>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <Button type="submit" className="w-full transition-transform active:scale-[0.98]">
                            {form.formState.isSubmitting ? (
                              <div className="flex items-center space-x-2">
                                <Spinner />
                                <span>Aanmelden...</span>
                              </div>
                            ) : (
                              "Aanmelden met e-mail"
                            )}
                          </Button>
                        </div>
                      </fieldset>
                    </Form>
                  </RemixFormProvider>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <p className="text-muted-foreground text-center text-sm font-medium">
                    Door verder te gaan, gaat u akkoord met het{" "}
                    <a
                      href="/privacy"
                      aria-label="Lees ons privacybeleid"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="decoration-primary/30 hover:text-primary hover:decoration-primary focus:ring-ring underline underline-offset-4 transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
                    >
                      Privacybeleid
                    </a>
                  </p>
                </CardFooter>
              </Card>
              <div className="text-muted-foreground/70 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs">
                <span className="flex items-center gap-1">
                  <span>Ontwikkeld door het</span>
                  <a
                    href="https://www.nmi-agro.nl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground/80 underline underline-offset-2 transition-colors"
                  >
                    Nutriënten Management Instituut
                  </a>
                </span>
                <span aria-hidden="true">·</span>
                <a
                  href="https://github.com/nmi-agro/fdm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground/80 underline underline-offset-2 transition-colors"
                >
                  Open source
                </a>
                <span aria-hidden="true">·</span>
                <span>Gratis tijdens pilot</span>
                <span aria-hidden="true">·</span>
                <span>U blijft eigenaar van uw data</span>
              </div>
              <div className="text-center">
                <Button
                  variant="ghost"
                  onClick={scrollToMoreInfo}
                  className="group text-muted-foreground hover:text-foreground lg:text-muted-foreground hover:bg-white/10 lg:hover:bg-transparent"
                >
                  Ontdek wat {clientConfig.name} kan doen
                  <MoveDown className="animate-up-and-down-down ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
        <div className="bg-muted relative hidden lg:block">
          <img
            src="https://images.unsplash.com/photo-1717702576954-c07131c54169?q=80&w=1974&auto=format&fit=crop"
            alt="A tractor plowing a field at sunset"
            className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            loading="eager"
            fetchPriority="high"
          />
        </div>
      </div>
      <div ref={moreInfoRef}>
        <div className="bg-muted/10 py-24">
          <div className="container mx-auto max-w-6xl px-4 lg:px-8">
            <div className="mb-24 grid items-center gap-12 lg:grid-cols-2">
              <div>
                <div className="mb-6 inline-flex items-center rounded-full border border-green-100 bg-green-200 px-3 py-1 text-sm font-medium text-green-800">
                  <span className="mr-2 flex h-2 w-2 rounded-full bg-green-500" />
                  Innovatie in de praktijk
                </div>
                <h2 className="text-foreground mb-6 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                  Samen leren en innoveren
                </h2>
                <div className="text-muted-foreground mb-8 space-y-4 text-lg leading-relaxed">
                  <p>
                    {clientConfig.name} is een initiatief van het Nutriënten Management Instituut
                    (NMI) en is volop in ontwikkeling, maar nu al inzetbaar voor uw bedrijf.{" "}
                    {clientConfig.name} is bovendien een open-source. Dit betekent transparantie en
                    de mogelijkheid voor derden om bij te dragen aan de doorontwikkeling. Door drie
                    innovatieve projecten samen te brengen, faciliteren we kennisdeling en
                    versnellen we de transitie naar een duurzamere landbouw:
                  </p>
                  <ul className="space-y-3">
                    <li className="flex gap-2">
                      <span className="bg-primary mt-2 flex h-1.5 w-1.5 shrink-0 rounded-full" />
                      <span>
                        <strong className="text-foreground">Pilot Maatwerkaanpak:</strong> In
                        samenwerking met boeren, de agrarische sector, kennisinstellingen, overheden
                        en overheidsorganisaties testen we hoe doelsturing werkt in de praktijk, met
                        de Stikstofbalans als basis.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="bg-primary mt-2 flex h-1.5 w-1.5 shrink-0 rounded-full" />
                      <span>
                        <strong className="text-foreground">PPS BAAT:</strong> Samen met Wageningen
                        Plant Research maken we bemestingsadvies toegankelijker. Krijg inzicht in
                        zowel de geadviseerde gift als milieu-impact voor een bewuste meststofkeuze.
                      </span>
                    </li>
                    <li className="flex items-baseline gap-2">
                      <span className="bg-primary mt-2 flex h-1.5 w-1.5 shrink-0 items-center rounded-full" />
                      <span>
                        <strong className="text-foreground">Open Bodem Index & BBWP:</strong> Deze
                        twee veelgebruikte methoden helpen boeren en adviseurs nu al in het
                        effectief nemen van maatregelen en het inzicht krijgen in de
                        bodemgezondheid. In 2026 komen OBI en BBWP ook beschikbaar in{" "}
                        {clientConfig.name} en maken we ze nog toegankelijker.
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="border-border border-t pt-6">
                  <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
                    Partners
                  </p>
                  <div className="text-foreground/80 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
                    <span>ZLTO</span>•<span>LTO Noord</span>•<span>WUR</span>•<span>LVVN</span>•
                    <span>NVWA</span>•<span>RVO</span>
                  </div>
                </div>
              </div>

              <div>
                <Card className="border-border bg-background">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Target className="text-primary h-5 w-5" />
                      Uitgangspunten
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-6">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Praktijktoets</h4>
                        <p className="text-muted-foreground mt-1 text-sm">
                          Leren en ontdekken hoe doelsturing werkt in de echte wereld.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Transparant & deelbaar</h4>
                        <p className="text-muted-foreground mt-1 text-sm">
                          Als open-source initiatief zijn de rekenregels en methodes beschikbaar en
                          kan iedereen deze lezen en verbeteringen op voorstellen.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold">In ontwikkeling</h4>
                        <p className="text-muted-foreground mt-1 text-sm">
                          Een groeiend platform dat continu wordt verbeterd op basis van uw
                          feedback.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-background py-24">
          <div className="container mx-auto max-w-6xl px-4 lg:px-8">
            <div className="mx-auto mb-20 max-w-3xl text-center">
              <h2 className="text-foreground mb-6 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Doelsturing: Kansen en uitdagingen
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Doelsturing kan een effectieve methode zijn om de waterkwaliteit te verbeteren en
                ammoniakemissies te verminderen, doordat u als ondernemer zelf de maatregelen kiest.
                De keerzijde is dat dit vraagt om veel en gedetailleerde data. {clientConfig.name}{" "}
                streeft ernaar om deze complexe berekening zo eenvoudig mogelijk te maken, zonder in
                te leveren op nauwkeurigheid.
              </p>
            </div>

            <div className="relative">
              {/* Connecting line for desktop */}
              <div className="pointer-events-none absolute top-1/2 left-0 z-0 hidden h-px w-full -translate-y-1/2 px-12 lg:block">
                <svg
                  width="100%"
                  height="2"
                  fill="none"
                  preserveAspectRatio="none"
                  overflow="visible"
                >
                  <motion.line
                    x1="0"
                    y1="1"
                    x2="100%"
                    y2="1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="8 8"
                    className="text-primary/20"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{
                      pathLength: 1,
                      opacity: 1,
                    }}
                    viewport={{
                      once: true,
                      margin: "-100px",
                    }}
                    transition={{
                      duration: 2,
                      ease: "easeInOut",
                    }}
                  />
                </svg>
              </div>

              <div className="relative z-10 grid gap-8 md:grid-cols-2 xl:grid-cols-4">
                {/* Step 1: Supply */}
                <div className="group bg-card rounded-xl border p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                    <ArrowDown className="h-7 w-7" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">Aanvoer</h3>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    <li>• Kunstmest</li>
                    <li>• Dierlijke mest</li>
                    <li>• Compost</li>
                    <li>• Overige meststoffen</li>
                    <li>• Bodemlevering</li>
                    <li>• Depositie</li>
                  </ul>
                </div>

                {/* Step 2: Removal & Ammonia */}
                <div className="group bg-card rounded-xl border p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <ArrowRight className="h-7 w-7" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">Afvoer & Emissie</h3>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    <li>• Oogst </li>
                    <li>• Gewasresten </li>
                    <li>• Ammoniak</li>
                    <li>• Nitraat</li>
                  </ul>
                </div>

                {/* Step 3: Surplus */}
                <div className="group bg-card rounded-xl border p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
                    <Scale className="h-7 w-7" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">Stikstofbodemoverschot</h3>
                  <p className="text-muted-foreground text-sm">
                    Het stikstofbodemoverschot laat zien hoe efficiënt stikstof wordt gebruik.
                  </p>
                </div>

                {/* Step 4: Leaching */}
                <div className="group bg-card rounded-xl border p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                    <Droplets className="h-7 w-7" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">Waterkwaliteit</h3>
                  <p className="text-muted-foreground text-sm">
                    Nitraatuitspoeling berekend als fractie van het overschot.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-muted/10 py-24">
          <div className="container mx-auto max-w-6xl px-4 lg:px-8">
            <div className="mx-auto mb-20 max-w-3xl text-center">
              <h2 className="text-foreground mb-6 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Atlas: Alles in kaart gebracht
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Verken agrarisch Nederland met de interactieve Atlas. Navigeer door de jaren heen en
                krijg direct inzicht in perceelshistorie, het microreliëf en gebiedskenmerken.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* 1. Rotatie (Wide Top-Left) */}
              <Card className="bg-background flex flex-col overflow-hidden border-none shadow-sm transition-all hover:shadow-md lg:col-span-2">
                <div className="p-6">
                  <div className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                    <Sprout className="h-6 w-6" />
                  </div>
                  <CardTitle className="mb-2 text-lg">Gewasrotatie in beeld</CardTitle>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    De interactieve kaart toont gewaspercelen tot 2020, helder ingekleurd per
                    gewasgroup. Krijg direct visueel inzicht in toegepaste rotaties door de jaren
                    heen.
                  </p>
                </div>
                <div className="bg-muted/20 relative aspect-video w-full border-t">
                  <img
                    src="/fdm-screenshot-atlas-cultivations.png"
                    alt="Gewasrotatie screenshot"
                    className="absolute inset-0 h-full w-full object-cover object-top"
                  />
                </div>
              </Card>

              {/* 3. History (Tall Right) - HTML order swapped for Mobile/Desktop strategy,
                                                        but explicit grid placement puts it on the right. 
                                                        Actually, if I want Elevation second on mobile, History must be 3rd in HTML. 
                                                        Explicit grid placement handles Desktop. */}

              {/* 2. Elevation (Wide Middle-Left) */}
              <Card className="bg-background flex flex-col border-none shadow-sm transition-all hover:shadow-md lg:col-span-2">
                <CardHeader>
                  <div className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                    <Mountain className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">Hoogtekaart (AHN4)</CardTitle>
                  <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                    Bekijk de AHN4 voor een gedetailleerde weergave van het hoogteverloop.
                  </p>
                </CardHeader>
                <div className="relative mt-auto aspect-video w-full overflow-hidden rounded-lg border shadow-xs">
                  <img
                    src="/fdm-screenshot-atlas-elevation.png"
                    alt="Hoogtekaart AHN4"
                    className="h-full w-full object-cover"
                  />
                </div>
              </Card>

              {/* 3. History (Tall Right) */}
              <Card className="bg-background flex flex-col overflow-hidden border-none shadow-sm transition-all hover:shadow-md lg:col-start-3 lg:row-span-2 lg:row-start-1">
                <CardHeader>
                  <div className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                    <History className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">Gewashistorie</CardTitle>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Klik op een perceel voor meer informatie: bekijk de volledige gewashistorie tot
                    2009.
                  </p>
                </CardHeader>
                <div className="bg-muted/10 relative flex min-h-[400px] w-full flex-1 items-start justify-center border-t p-4">
                  <img
                    src="/fdm-screenshot-atlas-cultivation-history.png"
                    alt="Gewashistorie screenshot"
                    className="bg-background h-auto max-h-full w-full rounded-md object-contain shadow-sm"
                  />
                </div>
              </Card>
              {/* 4. Normen (Small Bottom-Left) */}
              <Card className="bg-background border-none shadow-sm transition-all hover:shadow-md lg:col-span-1">
                <CardHeader>
                  <div className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                    <Landmark className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">Gebiedsgerichte normen</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Zie direct in welke regio's voor de gebruiksnormen het perceel ligt.
                  </p>
                </CardContent>
              </Card>

              {/* 5. Bodem (Wide Bottom-Right) */}
              <Card className="bg-background border-none shadow-sm transition-all hover:shadow-md lg:col-span-2">
                <CardHeader>
                  <div className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                    <LayersIcon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">Bodem & water</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Raadpleeg data voor uw gewas: van grondwatertrappen tot de bodemsamenstelling
                    zoals zand-, klei- en siltgehalte.
                  </p>
                </CardContent>
              </Card>
            </div>{" "}
          </div>
        </div>

        <div className="bg-background py-24">
          <div className="container mx-auto max-w-6xl px-4 lg:px-8">
            <div className="mx-auto mb-20 max-w-3xl text-center">
              <h2 className="text-foreground mb-6 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Bemestingsadviezen: Kennis binnen handbereik
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Bij NMI hebben we jarenlange kennis van bemesting en bodemvruchtbaarheid omgezet in
                digitale adviezen, direct beschikbaar in {clientConfig.name}.
              </p>
            </div>

            <div className="mb-16 grid items-start gap-12 lg:grid-cols-2">
              {/* Left: Text with Benefits */}
              <div>
                <h3 className="mb-6 text-2xl font-semibold">
                  Altijd het juiste advies voor uw gewas
                </h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <BookOpen className="text-primary mt-1 h-6 w-6 shrink-0" />
                    <div>
                      <h4 className="font-semibold">Gebundelde expertise</h4>
                      <p className="text-muted-foreground">
                        We brengen per perceel en voor elk gewas in beeld wat de gewenste bemesting
                        is volgens de adviezen uit{" "}
                        <strong className="text-foreground">CBGV (Bemestingsadvies)</strong> en{" "}
                        <strong className="text-foreground">
                          CBAV (Handboek Bodem en Bemesting)
                        </strong>.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <ListChecks className="text-primary mt-1 h-6 w-6 shrink-0" />
                    <div>
                      <h4 className="font-semibold">Voor alle nutriënten</h4>
                      <p className="text-muted-foreground">
                        Adviezen omvatten primaire (N, P, K), organische stof, secundaire en
                        micronutriënten, specifiek voor uw gewas en bodemtoestand.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Calculator className="text-primary mt-1 h-6 w-6 shrink-0" />
                    <div>
                      <h4 className="font-semibold">Inzicht in uw bemesting</h4>
                      <p className="text-muted-foreground">
                        Naast de geadviseerde gift tonen we per nutriënt ook hoeveel u daadwerkelijk
                        heeft gegeven, gebaseerd op uw ingevoerde bemestingsplannen.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Emphasize Importance */}
              <Card className="border-primary/20 bg-background h-full shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FlaskConical className="text-primary h-6 w-6" />
                    Waarom is een bemestingsadvies belangrijk
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    Bemestingsadviezen gaan verder dan enkel de wettelijke
                    <strong className="text-foreground"> gebruiksnormen</strong>. Ze zijn cruciaal
                    voor:
                  </p>
                  <ul className="text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                      <span>Optimale opbrengst en kwaliteit van het gewas.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                      <span>
                        Het behouden en verbeteren van bodemvruchtbaarheid op lange termijn.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                      <span>
                        Efficiënt gebruik van nutriënten, ter voorkoming van overbemesting en
                        verliezen.
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Full width screenshot */}
            <div className="bg-background ring-border/50 overflow-hidden rounded-xl border shadow-lg ring-1">
              <div className="bg-muted/40 flex items-center gap-2 border-b p-3">
                <div className="ml-1 flex gap-1.5">
                  <div className="h-3 w-3 rounded-full border border-red-500/20 bg-red-400/80" />
                  <div className="h-3 w-3 rounded-full border border-yellow-500/20 bg-yellow-400/80" />
                  <div className="h-3 w-3 rounded-full border border-green-500/20 bg-green-400/80" />
                </div>
              </div>
              <div className="bg-muted/5 relative w-full">
                <img
                  src="/fdm-screenshot-nutrient-advice-npk.png"
                  alt="Bemestingsadvies tabel"
                  className="h-auto w-full shadow-inner"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-muted/10 py-24">
          <div className="container mx-auto max-w-6xl px-4 lg:px-8">
            <div className="mx-auto mb-20 max-w-3xl text-center">
              <h2 className="text-foreground mb-6 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Gebruiksruimte: Binnen de kaders, met inzicht
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Naast een bemestingsadvies is ook de wettelijke gebruiksruimte cruciaal.{" "}
                {clientConfig.name} berekent uw gebruiksruimte zodat u bij het bepalen van uw
                bemestingsplan ook ziet of u deze niet overschrijdt op perceels- en bedrijfsniveau.
              </p>
            </div>

            <div className="grid items-start gap-12 lg:grid-cols-2">
              {/* Left: Features */}
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
                    <BadgeCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-semibold">Blijf binnen de normen</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We berekenen de gebruiksruimte voor stikstof (N), fosfaat (P2O5) en dierlijke
                      mest op basis van uw percelen en gewassen en tellen die op naar
                      bedrijfsniveau. Zo ziet u direct of uw bemestingsplan voldoet.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
                    <SearchCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-semibold">Inzicht in de berekening</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Geen zwarte doos: we geven inzicht in de opbouw van de berekening, inclusief
                      alle correcties en normen die voor uw specifieke situatie gelden.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Disclaimer Box */}
              <div className="bg-background/50 rounded-2xl border p-8">
                <div className="text-muted-foreground mb-4 flex items-center gap-3">
                  <Info className="h-6 w-6" />
                  <h3 className="text-foreground text-lg font-semibold">Hulp bij berekenen</h3>
                </div>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {clientConfig.name} helpt u bij het berekenen van de gebruiksnormen. De getoonde
                  getallen zijn indicatief en bedoeld ter ondersteuning.
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Voor de juridische werkelijkheid en definitieve opgaven verwijzen we u naar de RVO
                  en uw adviseur.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-background py-24">
          <div className="container mx-auto max-w-6xl px-4 lg:px-8">
            <div className="mx-auto mb-20 max-w-3xl text-center">
              <h2 className="text-foreground mb-6 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Handige functies
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Van slimme imports tot samenwerken met uw adviseur — alles om uw agrarische data
                eenvoudig in te voeren en direct te benutten.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Feature 1: Import */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: 0, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="group bg-card h-full rounded-2xl border p-6 transition-all hover:shadow-md">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                      <FileUp className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="mb-1.5 text-lg font-semibold">Percelen ophalen bij RVO</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Start direct door uw percelen in te lezen via een RVO shapefile of direct te
                        importeren vanuit RVO met behulp van eHerkenning. Uw percelen staan daarmee
                        direct goed in de applicatie, inclusief het gewas.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Feature 2: PDF Parsing */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="group bg-card h-full rounded-2xl border p-6 transition-all hover:shadow-md">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                      <ScanText className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="mb-1.5 text-lg font-semibold">Bodemanalyses</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Upload de PDF van uw bodemanalyse en {clientConfig.name} leest automatisch
                        de juiste waarden uit. Heeft u geen bodemanalyse? Dan kunt u gebruikmaken
                        van geschatte bodemwaardes door het NMI.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Feature 3: Bulk Actions */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="group bg-card h-full rounded-2xl border p-6 transition-all hover:shadow-md">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700">
                      <Table2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="mb-1.5 text-lg font-semibold">Slimme tabellen</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Beheer uw bouwplan, bemesting en oogst in overzichtelijke tabellen. Voer
                        acties uit voor meerdere percelen of gewassen tegelijk.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Feature 4: BodemConditieScore */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="group bg-card h-full rounded-2xl border p-6 transition-all hover:shadow-md">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                      <Camera className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="mb-1.5 text-lg font-semibold">BodemConditieScore</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Voer visuele bodemanalyses uit en bereken uw BodemConditieScore. Maak
                        foto's van uw bodemkuil en voeg notities toe om bodemkenmerken vast te
                        leggen.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Collaboration Section */}
            <div className="border-border mt-20 border-t pt-12">
              <div className="flex flex-col items-center gap-12 lg:flex-row">
                <div className="space-y-6 lg:w-1/2">
                  <div className="bg-background text-foreground inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium shadow-sm">
                    <Users className="text-primary h-4 w-4" />
                    Samenwerking
                  </div>
                  <h3 className="text-2xl font-bold lg:text-3xl">Deel kennis, behoud controle</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {clientConfig.name} is gebouwd voor samenwerking. Geef uw adviseur of
                    organisatie toegang om mee te kijken of advies te geven.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3">
                      <div className="bg-primary/20 text-primary flex h-6 w-6 items-center justify-center rounded-full">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <span className="font-medium">Nodig adviseurs uit per mail</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="bg-primary/20 text-primary flex h-6 w-6 items-center justify-center rounded-full">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <span className="font-medium">Deel met uw organisatie</span>
                    </li>
                  </ul>
                </div>
                <div className="flex justify-center lg:w-1/2">
                  <div className="border-border bg-muted/30 w-full max-w-sm rounded-2xl border p-8 text-center">
                    <ShieldCheck className="text-primary mx-auto mb-4 h-12 w-12" />
                    <h4 className="mb-2 text-lg font-bold">Veilig & vertrouwd</h4>
                    <p className="text-muted-foreground text-sm">
                      U blijft eigenaar van uw data. Delen gebeurt alleen met uw expliciete
                      toestemming en kan op elk moment worden ingetrokken.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-primary text-primary-foreground py-24">
          <div className="container mx-auto max-w-4xl px-4 text-center lg:px-8">
            <h2 className="mb-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              Nieuwsgierig naar de mogelijkheden?
            </h2>
            <p className="text-primary-foreground/70 mx-auto mb-10 max-w-xl text-lg">
              Gratis tijdens de pilot. Geen installatie. Direct aan de slag.
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="text-primary font-semibold"
              onClick={scrollToTop}
            >
              Aanmelden en starten
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="bg-muted/10 py-24">
          <div className="container mx-auto max-w-3xl px-4 lg:px-8">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight">Veelgestelde vragen</h2>
              <p className="text-muted-foreground">
                Antwoorden op de meest voorkomende vragen over {clientConfig.name}.
              </p>
            </div>

            <Accordion type="single" collapsible className="w-full space-y-4">
              <AccordionItem
                value="item-1"
                className="bg-background rounded-lg border-none px-6 shadow-sm"
              >
                <AccordionTrigger className="text-lg font-medium hover:no-underline">
                  Wat kost het gebruik van {clientConfig.name}?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {clientConfig.name} is een open-source initiatief en momenteel gratis te gebruiken
                  tijdens de pilotfase. Ons doel is om een toegankelijke standaard te zetten voor de
                  sector.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="item-2"
                className="bg-background rounded-lg border-none px-6 shadow-sm"
              >
                <AccordionTrigger className="text-lg font-medium hover:no-underline">
                  Wat heb ik nodig om te starten?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Om optimaal gebruik te maken van {clientConfig.name} heeft u uw perceelsdata (RVO
                  shapefile) en recente bodemanalyses (PDF) nodig. U kunt deze eenvoudig importeren.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="item-3"
                className="bg-background rounded-lg border-none px-6 shadow-sm"
              >
                <AccordionTrigger className="text-lg font-medium hover:no-underline">
                  Is mijn data veilig?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Ja. Uw data wordt versleuteld opgeslagen en is alleen toegankelijk voor u. U
                  bepaalt zelf of en met wie (bijv. uw adviseur) u gegevens deelt.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="item-4"
                className="bg-background rounded-lg border-none px-6 shadow-sm"
              >
                <AccordionTrigger className="text-lg font-medium hover:no-underline">
                  Kan ik samenwerken met mijn adviseur?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Zeker. U kunt uw adviseur of andere betrokkenen uitnodigen voor uw bedrijf. U
                  bepaalt welke rechten zij krijgen.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="item-5"
                className="bg-background rounded-lg border-none px-6 shadow-sm"
              >
                <AccordionTrigger className="text-lg font-medium hover:no-underline">
                  Is {clientConfig.name} een officieel overheidsinstrument?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Nee, {clientConfig.name} is ontwikkeld door NMI als ondersteunend instrument voor
                  de sector. Hoewel we nauw samenwerken met onze partners, dient het als inzicht- en
                  adviestool, niet voor wettelijke aangifte.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="item-6"
                className="bg-background rounded-lg border-none px-6 shadow-sm"
              >
                <AccordionTrigger className="text-lg font-medium hover:no-underline">
                  Waar kan ik terecht voor ondersteuning?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Voor technische vragen of feedback kunt u contact opnemen met het supportteam van
                  NMI. We horen graag uw bevindingen om {clientConfig.name} verder te verbeteren.{" "}
                  {clientConfig.name} bevat ook een feedbackknop in de zijbalk om eenvoudig feedback
                  te geven.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        <div className="bg-background border-t py-12">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mb-8 grid gap-8 md:grid-cols-3">
              <div className="col-span-2">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#122023]">
                    <img className="size-6" src={clientConfig.logomark} alt={clientConfig.name} />
                  </div>
                  <span className="text-lg font-semibold">{clientConfig.name}</span>
                </div>
                <p className="text-muted-foreground max-w-xs text-sm">
                  Innovatieve software voor een duurzame landbouw. Een initiatief van het NMI in
                  samenwerking met de sector.
                </p>
              </div>

              <div>
                <h4 className="mb-4 font-semibold">Links</h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    <a
                      href="https://www.nmi-agro.nl"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary flex items-center gap-2"
                    >
                      Over NMI <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/nmi-agro/fdm"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary flex items-center gap-2"
                    >
                      GitHub Repository <SiGithub className="h-3 w-3" />
                    </a>
                  </li>
                  <li>
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary"
                    >
                      Privacybeleid
                    </a>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={onOpenCookieSettings}
                      className="hover:text-primary focus-visible:ring-ring rounded text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      Cookie instellingen
                    </button>
                  </li>
                </ul>
              </div>
            </div>
            <div className="text-muted-foreground border-t pt-8 text-center text-sm">
              Ontwikkeld door{" "}
              <a
                href="https://www.nmi-agro.nl"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground underline underline-offset-2 transition-colors"
              >
                het Nutriënten Management Instituut
              </a>
              . Gelicentieerd onder de MIT-licentie.
            </div>
          </div>
        </div>
      </div>
    </div>
    </MotionConfig>
  )
}

export async function action({ request }: ActionFunctionArgs) {
  // Get the URL object to extract search params
  const url = new URL(request.url)
  const redirectTo = url.searchParams.get("redirectTo") || "/farm"
  // Validate redirectTo to prevent open redirect
  let safeRedirectTo = getSafeRedirect(redirectTo)

  // Get form values
  const formValues = await extractFormValuesFromRequest(request, FormSchema)
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

    // Construct redirect URL preserving redirectTo/callbackURL
    const nextUrl = new URL("/signin/check-your-email", "http://localhost")
    nextUrl.searchParams.set("redirectTo", safeRedirectTo)
    const redirectUrl = `${nextUrl.pathname}${nextUrl.search}`

    return redirectWithSuccess(redirectUrl, `Een aanmeldcode is verstuurd naar ${email}.`)
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
