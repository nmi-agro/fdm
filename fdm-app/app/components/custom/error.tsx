import * as Sentry from "@sentry/react-router"
import { ArrowLeft, Copy, Home } from "lucide-react"
import { useEffect, useState } from "react"
import { NavLink, useNavigate } from "react-router"
import { Button } from "~/components/ui/button"
import { clientConfig } from "~/lib/config"
import { normalizePage } from "~/lib/url-utils"

/**
 * Displays a full-screen error block with tailored messaging and navigation options.
 *
 * Depending on the provided error status, this component renders:
 * - A specific message and navigation buttons for a 404 error, indicating that the page does not exist.
 * - A generic error message along with a button to copy the formatted error details (including status, message, stack trace, page, and timestamp) to the clipboard for other errors.
 *
 * If an error message is available, the component also displays the error details formatted as pretty-printed JSON. Otherwise, it shows a fallback message for non-404 errors.
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
  const navigate = useNavigate()

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
        {status === 404 ? "Aii, deze pagina bestaat niet." : "Oeps, er lijkt iets mis te zijn."}
      </h1>
      <p className="mb-8 text-center text-xl text-gray-600 dark:text-gray-400">
        {status === 404
          ? "Het lijkt erop dat de pagina die je zoekt niet bestaat."
          : "Er is onverwachts wat fout gegaan. Probeer eerst opnieuw. Als het niet opnieuw lukt, kopieer dan de foutmelding en neem contact op met Ondersteuning."}
      </p>

      {status === 404 ? (
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button
            onClick={() => {
              if (window.history.length > 1) {
                void navigate(-1)
              } else {
                void navigate("/")
              }
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Terug naar vorige pagina
          </Button>
          <Button variant="outline" asChild>
            <NavLink to="/">
              <Home className="mr-2 h-4 w-4" /> Terug naar de hoofdpagina
            </NavLink>
          </Button>
        </div>
      ) : (
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
      )}
      {message ? (
        <div className="mt-8 w-full max-w-2xl">
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Foutmelding:
          </h2>
          <pre className="overflow-x-auto rounded-md bg-gray-200 p-4 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
            {errorDetails}
          </pre>
        </div>
      ) : status === 404 ? null : (
        <p className="mt-8 text-gray-600 dark:text-gray-400">
          Er zijn helaas geen details over de fout beschikbaar.
        </p>
      )}
    </div>
  )
}
