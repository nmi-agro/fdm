import * as Sentry from "@sentry/react-router"
import { ArrowLeft, Compass, Copy, Home, LifeBuoy } from "lucide-react"
import { useEffect, useState } from "react"
import { isRouteErrorResponse, NavLink, redirect, useLocation, useNavigate } from "react-router"
import { Button } from "~/components/ui/button"
import { useAnalytics } from "~/hooks/use-analytics"
import { clientConfig } from "~/lib/config"
import { normalizePage } from "~/lib/url-utils"

export const CLIENT_ERROR_STATUSES = [400, 403, 404]

/**
 * Full-screen, generic "page unavailable" state for client error statuses (400, 403, 404).
 *
 * Deliberately visually distinct from the 5xx/unexpected-error UI below (no illustration, no
 * grey background, no stack trace) — this is an expected, everyday state a user might land on by
 * accident, not a bug. It borrows the brand-mark treatment already used on the sign-in/auth
 * surfaces (a solid `#122023` badge) to give the moment real presence, with a short reassuring
 * message and a clearly prioritized set of next steps, none of which reveal whether the specific
 * page/resource exists or the user simply lacks permission for it.
 *
 * @param status - The real HTTP-like status (400/403/404), for analytics only — never rendered,
 * so the page itself still never reveals to the *user* which case they hit.
 */
export function ClientErrorPage({ status }: { status?: number | null } = {}) {
  const navigate = useNavigate()
  const { capture } = useAnalytics()

  useEffect(() => {
    capture("client_error_page_viewed", {
      status: status ?? null,
      page: normalizePage(window.location.pathname),
    })
  }, [capture, status])

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 flex max-w-md flex-col items-center text-center motion-safe:duration-500">
        <div className="mb-6 flex aspect-square size-16 items-center justify-center rounded-2xl bg-[#122023]">
          <Compass className="size-8 text-white" strokeWidth={1.75} />
        </div>

        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Deze pagina is niet beschikbaar
        </h1>
        <p className="text-muted-foreground mt-4 text-lg text-pretty">
          Het lijkt erop dat deze pagina niet bestaat, of dat je er geen toegang tot hebt.
          Controleer het adres en of je toegang hebt, of neem contact op als je denkt dat dit niet
          klopt.
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-4">
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => {
              if (window.history.length > 1) {
                void navigate(-1)
              } else {
                void navigate("/")
              }
            }}
          >
            <ArrowLeft className="mr-2 size-4" /> Terug naar vorige pagina
          </Button>
          <div className="flex items-center gap-6">
            <Button variant="link" className="text-muted-foreground h-auto p-0" asChild>
              <NavLink to="/farm">
                <Home className="mr-1.5 size-3.5" /> Mijn bedrijven
              </NavLink>
            </Button>
            <Button variant="link" className="text-muted-foreground h-auto p-0" asChild>
              <NavLink to="/support/new">
                <LifeBuoy className="mr-1.5 size-3.5" /> Ondersteuning
              </NavLink>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Full-screen diagnostic UI for genuinely unexpected errors: server 5xx route-error responses,
 * thrown `Error` instances (e.g. a component that throws while rendering), or any other unknown
 * thrown value. Deliberately distinct from {@link ClientErrorPage} — this *is* a bug, so it shows
 * the tractor illustration, the raw error details, and a way to copy them for a support request.
 */
export function UnexpectedErrorPage({
  status,
  message,
  stacktrace,
  page,
  timestamp,
}: {
  status: number | null
  message: string | null
  stacktrace: string | null | undefined
  page: string
  timestamp: string
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")
  const { capture } = useAnalytics()

  useEffect(() => {
    if (clientConfig.analytics.sentry) {
      Sentry.withScope((scope) => {
        scope.setTag("status", status?.toString() ?? "unknown")
        scope.setTag("page", normalizePage(page))
        Sentry.metrics.count("error_block.shown", 1)
      })
    }
    capture("unexpected_error_page_viewed", {
      status: status ?? null,
      page: normalizePage(page),
    })
  }, [status, page, capture])

  useEffect(() => {
    if (copyState !== "idle") {
      const timer = setTimeout(() => setCopyState("idle"), 5000)
      return () => clearTimeout(timer)
    }
  }, [copyState])

  const errorDetails = JSON.stringify(
    {
      status,
      message,
      stacktrace,
      page,
      timestamp,
    },
    null,
    2,
  )
  const copyStackTrace = async () => {
    try {
      await navigator.clipboard.writeText(errorDetails)
      setCopyState("copied")
    } catch {
      // Fallback: select the text in the pre element so the user can copy manually
      const pre = document.querySelector("pre")
      if (pre) {
        const range = document.createRange()
        range.selectNodeContents(pre)
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
      }
      setCopyState("failed")
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4 dark:bg-gray-900">
      <div className="mb-8 w-full max-w-md overflow-hidden rounded-lg">
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/giphy-zaMc9sEWI1lqXlXSKSKR164AvQCUjf.webp"
          alt="A red tractor doing a wheelie"
          className="w-full rounded-lg"
        />
      </div>
      <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-gray-100">
        Oeps, er lijkt iets mis te zijn.
      </h1>
      <p className="mb-8 text-center text-xl text-gray-600 dark:text-gray-400">
        Er is onverwachts wat fout gegaan. Probeer eerst opnieuw. Als het niet opnieuw lukt, kopieer
        dan de foutmelding en neem contact op met Ondersteuning.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Button asChild>
          <NavLink to="/">
            <Home className="mr-2 h-4 w-4" /> Terug naar de hoofdpagina
          </NavLink>
        </Button>
        <Button variant="outline" onClick={copyStackTrace}>
          <Copy className="mr-2 h-4 w-4" />
          {copyState === "copied"
            ? "Gekopieerd!"
            : copyState === "failed"
              ? "Browser staat niet toe om te kopiëren — selecteer de tekst hieronder en kopieer handmatig"
              : "Kopieer foutmelding"}
        </Button>
      </div>
      {message ? (
        <div className="mt-8 w-full max-w-2xl">
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Foutmelding:
          </h2>
          <pre className="overflow-x-auto rounded-md bg-gray-200 p-4 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
            {errorDetails}
          </pre>
        </div>
      ) : (
        <p className="mt-8 text-gray-600 dark:text-gray-400">
          Er zijn helaas geen details over de fout beschikbaar.
        </p>
      )}
    </div>
  )
}

/**
 * Displays a full-screen error block with tailored messaging and navigation options.
 *
 * Depending on the provided error status, this component renders:
 * - One unified, generic "page unavailable" message for client error statuses (400, 403, 404),
 *   via {@link ClientErrorPage}. This deliberately never reveals whether a specific resource
 *   exists or the user simply lacks permission for it — both cases look identical to the user.
 * - The diagnostic {@link UnexpectedErrorPage} for anything else.
 *
 * @param status - HTTP status code of the error or null.
 * @param message - Detailed error message, or null if not available.
 * @param stacktrace - Optional stack trace providing additional error context.
 * @param page - The page where the error occurred.
 * @param timestamp - The timestamp when the error was recorded.
 */
export function ErrorBlock({
  status,
  message,
  stacktrace,
  page,
  timestamp,
}: {
  status: number | null
  message: string | null
  stacktrace: string | null | undefined
  page: string
  timestamp: string
}) {
  const isClientError = status !== null && CLIENT_ERROR_STATUSES.includes(status)

  if (isClientError) {
    return <ClientErrorPage status={status} />
  }

  return (
    <UnexpectedErrorPage
      status={status}
      message={message}
      stacktrace={stacktrace}
      page={page}
      timestamp={timestamp}
    />
  )
}

/**
 * Classifies the current route error and renders the right UI for it. Meant to be used from a
 * route module's `ErrorBoundary` export (pass its `error` prop straight through) — including
 * ones nested under a layout route that wants to keep its own shell (sidebar/header) around this
 * component rather than losing it entirely, as `root.tsx`'s top-level boundary would.
 *
 * - Redirects to sign-in for a `401` route error response.
 * - Renders the generic, friendly {@link ClientErrorPage} for expected client errors (400, 403,
 *   404) — a route/resource that doesn't exist or one the user lacks permission for.
 * - Renders the diagnostic {@link UnexpectedErrorPage} for everything else: `5xx` route error
 *   responses, thrown `Error` instances (e.g. a component that throws while rendering — a real
 *   bug, not an expected state), or any other unknown thrown value. Client-side errors that
 *   weren't already captured server-side are reported to Sentry here.
 */
export function RouteErrorFallback({ error }: { error: unknown }) {
  const location = useLocation()
  const page = location.pathname
  const timestamp = new Date().toISOString()

  if (isRouteErrorResponse(error)) {
    // Redirect to signin page if authentication is not provided
    if (error.status === 401) {
      const currentPath = location.pathname + location.search + location.hash
      const signInUrl = `./signin?redirectTo=${encodeURIComponent(currentPath)}`
      throw redirect(signInUrl)
    }

    if (CLIENT_ERROR_STATUSES.includes(error.status)) {
      return <ClientErrorPage status={error.status} />
    }

    // Server-side errors are already captured in Sentry via handleError / reportError.
    // No need to capture again client-side.
    return (
      <UnexpectedErrorPage
        status={error.status}
        message={error.statusText}
        stacktrace={error.data}
        page={page}
        timestamp={timestamp}
      />
    )
  }

  if (error instanceof Error) {
    // Client-side JS error (e.g. a component that threw while rendering) — not captured
    // server-side, so capture here.
    Sentry.captureException(error)
    return (
      <UnexpectedErrorPage
        status={500}
        message={error.message}
        stacktrace={error.stack}
        page={page}
        timestamp={timestamp}
      />
    )
  }

  if (error === null) {
    return null
  }

  Sentry.captureException(error)
  return (
    <UnexpectedErrorPage status={500} message="Unknown Error" stacktrace={null} page={page} timestamp={timestamp} />
  )
}
