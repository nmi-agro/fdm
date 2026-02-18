import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion, useScroll } from "framer-motion"
import {
    ArrowDown,
    ArrowRight,
    BadgeCheck,
    BookOpen,
    Calculator,
    CheckCircle2,
    Droplets,
    ExternalLink,
    FileUp,
    FlaskConical,
    Github,
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
import { FormProvider } from "react-hook-form"
import type {
    ActionFunctionArgs,
    LinksFunction,
    LoaderFunctionArgs,
    MetaFunction,
} from "react-router"
import { Form, redirect, useSearchParams } from "react-router"
import { useRemixForm } from "remix-hook-form"
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
    FormDescription,
    FormField,
    FormItem,
    FormMessage,
} from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { auth } from "~/lib/auth.server"
import { signIn } from "~/lib/auth-client"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { modifySearchParams } from "~/lib/url-utils"
import { cn } from "~/lib/utils"
import { extractFormValuesFromRequest } from "../lib/form"
import { isInactiveRecipientError } from "~/lib/email.server"

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
    return address?.startsWith("/") && !address.startsWith("//")
        ? address
        : "/farm"
}

const _UIPlaceholder = ({
    className,
    label,
}: {
    className?: string
    label?: string
}) => (
    <div
        className={cn(
            "w-full h-32 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/10 flex flex-col items-center justify-center gap-2 overflow-hidden relative",
            className,
        )}
    >
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-muted/20" />
        <div className="w-16 h-10 bg-background rounded shadow-sm border opacity-50 mb-1" />
        <div className="w-20 h-2 bg-muted-foreground/20 rounded-full" />
        <div className="w-12 h-2 bg-muted-foreground/20 rounded-full" />
        {label && (
            <span className="text-muted-foreground/50 text-xs font-medium z-10 mt-2">
                {label}
            </span>
        )}
    </div>
)

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
                    className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md px-4 py-3 shadow-xs"
                >
                    <div className="container mx-auto flex max-w-6xl items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-[#122023]">
                                <img
                                    className="size-6"
                                    src={clientConfig.logomark}
                                    alt={clientConfig.name}
                                />
                            </div>
                            <span className="font-semibold">
                                {clientConfig.name}
                            </span>
                        </div>
                        <Button
                            onClick={() =>
                                window.scrollTo({ top: 0, behavior: "smooth" })
                            }
                        >
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
    const [socialSignInError, setSocialSignInError] = useState<string | null>(
        null,
    )

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

    const socialProviderNewUserCallbackUrl = modifySearchParams(
        "/welcome",
        (searchParams) => searchParams.set("redirectTo", redirectTo),
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
        const reduce = window.matchMedia?.(
            "(prefers-reduced-motion: reduce)",
        )?.matches
        moreInfoRef.current?.scrollIntoView({
            behavior: reduce ? "auto" : "smooth",
        })
    }

    const form = useRemixForm<z.infer<typeof FormSchema>>({
        mode: "onTouched",
        resolver: zodResolver(FormSchema),
        defaultValues: {
            email: "",
            timeZone: "",
        },
    })

    useEffect(() => {
        const timeZone = Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone
        form.setValue("timeZone", timeZone)
    }, [form.setValue])

    return (
        <div className="relative">
            <StickyHeader />
            <div className="w-full lg:grid lg:min-h-[600px] lg:grid-cols-2 xl:min-h-[800px] relative">
                {/* Mobile Background Image */}
                <div className="absolute inset-0 lg:hidden z-0 bg-[#122023]">
                    <img
                        src="https://images.unsplash.com/photo-1717702576954-c07131c54169?q=80&w=1200&auto=format&fit=crop"
                        alt="Background"
                        className="h-full w-full object-cover"
                        loading="eager"
                        fetchPriority="high"
                    />
                    <div className="absolute inset-0 bg-black/60" />
                </div>

                <div className="relative z-10 flex min-h-screen flex-col bg-transparent lg:bg-muted/20">
                    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
                        <div className="mx-auto grid w-full max-w-sm gap-6">
                            <Card className="shadow-xl border-border/40 lg:border-border">
                                <CardHeader className="text-center">
                                    <div className="flex justify-center mb-4">
                                        <div className="flex aspect-square size-16 items-center justify-center rounded-lg bg-[#122023]">
                                            <img
                                                className="size-12"
                                                src={clientConfig.logomark}
                                                alt={clientConfig.name}
                                            />
                                        </div>
                                    </div>
                                    <h1 className="text-2xl font-semibold tracking-tight">
                                        {clientConfig.name}
                                    </h1>
                                    <CardDescription>
                                        Meld je aan om toegang te krijgen tot je
                                        dashboard.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid w-full items-center gap-4">
                                        <div className="flex flex-col space-y-1.5">
                                            <Button
                                                variant={"outline"}
                                                className={cn("w-full gap-2")}
                                                disabled={
                                                    loadingProvider !== null
                                                }
                                                onClick={async () => {
                                                    setLoadingProvider(
                                                        "microsoft",
                                                    )
                                                    try {
                                                        await signIn.social({
                                                            provider:
                                                                "microsoft",
                                                            callbackURL:
                                                                redirectTo,
                                                            newUserCallbackURL:
                                                                socialProviderNewUserCallbackUrl,
                                                        })
                                                    } catch (error) {
                                                        handleSignInError(
                                                            "Microsoft",
                                                            error,
                                                        )
                                                    }
                                                }}
                                            >
                                                {loadingProvider ===
                                                "microsoft" ? (
                                                    <div className="flex items-center space-x-2">
                                                        <Spinner />
                                                        <span>
                                                            Aanmelden...
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <svg
                                                            role="img"
                                                            aria-label="Microsoft logo"
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
                                                className={cn("w-full gap-2")}
                                                disabled={
                                                    loadingProvider !== null
                                                }
                                                onClick={async () => {
                                                    try {
                                                        setLoadingProvider(
                                                            "google",
                                                        )
                                                        await signIn.social({
                                                            provider: "google",
                                                            callbackURL:
                                                                redirectTo,
                                                            newUserCallbackURL:
                                                                socialProviderNewUserCallbackUrl,
                                                            // prompt: "select_account",
                                                        })
                                                    } catch (error) {
                                                        handleSignInError(
                                                            "Google",
                                                            error,
                                                        )
                                                    }
                                                }}
                                            >
                                                {loadingProvider ===
                                                "google" ? (
                                                    <div className="flex items-center space-x-2">
                                                        <Spinner />
                                                        <span>
                                                            Aanmelden...
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <svg
                                                            role="img"
                                                            aria-label="Google logo"
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
                                            <p
                                                role="alert"
                                                className="text-sm text-destructive text-center"
                                            >
                                                {socialSignInError}
                                            </p>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <span className="w-full border-t" />
                                        </div>
                                        <div className="relative flex justify-center text-xs uppercase">
                                            <span className="bg-background px-2 text-muted-foreground">
                                                Of
                                            </span>
                                        </div>
                                    </div>
                                    <FormProvider {...form}>
                                        <Form
                                            id="formSigninMagicLink"
                                            onSubmit={form.handleSubmit}
                                            method="POST"
                                        >
                                            <fieldset
                                                disabled={
                                                    form.formState.isSubmitting
                                                }
                                            >
                                                <div className="grid w-full items-center gap-4">
                                                    <div className="flex flex-col space-y-1.5">
                                                        <FormField
                                                            control={
                                                                form.control
                                                            }
                                                            name="timeZone"
                                                            render={({
                                                                field,
                                                            }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="hidden"
                                                                            {...field}
                                                                        />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={
                                                                form.control
                                                            }
                                                            name="email"
                                                            render={({
                                                                field,
                                                            }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input
                                                                            placeholder="E-mailadres"
                                                                            aria-required="true"
                                                                            {...field}
                                                                        />
                                                                    </FormControl>
                                                                    <FormDescription />
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>
                                                    <Button
                                                        type="submit"
                                                        className="w-full"
                                                    >
                                                        {form.formState
                                                            .isSubmitting ? (
                                                            <div className="flex items-center space-x-2">
                                                                <Spinner />
                                                                <span>
                                                                    Aanmelden...
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            "Aanmelden met e-mail"
                                                        )}
                                                    </Button>
                                                </div>
                                            </fieldset>
                                        </Form>
                                    </FormProvider>
                                </CardContent>
                                <CardFooter className="flex flex-col gap-2">
                                    <p className="text-sm font-medium text-muted-foreground text-center">
                                        Door verder te gaan, gaat u akkoord met
                                        het{" "}
                                        <a
                                            href={clientConfig.privacy_url}
                                            aria-label="Lees ons privacybeleid"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline decoration-primary/30 underline-offset-4 hover:text-primary hover:decoration-primary transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        >
                                            Privacybeleid
                                        </a>
                                    </p>
                                </CardFooter>
                            </Card>
                            <div className="text-center">
                                <Button
                                    variant="ghost"
                                    onClick={scrollToMoreInfo}
                                    className="group text-muted-foreground hover:text-foreground lg:text-muted-foreground hover:bg-white/10 lg:hover:bg-transparent"
                                >
                                    Ontdek wat {clientConfig.name} kan doen
                                    <MoveDown className="ml-2 h-4 w-4 animate-up-and-down-down" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="hidden bg-muted lg:block relative">
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
                                <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                    Samen leren en innoveren
                                </h2>
                                <div className="mb-8 space-y-4 text-lg leading-relaxed text-muted-foreground">
                                    <p>
                                        {clientConfig.name} is een initiatief
                                        van het Nutriënten Management Instituut
                                        (NMI) en is volop in ontwikkeling, maar
                                        nu al inzetbaar voor uw bedrijf.{" "}
                                        {clientConfig.name} is bovendien een
                                        open-source. Dit betekent transparantie
                                        en de mogelijkheid voor derden om bij te
                                        dragen aan de doorontwikkeling. Door
                                        drie innovatieve projecten samen te
                                        brengen, faciliteren we kennisdeling en
                                        versnellen we de transitie naar een
                                        duurzamere landbouw:
                                    </p>
                                    <ul className="space-y-3">
                                        <li className="flex gap-2">
                                            <span className="mt-2 flex h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                            <span>
                                                <strong className="text-foreground">
                                                    Pilot Maatwerkaanpak:
                                                </strong>{" "}
                                                In samenwerking met boeren, de
                                                agrarische sector,
                                                kennisinstellingen, overheden en
                                                overheidsorganisaties testen we
                                                hoe doelsturing werkt in de
                                                praktijk, met de Stikstofbalans
                                                als basis.
                                            </span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="mt-2 flex h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                            <span>
                                                <strong className="text-foreground">
                                                    PPS BAAT:
                                                </strong>{" "}
                                                Samen met Wageningen Plant
                                                Research maken we
                                                bemestingsadvies toegankelijker.
                                                Krijg inzicht in zowel de
                                                geadviseerde gift als
                                                milieu-impact voor een bewuste
                                                meststofkeuze.
                                            </span>
                                        </li>
                                        <li className="flex gap-2 items-baseline">
                                            <span className="mt-2 flex h-1.5 w-1.5 shrink-0 rounded-full bg-primary items-center" />
                                            <span>
                                                <strong className="text-foreground">
                                                    Open Bodem Index & BBWP:
                                                </strong>{" "}
                                                Deze twee veelgebruikte methoden
                                                helpen boeren en adviseurs nu al
                                                in het effectief nemen van
                                                maatregelen en het inzicht
                                                krijgen in de bodemgezondheid.
                                                In 2026 komen OBI en BBWP ook
                                                beschikbaar in{" "}
                                                {clientConfig.name} en maken we
                                                ze nog toegangelijker.
                                            </span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="border-t border-border pt-6">
                                    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Partners
                                    </p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-foreground/80">
                                        <span>ZLTO</span>•<span>LTO Noord</span>
                                        •<span>WUR</span>•<span>LVVN</span>•
                                        <span>NVWA</span>•<span>RVO</span>
                                    </div>
                                </div>
                            </div>

                            <div className="relative">
                                <div className="absolute -inset-4 -z-10 rounded-3xl bg-linear-to-tr from-primary/20 to-blue-500/20 blur-2xl opacity-70" />

                                <Card className="border-muted/40 bg-background shadow-xl">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-xl">
                                            <Target className="h-5 w-5 text-primary" />
                                            Uitgangspunten
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid gap-6">
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                                                <CheckCircle2 className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">
                                                    Praktijktoets
                                                </h4>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    Leren en ontdekken hoe
                                                    doelsturing werkt in de
                                                    echte wereld.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                                                <CheckCircle2 className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">
                                                    Transparant & deelbaar
                                                </h4>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    Als open-source inititiaf
                                                    zijn de rekenregels en
                                                    methodes beschikbaar en kan
                                                    iedereen deze lezen en
                                                    verbeteringn ops
                                                    voorstellen.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                                                <CheckCircle2 className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">
                                                    In ontwikkeling
                                                </h4>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    Een groeiend platform dat
                                                    continu wordt verbeterd op
                                                    basis van uw feedback.
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
                            <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                Doelsturing: Kansen en uitdagingen
                            </h2>
                            <p className="text-lg leading-relaxed text-muted-foreground">
                                Doelsturing kan een effectieve methode zijn om
                                de waterkwaliteit te verbeteren en
                                ammoniakemissies te verminderen, doordat u als
                                ondernemer zelf de maatregelen kiest. De
                                keerzijde is dat dit vraagt om veel en
                                gedetailleerde data. {clientConfig.name} streeft
                                ernaar om deze complexe berekening zo eenvoudig
                                mogelijk te maken, zonder in te leveren op
                                nauwkeurigheid.
                            </p>
                        </div>

                        <div className="relative">
                            {/* Connecting line for desktop */}
                            <div className="absolute top-1/2 left-0 hidden w-full -translate-y-1/2 lg:block h-px z-0 pointer-events-none px-12">
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

                            <div className="grid gap-8 lg:grid-cols-4 relative z-10">
                                {/* Step 1: Supply */}
                                <div className="group rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
                                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                                        <ArrowDown className="h-7 w-7" />
                                    </div>
                                    <h3 className="mb-2 text-lg font-semibold">
                                        Aanvoer
                                    </h3>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                        <li>• Kunstmest</li>
                                        <li>• Dierlijke mest</li>
                                        <li>• Compost</li>
                                        <li>• Overige meststoffen</li>
                                        <li>• Bodemlevering</li>
                                        <li>• Depositie</li>
                                    </ul>
                                </div>

                                {/* Step 2: Removal & Ammonia */}
                                <div className="group rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
                                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                                        <ArrowRight className="h-7 w-7" />
                                    </div>
                                    <h3 className="mb-2 text-lg font-semibold">
                                        Afvoer & Emissie
                                    </h3>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                        <li>• Oogst </li>
                                        <li>• Gewasresten </li>
                                        <li>• Ammoniak</li>
                                        <li>• Nitraat</li>
                                    </ul>
                                </div>

                                {/* Step 3: Surplus */}
                                <div className="group rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
                                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
                                        <Scale className="h-7 w-7" />
                                    </div>
                                    <h3 className="mb-2 text-lg font-semibold">
                                        Stikstofbodemoverschot
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Het stikstofbodemoverschot laat zien hoe
                                        efficiënt stikstof wordt gebruik.
                                    </p>
                                </div>

                                {/* Step 4: Leaching */}
                                <div className="group rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
                                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                                        <Droplets className="h-7 w-7" />
                                    </div>
                                    <h3 className="mb-2 text-lg font-semibold">
                                        Waterkwaliteit
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Nitraatuitspoeling berekend als fractie
                                        van het overschot.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-muted/10 py-24">
                    <div className="container mx-auto max-w-6xl px-4 lg:px-8">
                        <div className="mb-20 mx-auto max-w-3xl text-center">
                            <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                Atlas: Alles in kaart gebracht
                            </h2>
                            <p className="text-lg leading-relaxed text-muted-foreground">
                                Verken agrarisch Nederland met de interactieve
                                Atlas. Navigeer door de jaren heen en krijg
                                direct inzicht in perceelshistorie, het
                                microreliëf en gebiedskenmerken.
                            </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {/* 1. Rotatie (Wide Top-Left) */}
                            <Card className="bg-background border-none shadow-sm hover:shadow-md transition-all lg:col-span-2 overflow-hidden flex flex-col">
                                <div className="p-6">
                                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <Sprout className="h-6 w-6" />
                                    </div>
                                    <CardTitle className="text-lg mb-2">
                                        Gewasrotatie in beeld
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        De interactieve kaart toont
                                        gewaspercelen tot 2020, helder
                                        ingekleurd per gewasgroup. Krijg direct
                                        visueel inzicht in toegepaste rotaties
                                        door de jaren heen.
                                    </p>
                                </div>
                                <div className="w-full aspect-video bg-muted/20 border-t relative">
                                    <img
                                        src="/fdm-screenshot-atlas-cultivations.png"
                                        alt="Gewasrotatie screenshot"
                                        className="absolute inset-0 w-full h-full object-cover object-top"
                                    />
                                </div>
                            </Card>

                            {/* 3. History (Tall Right) - HTML order swapped for Mobile/Desktop strategy, 
                                                        but explicit grid placement puts it on the right. 
                                                        Actually, if I want Elevation second on mobile, History must be 3rd in HTML. 
                                                        Explicit grid placement handles Desktop. */}

                            {/* 2. Elevation (Wide Middle-Left) */}
                            <Card className="bg-background border-none shadow-sm hover:shadow-md transition-all lg:col-span-2 flex flex-col">
                                <CardHeader>
                                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <Mountain className="h-6 w-6" />
                                    </div>
                                    <CardTitle className="text-lg">
                                        Hoogtekaart (AHN4)
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                        Bekijk de AHN4 voor een gedetailleerde
                                        weergave van het hoogteverloop.
                                    </p>
                                </CardHeader>
                                <div className="relative aspect-video w-full mt-auto rounded-lg overflow-hidden border shadow-xs">
                                    <img
                                        src="/fdm-screenshot-atlas-elevation.png"
                                        alt="Hoogtekaart AHN4"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </Card>

                            {/* 3. History (Tall Right) */}
                            <Card className="bg-background border-none shadow-sm hover:shadow-md transition-all lg:col-start-3 lg:row-start-1 lg:row-span-2 flex flex-col overflow-hidden">
                                <CardHeader>
                                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <History className="h-6 w-6" />
                                    </div>
                                    <CardTitle className="text-lg">
                                        Gewashistorie
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Klik op een perceel voor meer
                                        informatie: bekijk de volledige
                                        gewashistorie tot 2009.
                                    </p>
                                </CardHeader>
                                <div className="relative w-full flex-1 min-h-[400px] bg-muted/10 border-t p-4 flex items-start justify-center">
                                    <img
                                        src="/fdm-screenshot-atlas-cultivation-history.png"
                                        alt="Gewashistorie screenshot"
                                        className="w-full h-auto max-h-full object-contain rounded-md shadow-sm bg-background"
                                    />
                                </div>
                            </Card>
                            {/* 4. Normen (Small Bottom-Left) */}
                            <Card className="bg-background border-none shadow-sm hover:shadow-md transition-all lg:col-span-1">
                                <CardHeader>
                                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <Landmark className="h-6 w-6" />
                                    </div>
                                    <CardTitle className="text-lg">
                                        Gebiedsgerichte normen
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Zie direct in welke regio's voor de
                                        gebruiksnormen het perceel ligt.
                                    </p>
                                </CardContent>
                            </Card>

                            {/* 5. Bodem (Wide Bottom-Right) */}
                            <Card className="bg-background border-none shadow-sm hover:shadow-md transition-all lg:col-span-2">
                                <CardHeader>
                                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <LayersIcon className="h-6 w-6" />
                                    </div>
                                    <CardTitle className="text-lg">
                                        Bodem & water
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Raadpleeg data voor uw gewas: van
                                        grondwatertrappen tot de
                                        bodemsamenstelling zoals zand-, klei- en
                                        siltgehalte.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>{" "}
                    </div>
                </div>

                <div className="bg-background py-24">
                    <div className="container mx-auto max-w-6xl px-4 lg:px-8">
                        <div className="mb-20 mx-auto max-w-3xl text-center">
                            <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                Bemestingsadviezen: Kennis binnen handbereik
                            </h2>
                            <p className="text-lg leading-relaxed text-muted-foreground">
                                Bij NMI hebben we jarenlange kennis van
                                bemesting en bodemvruchtbaarheid omgezet in
                                digitale adviezen, direct beschikbaar in{" "}
                                {clientConfig.name}.
                            </p>
                        </div>

                        <div className="grid gap-12 lg:grid-cols-2 items-start mb-16">
                            {/* Left: Text with Benefits */}
                            <div>
                                <h3 className="text-2xl font-semibold mb-6">
                                    Altijd het juiste advies voor uw gewas
                                </h3>
                                <div className="space-y-6">
                                    <div className="flex items-start gap-4">
                                        <BookOpen className="h-6 w-6 text-primary shrink-0 mt-1" />
                                        <div>
                                            <h4 className="font-semibold">
                                                Gebundelde expertise
                                            </h4>
                                            <p className="text-muted-foreground">
                                                We brengen per perceel en voor
                                                elk gewas in beeld wat de
                                                gewenste bemesting is volgens de
                                                adviezen uit{" "}
                                                <strong className="text-foreground">
                                                    CBGV (Bemestingsadvies)
                                                </strong>{" "}
                                                en{" "}
                                                <strong className="text-foreground">
                                                    CBAV (Handboek Bodem en
                                                    Bemesting)
                                                </strong>{" "}
                                                .
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <ListChecks className="h-6 w-6 text-primary shrink-0 mt-1" />
                                        <div>
                                            <h4 className="font-semibold">
                                                Voor alle nutriënten
                                            </h4>
                                            <p className="text-muted-foreground">
                                                Adviezen omvatten primaire (N,
                                                P, K), organische stof,
                                                secundaire en micronutriënten,
                                                specifiek voor uw gewas en
                                                bodemtoestand.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <Calculator className="h-6 w-6 text-primary shrink-0 mt-1" />
                                        <div>
                                            <h4 className="font-semibold">
                                                Inzicht in uw bemesting
                                            </h4>
                                            <p className="text-muted-foreground">
                                                Naast de geadviseerde gift tonen
                                                we per nutriënt ook hoeveel u
                                                daadwerkelijk heeft gegeven,
                                                gebaseerd op uw ingevoerde
                                                bemestingsplannen.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Emphasize Importance */}
                            <Card className="shadow-lg border-primary/20 bg-background h-full">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FlaskConical className="h-6 w-6 text-primary" />
                                        Waarom is een bemestingsadvies
                                        belangrijk
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-muted-foreground leading-relaxed">
                                        Bemestingsadviezen gaan verder dan enkel
                                        de wettelijke
                                        <strong className="text-foreground">
                                            {" "}
                                            gebruiksnormen
                                        </strong>
                                        . Ze zijn cruciaal for:
                                    </p>
                                    <ul className="space-y-2 text-muted-foreground">
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                            <span>
                                                Optimale opbrengst en kwaliteit
                                                van het gewas.
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                            <span>
                                                Het behouden en verbeteren van
                                                bodemvruchtbaarheid op lange
                                                termijn.
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                            <span>
                                                Efficiënt gebruik van
                                                nutriënten, ter voorkoming van
                                                overbemesting en verliezen.
                                            </span>
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Full width screenshot */}
                        <div className="rounded-xl border bg-background shadow-2xl overflow-hidden ring-1 ring-border/50">
                            <div className="border-b bg-muted/40 p-3 flex items-center gap-2">
                                <div className="flex gap-1.5 ml-1">
                                    <div className="w-3 h-3 rounded-full bg-red-400/80 border border-red-500/20" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-400/80 border border-yellow-500/20" />
                                    <div className="w-3 h-3 rounded-full bg-green-400/80 border border-green-500/20" />
                                </div>
                                {/* <div className="ml-4 h-6 bg-background rounded-md border w-64 flex items-center px-2">
                                    <span className="text-[10px] text-muted-foreground">fdm.app/advies</span>
                                </div> */}
                            </div>
                            <div className="relative w-full bg-muted/5">
                                <img
                                    src="/fdm-screenshot-nutrient-advice-npk.png"
                                    alt="Bemestingsadvies tabel"
                                    className="w-full h-auto shadow-inner"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-muted/10 py-24">
                    <div className="container mx-auto max-w-6xl px-4 lg:px-8">
                        <div className="mb-20 mx-auto max-w-3xl text-center">
                            <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                Gebruiksruimte: Binnen de kaders, met inzicht
                            </h2>
                            <p className="text-lg leading-relaxed text-muted-foreground">
                                Naast een bemestingsadvies is ook de wettelijke
                                gebruiksruimte cruciaal. {clientConfig.name}{" "}
                                berekent uw gebruiksruimte zodat u bij het
                                bepalen van uw bemestingsplan ook ziet of u deze
                                niet overschrijdt op perceels- en
                                bedrijfsniveau.
                            </p>
                        </div>

                        <div className="grid gap-12 lg:grid-cols-2 items-start">
                            {/* Left: Features */}
                            <div className="space-y-8">
                                <div className="flex gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <BadgeCheck className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold mb-2">
                                            Blijf binnen de normen
                                        </h3>
                                        <p className="text-muted-foreground leading-relaxed">
                                            We berekenen de gebruiksruimte for
                                            stikstof (N), fosfaat (P2O5) en
                                            dierlijke mest op basis van uw
                                            percelen en gewassen en tellen die
                                            op naar bedrijfsniveau. Zo ziet u
                                            direct of uw bemestingsplan voldoet.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <SearchCheck className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold mb-2">
                                            Inzicht in de berekening
                                        </h3>
                                        <p className="text-muted-foreground leading-relaxed">
                                            Geen zwarte doos: we geven inzicht
                                            in de opbouw van de berekening,
                                            inclusief alle correcties en normen
                                            die voor uw specifieke situatie
                                            gelden.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Disclaimer Box */}
                            <div className="rounded-2xl border bg-background/50 p-8">
                                <div className="flex items-center gap-3 mb-4 text-muted-foreground">
                                    <Info className="h-6 w-6" />
                                    <h3 className="font-semibold text-lg text-foreground">
                                        Hulp bij berekenen
                                    </h3>
                                </div>
                                <p className="text-muted-foreground leading-relaxed mb-6">
                                    {clientConfig.name} helpt je bij het
                                    berekenen van de gebruiksnormen. De getoonde
                                    getallen zijn indicatief en bedoeld ter
                                    ondersteuning.
                                </p>
                                <p className="text-muted-foreground leading-relaxed text-sm">
                                    Voor de juridische werkelijkheid en
                                    definitieve opgaven verwijzen we je naar de
                                    RVO en je adviseur.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-background py-24">
                    <div className="container mx-auto max-w-6xl px-4 lg:px-8">
                        <div className="mb-20 mx-auto max-w-3xl text-center">
                            <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                Handige functies
                            </h2>
                            <p className="text-lg leading-relaxed text-muted-foreground">
                                Van slimme imports tot samenwerken met uw
                                adviseur. Met handige functies proberen we het
                                zo makkelijk mogelijk te maken om eenvoudig
                                gegevens in te vullen, zodat u snel toegang
                                heeft tot
                            </p>
                        </div>

                        <div className="grid gap-12 lg:grid-cols-3">
                            {/* Feature 1: Import */}
                            <div className="flex flex-col items-center space-y-4 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                                    <FileUp className="h-8 w-8" />
                                </div>
                                <h3 className="text-xl font-semibold">
                                    Percelen ophalen bij RVO
                                </h3>
                                <p className="text-muted-foreground">
                                    Start direct door uw percelen in te lezen
                                    via een RVO shapefile. Uw percelen staan
                                    binnen enkele seconden correct op de kaart,
                                    inclusief het gewas.
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    Binnenkort heeft u ook de mogelijkheid
                                    direct vanuit RVO percelen te importeren met
                                    behulp van eHerkenning.
                                </p>
                            </div>

                            {/* Feature 2: PDF Parsing */}
                            <div className="flex flex-col items-center space-y-4 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                                    <ScanText className="h-8 w-8" />
                                </div>
                                <h3 className="text-xl font-semibold">
                                    Bodemanalyses
                                </h3>
                                <p className="text-muted-foreground">
                                    Upload de PDF van uw bodemanalyse en{" "}
                                    {clientConfig.name} leest automatisch de
                                    juiste waarden uit. Heeft u geen
                                    bodemanalyse voor een perceel? Dan kunt u
                                    gebruiken maken van geschatte bodemwaardes
                                    door het NMI.
                                </p>
                            </div>

                            {/* Feature 3: Bulk Actions */}
                            <div className="flex flex-col items-center space-y-4 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 text-green-700">
                                    <Table2 className="h-8 w-8" />
                                </div>
                                <h3 className="text-xl font-semibold">
                                    Slimme tabellen
                                </h3>
                                <p className="text-muted-foreground">
                                    Beheer uw bouwplan, bemesting en oogst in
                                    overzichtelijke tabellen. Voer acties uit
                                    voor meerdere percelen of gewassen tegelijk.
                                </p>
                            </div>
                        </div>

                        {/* Collaboration Section */}
                        <div className="mt-20 rounded-3xl bg-muted/30 p-8 lg:p-12">
                            <div className="flex flex-col items-center gap-12 lg:flex-row">
                                <div className="space-y-6 lg:w-1/2">
                                    <div className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-1.5 text-sm font-medium text-foreground shadow-sm">
                                        <Users className="h-4 w-4 text-primary" />
                                        Samenwerking
                                    </div>
                                    <h3 className="text-2xl font-bold lg:text-3xl">
                                        Deel kennis, behoud controle
                                    </h3>
                                    <p className="leading-relaxed text-muted-foreground">
                                        {clientConfig.name} is gebouwd for
                                        samenwerking. Geef uw adviseur of
                                        organisatie toegang om mee te kijken of
                                        advies te geven.
                                    </p>
                                    <ul className="space-y-3">
                                        <li className="flex items-center gap-3">
                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary">
                                                <CheckCircle2 className="h-4 w-4" />
                                            </div>
                                            <span className="font-medium">
                                                Nodig adviseurs uit per mail
                                            </span>
                                        </li>
                                        <li className="flex items-center gap-3">
                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary">
                                                <CheckCircle2 className="h-4 w-4" />
                                            </div>
                                            <span className="font-medium">
                                                Deel met uw organisatie
                                            </span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="flex justify-center lg:w-1/2">
                                    <Card className="w-full max-w-sm border-primary/10 bg-background shadow-xl">
                                        <CardContent className="space-y-6 p-8 text-center">
                                            <ShieldCheck className="mx-auto h-16 w-16 text-primary" />
                                            <div>
                                                <h4 className="mb-2 text-lg font-bold">
                                                    Veilig & vertrouwd
                                                </h4>
                                                <p className="text-sm text-muted-foreground">
                                                    U blijft eigenaar van uw
                                                    data. Delen gebeurt alleen
                                                    met uw expliciete
                                                    toestemming en kan op elk
                                                    moment worden ingetrokken.
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-primary py-24 text-primary-foreground">
                    <div className="container mx-auto max-w-4xl px-4 lg:px-8 text-center">
                        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
                            Nieuwsgierig naar de mogelijkheden?
                        </h2>
                        <p className="text-primary-foreground/80 text-lg mb-10 max-w-2xl mx-auto">
                            Probeer {clientConfig.name} uit. We horen graag wat
                            uw mening is en of u tips heeft.
                        </p>
                        <Button
                            size="lg"
                            variant="secondary"
                            className="font-semibold text-primary"
                            onClick={() =>
                                window.scrollTo({ top: 0, behavior: "smooth" })
                            }
                        >
                            Probeer het uit
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="bg-muted/10 py-24">
                    <div className="container mx-auto max-w-3xl px-4 lg:px-8">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-bold tracking-tight mb-4">
                                Veelgestelde vragen
                            </h2>
                            <p className="text-muted-foreground">
                                Antwoorden op de meest voorkomende vragen over{" "}
                                {clientConfig.name}.
                            </p>
                        </div>

                        <Accordion
                            type="single"
                            collapsible
                            className="w-full space-y-4"
                        >
                            <AccordionItem
                                value="item-1"
                                className="border-none rounded-lg bg-background px-6 shadow-sm"
                            >
                                <AccordionTrigger className="text-lg hover:no-underline font-medium">
                                    Wat kost het gebruik van {clientConfig.name}
                                    ?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    {clientConfig.name} is een open-source
                                    initiatief en momenteel gratis te gebruiken
                                    tijdens de pilotfase. Ons doel is om een
                                    toegankelijke standaard te zetten voor de
                                    sector.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem
                                value="item-2"
                                className="border-none rounded-lg bg-background px-6 shadow-sm"
                            >
                                <AccordionTrigger className="text-lg hover:no-underline font-medium">
                                    Wat heb ik nodig om te starten?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    Om optimaal gebruik te maken van{" "}
                                    {clientConfig.name} heeft u uw perceelsdata
                                    (RVO shapefile) en recente bodemanalyses
                                    (PDF) nodig. U kunt deze eenvoudig
                                    importeren.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem
                                value="item-3"
                                className="border-none rounded-lg bg-background px-6 shadow-sm"
                            >
                                <AccordionTrigger className="text-lg hover:no-underline font-medium">
                                    Is mijn data veilig?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    Ja. Uw data wordt versleuteld opgeslagen en
                                    is alleen toegankelijk voor u. U bepaalt
                                    zelf of en met wie (bijv. uw adviseur) u
                                    gegevens deelt.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem
                                value="item-4"
                                className="border-none rounded-lg bg-background px-6 shadow-sm"
                            >
                                <AccordionTrigger className="text-lg hover:no-underline font-medium">
                                    Kan ik samenwerken met mijn adviseur?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    Zeker. U kunt uw adviseur of andere
                                    betrokkenen uitnodigen voor uw bedrijf. U
                                    bepaalt welke rechten zij krijgen.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem
                                value="item-5"
                                className="border-none rounded-lg bg-background px-6 shadow-sm"
                            >
                                <AccordionTrigger className="text-lg hover:no-underline font-medium">
                                    Is {clientConfig.name} een officieel
                                    overheidsinstrument?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    Nee, {clientConfig.name} is ontwikkeld door
                                    NMI als ondersteunend instrument voor de
                                    sector. Hoewel we nauw samenwerken met onze
                                    partners, dient het als inzicht- en
                                    adviestool, niet voor wettelijke aangifte.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem
                                value="item-6"
                                className="border-none rounded-lg bg-background px-6 shadow-sm"
                            >
                                <AccordionTrigger className="text-lg hover:no-underline font-medium">
                                    Waar kan ik terecht voor ondersteuning?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    Voor technische vragen of feedback kunt u
                                    contact opnemen met het supportteam van NMI.
                                    We horen graag uw bevindingen om{" "}
                                    {clientConfig.name} verder te verbeteren.{" "}
                                    {clientConfig.name} bevat ook een
                                    feedbackknop in de zijbalk om eenvoudig
                                    feedback te geven.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                </div>

                <div className="border-t bg-background py-12">
                    <div className="container mx-auto px-4 lg:px-8">
                        <div className="grid gap-8 md:grid-cols-3 mb-8">
                            <div className="col-span-2">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#122023]">
                                        <img
                                            className="size-6"
                                            src={clientConfig.logomark}
                                            alt={clientConfig.name}
                                        />
                                    </div>
                                    <span className="font-semibold text-lg">
                                        {clientConfig.name}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground max-w-xs">
                                    Innovatieve software voor een duurzame
                                    landbouw. Een initiatief van het NMI in
                                    samenwerking met de sector.
                                </p>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-4">Links</h4>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li>
                                        <a
                                            href="https://www.nmi-agro.nl"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-primary flex items-center gap-2"
                                        >
                                            Over NMI{" "}
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href="https://github.com/SvenVw/fdm"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-primary flex items-center gap-2"
                                        >
                                            GitHub Repository{" "}
                                            <Github className="h-3 w-3" />
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href={clientConfig.privacy_url}
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
                                            className="hover:text-primary text-left"
                                        >
                                            Cookie instellingen
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="border-t pt-8 text-center text-sm text-muted-foreground">
                            Ontwikkeld door het Nutriënten Management Instituut.
                            Gelicentieerd onder de MIT-licentie.
                        </div>
                    </div>
                </div>
            </div>
        </div>
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
        } catch (_) {}
    }

    if (timeZone) {
        const safeRedirectToUrl = new URL(
            safeRedirectTo,
            "http://localhost:9999",
        )
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

        return redirectWithSuccess(
            redirectUrl,
            `Een aanmeldcode is verstuurd naar ${email}.`,
        )
    } catch (error) {
        if (isInactiveRecipientError(error)) {
            return dataWithError(null, {
                message:
                    "We hebben geen toestemming om e-mails naar dit adres te versturen. Neem contact op met de ondersteuning voor hulp.",
            })
        }
        console.error("Error sending magic link") // Don't log full error details
        handleActionError(error)
    }
}
