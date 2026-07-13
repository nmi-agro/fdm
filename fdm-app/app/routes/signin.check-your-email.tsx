import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import type { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useRef, useState } from "react"
import {
  Form,
  NavLink,
  redirect,
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router"
import { useRemixForm } from "remix-hook-form"
import { AuthCard } from "~/components/blocks/auth/auth-card"
import { AuthCodeField } from "~/components/blocks/auth/auth-code-field"
import { AuthLayout } from "~/components/blocks/auth/auth-layout"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { useAnalytics } from "~/hooks/use-analytics"
import { auth } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { magicLinkCookie } from "~/lib/magic-link-cookie.server"
import { maskEmail } from "~/lib/utils"
import { modifySearchParams, getSafeRedirect } from "~/lib/url-utils"
import { FormSchema } from "~/components/blocks/auth/auth-formschema"

export const meta: MetaFunction = () => {
  return [
    { title: `Aanmelden | ${clientConfig.name}` },
    {
      name: "description",
      content: `Meld je aan bij ${clientConfig.name} om toegang te krijgen tot je dashboard en je bedrijfsgegevens te beheren.`,
    },
  ]
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (session?.session) {
      return redirect("/farm")
    }

    // The email travels via a short-lived httpOnly cookie rather than the
    // URL, so it never ends up in server logs, browser history, or Referer.
    const email = (await magicLinkCookie.parse(request.headers.get("Cookie"))) || ""

    return { email }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

const RESEND_COOLDOWN_SECONDS = 30

export default function SignIn() {
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get("redirectTo") || "/farm"
  const navigation = useNavigation()
  const formRef = useRef<HTMLFormElement>(null)
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false)
  const resendFetcher = useFetcher<typeof action>()
  const [cooldown, setCooldown] = useState(0)
  const loaderData = useLoaderData<typeof loader>()
  const email = loaderData.email
  const { capture } = useAnalytics()

  const verifyActionUrl = modifySearchParams("/signin/verify", (params) => {
    params.set("redirectTo", redirectTo)
  })

  // Cancel a pending auto-submit if the user edits the code afterwards,
  // so the auto-submit never overrides an intentional change.
  const pendingCodeRef = useRef<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const interval = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(interval)
  }, [cooldown])

  useEffect(() => {
    if (resendFetcher.state === "idle" && resendFetcher.data && "success" in resendFetcher.data) {
      setCooldown(RESEND_COOLDOWN_SECONDS)
      capture("signin_code_resend_succeeded")
    }
    if (resendFetcher.state === "idle" && resendFetcher.data && "error" in resendFetcher.data) {
      capture("signin_code_resend_failed")
    }
  }, [resendFetcher.state, resendFetcher.data, capture])

  const isSubmitting =
    (navigation.state !== "idle" && navigation.formAction?.startsWith("/signin/verify")) ||
    isAutoSubmitting

  const form = useRemixForm<z.infer<typeof FormSchema>>({
    mode: "onSubmit",
    resolver: zodResolver(FormSchema),
    defaultValues: {
      code: "",
    },
  })

  return (
    <AuthLayout showCookieSettings={true}>
      <AuthCard
        title="Controleer je e-mail inbox"
        description={
          email
            ? `Een aanmeldcode en link zijn naar ${maskEmail(email)} gestuurd.`
            : "Een aanmeldcode en link zijn naar je e-mailadres gestuurd."
        }
        contentClassName="space-y-6"
        footer={null}
      >
        <p className="text-muted-foreground text-center text-sm">
          De code en link zijn 15 minuten geldig en kunnen maar één keer worden gebruikt.
        </p>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background text-muted-foreground px-2">Of vul de code in</span>
          </div>
        </div>
        <Form
          ref={formRef}
          method="POST"
          action={verifyActionUrl}
          className="space-y-4"
          onSubmit={form.handleSubmit}
        >
          <AuthCodeField
            control={form.control}
            onComplete={(value) => {
              pendingCodeRef.current = value
              setIsAutoSubmitting(true)
              capture("signin_code_autosubmit_scheduled")
              // Trigger programmatic submit which fires onSubmit handler
              // 1.5s delay so the user can see and confirm the completed code
              timeoutRef.current = setTimeout(() => {
                // Only submit if the code hasn't been edited since completion
                if (form.getValues("code") === pendingCodeRef.current) {
                  formRef.current?.requestSubmit()
                } else {
                  setIsAutoSubmitting(false)
                  capture("signin_code_autosubmit_cancelled")
                }
              }, 1500)
            }}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            onClick={() => {
              // Let a deliberate click interrupt any pending auto-submit
              if (timeoutRef.current) clearTimeout(timeoutRef.current)
            }}
          >
            {isSubmitting ? (
              <div className="flex items-center space-x-2">
                <Spinner />
                <span>Verifiëren...</span>
              </div>
            ) : (
              "Verifiëren"
            )}
          </Button>
        </Form>

        {/* Resend and "different email" sit together as matching small text
            links, rather than pairing a small link with a full-width button. */}
        <div className="flex flex-col items-center gap-2 text-center">
          {email && (
            <resendFetcher.Form
              method="POST"
              className="flex flex-col items-center gap-1"
              onSubmit={() => capture("signin_code_resend_clicked")}
            >
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <Button
                type="submit"
                variant="link"
                size="sm"
                className="text-muted-foreground h-auto p-0 text-xs"
                disabled={resendFetcher.state !== "idle" || cooldown > 0}
              >
                {cooldown > 0
                  ? `Nieuwe code opnieuw versturen (${cooldown}s)`
                  : resendFetcher.state !== "idle"
                    ? "Code versturen..."
                    : "Geen code ontvangen? Opnieuw versturen"}
              </Button>
              {resendFetcher.data && "error" in resendFetcher.data && (
                <p className="text-destructive text-xs" role="alert">
                  {resendFetcher.data.error}
                </p>
              )}
              {resendFetcher.data && "success" in resendFetcher.data && (
                <p className="text-xs" role="status">
                  Nieuwe code verstuurd.
                </p>
              )}
            </resendFetcher.Form>
          )}
          <Button
            asChild
            variant="link"
            size="sm"
            className="text-muted-foreground h-auto p-0 text-xs"
          >
            <NavLink to="/signin" onClick={() => capture("signin_different_email_clicked")}>
              Ander e-mailadres gebruiken
            </NavLink>
          </Button>
        </div>
      </AuthCard>
    </AuthLayout>
  )
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  // Validate redirectTo to prevent open redirect, matching signin._index.tsx
  const safeRedirectTo = getSafeRedirect(String(formData.get("redirectTo") || ""))

  // Re-read the email from the cookie rather than trusting a client-supplied
  // field, keeping it the single source of truth for this flow.
  const email = (await magicLinkCookie.parse(request.headers.get("Cookie"))) || ""

  if (!email) {
    return { error: "E-mailadres ontbreekt. Ga terug naar aanmelden." }
  }

  try {
    await auth.api.signInMagicLink({
      body: { email, callbackURL: safeRedirectTo },
      headers: request.headers,
    })
    // Refresh the cookie's expiry so repeated resends keep working within
    // the flow, without extending the window indefinitely on its own.
    return Response.json(
      { success: true },
      { headers: { "Set-Cookie": await magicLinkCookie.serialize(email) } },
    )
  } catch (error) {
    console.error("Error resending magic link:", error)
    return { error: "Het opnieuw versturen is niet gelukt. Probeer het straks opnieuw." }
  }
}
