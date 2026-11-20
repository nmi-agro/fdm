import { zodResolver } from "@hookform/resolvers/zod"
import { cn } from "cn"
import { CheckCircle2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Controller, useWatch, type Resolver } from "react-hook-form"
import { Form } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { z } from "zod"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "~/components/ui/card"
import { Field, FieldContent, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { useAnalytics } from "~/hooks/use-analytics"
import { signIn } from "~/lib/auth-client"
import { clientConfig } from "~/lib/config"
import { modifySearchParams } from "~/lib/url-utils"

/** Schema of the magic-link form; shared by the card and the route action. */
export const SignInFormSchema = z.object({
  timeZone: z.string().optional(),
  email: z.email({
    error: "Dit is geen geldig e-mailadres",
  }),
})

type SignInFormValues = z.infer<typeof SignInFormSchema>

/** Id of the card, the target of the "Aanmelden" links elsewhere on the page. */
export const SIGN_IN_CARD_ID = "aanmelden"

/** Id of the e-mail input, so other parts of the page can move focus to it. */
export const SIGN_IN_EMAIL_INPUT_ID = "email"

type SocialProvider = "microsoft" | "google"

// The labels are written out in full: the user manual quotes them, and its label test looks them up
const SOCIAL_PROVIDERS: { id: SocialProvider; name: string; label: string }[] = [
  { id: "microsoft", name: "Microsoft", label: "Aanmelden met Microsoft" },
  { id: "google", name: "Google", label: "Aanmelden met Google" },
]

function MicrosoftLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M44.522 44.5217H489.739V489.739H44.522V44.5217Z" fill="#F35325" />
      <path d="M534.261 44.5217H979.478V489.739H534.261V44.5217Z" fill="#81BC06" />
      <path d="M44.522 534.261H489.739V979.478H44.522V534.261Z" fill="#05A6F0" />
      <path d="M534.261 534.261H979.478V979.478H534.261V534.261Z" fill="#FFBA08" />
    </svg>
  )
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 262">
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
  )
}

/**
 * The sign-in card of the public landing page: Microsoft, Google and magic link.
 *
 * The card follows the interior rules (flat, calm); the marketing around it may be expressive.
 *
 * @param redirectTo - Validated path to open after signing in.
 * @param redirectError - Explanation of an error the provider sent the visitor back with.
 */
export function SignInCard({
  redirectTo,
  redirectError,
}: {
  redirectTo: string
  redirectError: string | null
}) {
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null)
  const [handlerError, setHandlerError] = useState<string | null>(null)
  const { capture } = useAnalytics()

  // A failed sign-in attempt in this session takes precedence over the redirect error
  const socialSignInError = handlerError ?? redirectError

  const newUserCallbackURL = modifySearchParams("/welcome", (searchParams) =>
    searchParams.set("redirectTo", redirectTo),
  )
  // Send OAuth errors (e.g. `account_not_linked`) back to this page so they can be explained
  const errorCallbackURL = modifySearchParams("/signin", (searchParams) =>
    searchParams.set("redirectTo", redirectTo),
  )

  const signInWithProvider = async (provider: SocialProvider, name: string) => {
    setLoadingProvider(provider)
    capture("signin_oauth_clicked", { provider })
    try {
      await signIn.social({
        provider,
        callbackURL: redirectTo,
        newUserCallbackURL,
        errorCallbackURL,
      })
    } catch (error) {
      setLoadingProvider(null)
      setHandlerError(
        `Er is helaas iets misgegaan bij het aanmelden met ${name}. Probeer het opnieuw.`,
      )
      console.error("Social sign-in failed:", error)
    }
  }

  const form = useRemixForm<SignInFormValues>({
    mode: "onTouched",
    resolver: zodResolver(SignInFormSchema) as Resolver<SignInFormValues>,
    defaultValues: {
      email: "",
      timeZone: "",
    },
  })

  const formSetValue = form.setValue
  useEffect(() => {
    const timeZone = Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone
    formSetValue("timeZone", timeZone)
  }, [formSetValue])

  const emailValue = useWatch({ control: form.control, name: "email" }) ?? ""
  const emailHasError = !!form.formState.errors.email
  const emailIsTouched = form.getFieldState("email").isTouched
  const emailIsValid = emailValue.length > 0 && emailIsTouched && !emailHasError

  return (
    <Card id={SIGN_IN_CARD_ID} className="scroll-mt-20 shadow-sm">
      <CardHeader className="text-center">
        <div className="mb-3 flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-lg bg-[#122023]">
            <img className="size-9" src={clientConfig.logomark} alt="" />
          </div>
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Aanmelden bij {clientConfig.name}</h2>
        <CardDescription>
          Nog geen account? Dat maken we aan bij uw eerste aanmelding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {SOCIAL_PROVIDERS.map((provider) => (
            <Button
              key={provider.id}
              variant="outline"
              className="w-full gap-2 [&_svg]:size-4"
              disabled={loadingProvider !== null}
              onClick={() => void signInWithProvider(provider.id, provider.name)}
            >
              {loadingProvider === provider.id ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  <span>Aanmelden...</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {provider.id === "microsoft" ? <MicrosoftLogo /> : <GoogleLogo />}
                  <span>{provider.label}</span>
                </span>
              )}
            </Button>
          ))}
          {socialSignInError ? (
            <p role="alert" className="text-destructive text-center text-sm">
              {socialSignInError}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 border-t" />
          <span className="text-muted-foreground text-xs">of met een aanmeldlink</span>
          <span className="h-px flex-1 border-t" />
        </div>
        <RemixFormProvider {...form}>
          <Form
            id="formSigninMagicLink"
            onSubmit={(e) => {
              capture("signin_magic_link_submitted")
              void form.handleSubmit(e)
            }}
            method="post"
          >
            <fieldset disabled={form.formState.isSubmitting} className="grid gap-4">
              <Controller
                name="timeZone"
                render={({ field }) => <input type="hidden" {...field} />}
              />
              <Controller
                name="email"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor={SIGN_IN_EMAIL_INPUT_ID}>E-mailadres</FieldLabel>
                    <FieldContent>
                      <div className="relative">
                        <Input
                          id={SIGN_IN_EMAIL_INPUT_ID}
                          aria-invalid={fieldState.invalid}
                          type="email"
                          autoComplete="email"
                          placeholder="naam@bedrijf.nl"
                          className={cn(emailIsValid && "pr-9")}
                          {...field}
                        />
                        {emailIsValid ? (
                          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2">
                            <CheckCircle2 className="size-4 text-green-700" aria-hidden="true" />
                          </span>
                        ) : null}
                      </div>
                    </FieldContent>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Button type="submit" className="w-full">
                {form.formState.isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    <span>Aanmelden...</span>
                  </span>
                ) : (
                  <span>Aanmelden met e-mail</span>
                )}
              </Button>
            </fieldset>
          </Form>
        </RemixFormProvider>
      </CardContent>
      <CardFooter>
        <p className="text-muted-foreground w-full text-center text-sm">
          Door verder te gaan, gaat u akkoord met het{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            Privacybeleid
          </a>
          .
        </p>
      </CardFooter>
    </Card>
  )
}
