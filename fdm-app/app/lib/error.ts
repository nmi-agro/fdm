import * as Sentry from "@sentry/react-router"
import { customAlphabet } from "nanoid"
import { data, redirect } from "react-router"
import { dataWithError, dataWithWarning } from "remix-toast"

const customErrorAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ" // No lookalikes (0, 1, I, O, S, Z)
const errorIdSize = 8 // Number of characters in ID

export const createErrorId = customAlphabet(customErrorAlphabet, errorIdSize)

// Thrown by fdm-core's checkPermission for any resource the principal can't access, whether it
// exists or not. Shared here so route loaders that need to distinguish this specific failure
// (e.g. to keep the app shell up and show a friendly in-app message instead of throwing) don't
// duplicate the string.
export const PERMISSION_DENIED_MESSAGE = "Principal does not have permission to perform this action"

/**
 * Extracts `{ status, statusText }` from a thrown/returned route error, if it has one.
 *
 * Route modules in this codebase almost always use `throw data(message, { status, statusText })`
 * rather than `throw new Response(...)`. `data()` returns a `DataWithResponseInit` instance whose
 * `status`/`statusText` live under `.init`, NOT as direct properties — so a naive
 * `"status" in error` check (which only matches a real `Response`) silently fails for it, and the
 * error falls through to the generic 500 branch below regardless of the status it was thrown
 * with. This helper checks both shapes so callers don't need to know which one they're dealing
 * with.
 */
function getThrownStatus(
  error: unknown,
): { status: number; statusText: string | undefined } | null {
  if (typeof error !== "object" || error === null) return null

  // `data(value, init)` — status/statusText live under `.init`.
  if (
    "type" in error &&
    error.type === "DataWithResponseInit" &&
    "init" in error &&
    typeof error.init === "object" &&
    error.init !== null &&
    "status" in error.init &&
    typeof error.init.status === "number"
  ) {
    const statusText =
      "statusText" in error.init && typeof error.init.statusText === "string"
        ? error.init.statusText
        : undefined
    return { status: error.init.status, statusText }
  }

  // A real thrown `Response` (or Response-like object) — status/statusText are direct properties.
  if ("status" in error && typeof error.status === "number") {
    const statusText =
      "statusText" in error && typeof error.statusText === "string" ? error.statusText : undefined
    return { status: error.status, statusText }
  }

  return null
}

/**
 * Extracts a human-readable error message from any thrown value.
 *
 * React Router loaders/actions can throw `Response` objects (e.g. via
 * `throw new Response("msg", { status: 400 })`). These are valid `Error`
 * values in a try/catch, but `.message` is `undefined` on them — only `.text()`
 * returns the body string. This helper handles all three cases:
 *   1. `Response` → await `.text()`, fallback to `HTTP <status>`
 *   2. `Error`    → `.message`
 *   3. anything   → `String(e)`
 */
export async function extractErrorMessage(e: unknown): Promise<string> {
  if (e instanceof Response) {
    try {
      return (await e.text()) || `HTTP ${e.status}`
    } catch {
      return `HTTP ${e.status}`
    }
  }
  if (e instanceof Error) return e.message
  return String(e)
}

function toSafeLogValue(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    try {
      return String(value)
    } catch {
      return "[unserializable]"
    }
  }
}

export function reportError(
  error: unknown,
  tags: Record<string, string> = {},
  context?: Record<string, unknown>,
): string {
  const errorId =
    createErrorId()
      .match(/.{1,4}/g)
      ?.join("-") || createErrorId() // Format as XXXX-XXXX

  try {
    console.error(`Error (code: ${errorId}):`, error, context ?? "")
  } catch {
    const safeError = toSafeLogValue(error)
    const safeContext = toSafeLogValue(context ?? "")
    try {
      console.error(`Error (code: ${errorId}):`, safeError, safeContext)
    } catch {}
  }

  if (Sentry.getClient()) {
    Sentry.captureException(error, {
      tags: {
        ...tags,
        error_id: errorId,
      },
      extra: {
        ...context,
        errorId: errorId,
      },
    })
  }

  return errorId
}

export function handleLoaderError(error: unknown) {
  // Handle 'data' thrown errors (and real thrown `Response` objects)
  const thrownStatus = getThrownStatus(error)
  if (thrownStatus) {
    const { status, statusText } = thrownStatus
    console.warn(`Loader error: ${status} - ${statusText}`, error)

    // Customize the user-facing message based on the status code
    let userMessage: string
    switch (status) {
      case 400:
        userMessage = statusText ?? "Ongeldige waarde"
        break
      case 401:
        return redirect("/signin")
      case 403:
        userMessage = "U heeft geen rechten om deze actie uit te voeren."
        break
      case 404:
        userMessage = "De gevraagde data kon niet worden gevonden."
        break
      // case 500:
      default: {
        const errorId = reportError(error, { scope: "loader" })
        userMessage = `Er is een onverwachte fout opgetreden. Probeer het later opnieuw of neem contact op met Ondersteuning en meldt de volgende foutcode: ${errorId}.`
        break
      }
    }
    return data(
      {
        warning: error,
      },
      { status, statusText: userMessage },
    )
  }

  // Permission denied error
  if (containsErrorMessage(error, PERMISSION_DENIED_MESSAGE)) {
    console.warn("Permission denied: ", error)
    return data(
      {
        warning: error instanceof Error ? error.message : error,
      },
      {
        status: 403,
        statusText: "U heeft helaas geen rechten om dit te doen.",
      },
    )
  }

  // Missing or invalid parameters errors
  if (
    error instanceof Error &&
    (error.message.startsWith("missing: ") || error.message.startsWith("invalid: "))
  ) {
    console.warn(error.message, error)
    return data(
      {
        warning: error,
      },
      {
        status: 400,
        statusText: "Ongeldige waarde",
      },
    )
  }
  // Not found errors
  if (error instanceof Error && error.message.startsWith("not found")) {
    console.warn(error.message, error)
    return data(
      {
        warning: error,
      },
      {
        status: 404,
        statusText: "Pagina is niet gevonden",
      },
    )
  }

  // All other errors — reportError handles logging and Sentry capture
  const errorId = reportError(error, {
    scope: "loader",
  })

  return data(
    {
      warning: error instanceof Error ? error.message : "Unknown error",
    },
    {
      status: 500,
      statusText: `Er is helaas iets fout gegaan. Probeer het later opnieuw of neem contact op met Ondersteuning en meldt de volgende foutcode: ${errorId}.`,
    },
  )
}

/**
 * Recursively checks whether an error or any error in its cause chain
 * contains the given substring in its message.
 */
export function containsErrorMessage(error: unknown, message: string): boolean {
  if (!(error instanceof Error)) return false
  if (error.message.includes(message)) return true
  return containsErrorMessage(error.cause, message)
}

/**
 * Handles an error thrown/caught inside a route `action`, returning a toast-bearing response for
 * expected failures (permission denied, validation, not found), or a generic error toast for
 * anything else.
 *
 * Always use `return handleActionError(error)` — never `throw` it. The `dataWithWarning` /
 * `dataWithError` responses this produces are meant to keep the user on the same page with a
 * toast notification (and any inline, action-data-driven UI still rendering), not to trigger the
 * route's `ErrorBoundary`. Throwing it instead would replace the whole page with the generic
 * error/no-access screen and the user would never see the toast.
 *
 * This function is `async` because several branches delegate to `remix-toast`'s
 * `dataWithWarning` / `dataWithError` (which read/write a flash-message cookie and are themselves
 * `async`) — but callers don't need to `await` it themselves: returning a `Promise` from an
 * `async` action function is automatically awaited by the caller.
 */
export async function handleActionError(error: unknown) {
  // Spam prevention: inviter exceeded hourly limit
  if (containsErrorMessage(error, "Rate limit exceeded")) {
    console.warn("Invitation rate limit hit:", error)
    return dataWithWarning(
      null,
      "Je hebt te veel uitnodigingen verstuurd in het afgelopen uur. Wacht even en probeer het later opnieuw.",
    )
  }

  // Spam prevention: target already has too many pending invitations
  if (containsErrorMessage(error, "too many pending invitations")) {
    console.warn("Invitation pending cap hit:", error)
    return dataWithWarning(
      null,
      "Deze persoon heeft al te veel openstaande uitnodigingen. Probeer het later opnieuw.",
    )
  }

  // Validation: farm must always have at least one owner
  if (containsErrorMessage(error, "Farm should have at least 1 owner")) {
    console.warn("Last owner role change blocked:", error)
    return dataWithWarning(
      null,
      "Een bedrijf moet minimaal één eigenaar hebben. Wijs eerst een andere eigenaar aan voordat je deze rol wijzigt.",
    )
  }

  // Handle 'data' thrown errors (and real thrown `Response` objects)
  const thrownStatus = getThrownStatus(error)
  if (thrownStatus) {
    const { status, statusText } = thrownStatus
    console.warn(`Action error: ${status} - ${statusText}`, error)

    let userMessage: string
    let dataStatus = "error"
    let errorId: string | undefined
    switch (status) {
      case 400:
        userMessage =
          "Ongeldige invoergegevens. Controleer de ingevoerde gegevens en probeer het opnieuw."
        dataStatus = "warning"
        break
      case 401:
        return redirect("/signin")
      case 403:
        userMessage = "U heeft geen rechten om deze actie uit te voeren."
        dataStatus = "warning"
        break
      case 404:
        userMessage = "De gevraagde data kon niet worden gevonden."
        dataStatus = "warning"
        break
      // case 500:
      default: {
        errorId = reportError(error, { scope: "action" })
        userMessage = `Er is een onverwachte fout opgetreden. Probeer het later opnieuw of neem contact op met Ondersteuning en meldt de volgende foutcode: ${errorId}.`
        dataStatus = "error"
        break
      }
    }
    if (dataStatus === "warning") {
      return dataWithWarning(
        {
          warning: error,
        },
        userMessage,
      )
    }
    return dataWithError(
      {
        warning: error,
      },
      { message: userMessage, status, errorId },
    )
  }

  // Permission denied error
  if (containsErrorMessage(error, PERMISSION_DENIED_MESSAGE)) {
    console.warn("Permission denied: ", error)
    return dataWithWarning(
      {
        warning: error,
      },
      "U heeft helaas geen rechten om dit te doen.",
    )
  }

  if (
    error instanceof Error &&
    (error.message.startsWith("missing: ") || error.message.startsWith("invalid: "))
  ) {
    console.warn(error.message, error)
    const errorId = reportError(error, { scope: "action" })
    return dataWithError(
      {
        warning: error,
      },
      {
        message: `Er is helaas iets misgegaan. Vernieuw de pagina en probeer het opnieuw. Blijft dit gebeuren, neem dan contact op met Ondersteuning en meld de volgende foutcode: ${errorId}.`,
        status: 400,
        errorId,
      },
    )
  }

  // All other errors — reportError handles logging and Sentry capture
  const errorId = reportError(error, {
    scope: "action",
  })
  return dataWithError(error instanceof Error ? error.message : "Unknown error", {
    message: `Er is helaas iets fout gegaan. Probeer het later opnieuw of neem contact op met Ondersteuning en meldt de volgende foutcode: ${errorId}.`,
    status: 500,
    errorId,
  })
}
