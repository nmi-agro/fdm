import * as Sentry from "@sentry/react-router"
import { ArrowLeft, Compass, Copy, Home, LifeBuoy } from "lucide-react"
import { useEffect, useState } from "react"
import { NavLink, useNavigate } from "react-router"
import { Button } from "~/components/ui/button"
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
 */
export function ClientErrorPage() {
  const navigate = useNavigate()

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
 * Displays a full-screen error block with tailored messaging and navigation options.
 *
 * Depending on the provided error status, this component renders:
 * - One unified, generic "page unavailable" message for client error statuses (400, 403, 404),
 *   via {@link ClientErrorPage}. This deliberately never reveals whether a specific resource
 *   exists or the user simply lacks permission for it — both cases look identical to the user.
 * - A visually distinct, diagnostic error message for other (server/unexpected) errors, along
 *   with a button to copy the formatted error details (including status, message, stack trace,
 *   page, and timestamp) to the clipboard.
 *
 * If an error message is available, the component also displays the error details formatted as
 * pretty-printed JSON for the non-client-error case.
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
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")

  useEffect(() => {
    if (clientConfig.analytics.sentry) {
      Sentry.withScope((scope) => {
        scope.setTag("status", status?.toString() ?? "unknown")
        scope.setTag("page", normalizePage(page))
        Sentry.metrics.count("error_block.shown", 1)
      })
    }
  }, [status, page])

  useEffect(() => {
    if (copyState !== "idle") {
      const timer = setTimeout(() => setCopyState("idle"), 5000)
      return () => clearTimeout(timer)
    }
  }, [copyState])

  const isClientError = status !== null && CLIENT_ERROR_STATUSES.includes(status)

  if (isClientError) {
    return <ClientErrorPage />
  }

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
