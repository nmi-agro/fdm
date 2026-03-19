import * as Sentry from "@sentry/react-router"
import { customAlphabet } from "nanoid"
import { data, redirect } from "react-router"
import { dataWithError, dataWithWarning } from "remix-toast"
import { clientConfig } from "~/lib/config"

const customErrorAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ" // No lookalikes (0, 1, I, O, S, Z)
const errorIdSize = 8 // Number of characters in ID

export const createErrorId = customAlphabet(customErrorAlphabet, errorIdSize)

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

export function reportError(
    error: unknown,
    tags: Record<string, string> = {},
    context?: Record<string, unknown>,
): string {
    const errorId =
        createErrorId()
            .match(/.{1,4}/g)
            ?.join("-") || createErrorId() // Format as XXXX-XXXX

    if (clientConfig.analytics.sentry?.dsn) {
        Sentry.captureException(error, {
            tags: {
                ...tags,
            },
            extra: {
                ...context,
                errorId: errorId,
            },
        })
    } else {
        console.error(`Error (code: ${errorId}):`, error, context)
    }

    return errorId
}

export function handleLoaderError(error: unknown) {
    // Handle 'data' thrown errors
    if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        "statusText" in error
    ) {
        // Type guard to check if it's a 'data' object
        if (
            typeof error.status === "number" &&
            typeof error.statusText === "string"
        ) {
            console.warn(`Loader error: ${error.status} - ${error.statusText}`)

            // Customize the user-facing message based on the status code
            let userMessage = "Er is iets fout gegaan." // Default message
            switch (error.status) {
                case 400:
                    userMessage = error.statusText
                    break
                case 401:
                    return redirect("/signin")
                case 403:
                    userMessage =
                        "U heeft geen rechten om deze actie uit te voeren."
                    break
                case 404:
                    userMessage = "De gevraagde data kon niet worden gevonden."
                    break
                // case 500:
                default:
                    userMessage =
                        "Er is een onverwachte fout opgetreden. Probeer het later opnieuw of neem contact op met Ondersteuning."
                    break
            }
            return data(
                {
                    warning: error,
                },
                { status: error.status, statusText: userMessage },
            )
        }
    }

    // Permission denied error
    if (
        containsErrorMessage(
            error,
            "Principal does not have permission to perform this action",
        )
    ) {
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
        (error.message.startsWith("missing: ") ||
            error.message.startsWith("invalid: "))
    ) {
        console.warn(error.message)
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
        console.warn(error.message)
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

    // All other errors
    console.error("Loader Error: ", error)
    // Forward error to Sentry
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
function containsErrorMessage(error: unknown, message: string): boolean {
    if (!(error instanceof Error)) return false
    if (error.message.includes(message)) return true
    return containsErrorMessage(error.cause, message)
}

export function handleActionError(error: unknown) {
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

    // Handle 'data' thrown errors
    if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        "statusText" in error
    ) {
        // Type guard to check if it's a 'data' object
        if (
            typeof error.status === "number" &&
            typeof error.statusText === "string"
        ) {
            console.warn(`Action error: ${error.status} - ${error.statusText}`)

            // Customize the user-facing message based on the status code
            let userMessage = "Er is iets fout gegaan." // Default message
            let dataStatus = "error"
            switch (error.status) {
                case 400:
                    userMessage = error.statusText
                    dataStatus = "warning"
                    break
                case 401:
                    return redirect("/signin")
                case 403:
                    userMessage =
                        "U heeft geen rechten om deze actie uit te voeren."
                    dataStatus = "warning"
                    break
                case 404:
                    userMessage = "De gevraagde data kon niet worden gevonden."
                    dataStatus = "warning"
                    break
                // case 500:
                default:
                    userMessage =
                        "Er is een onverwachte fout opgetreden. Probeer het later opnieuw of neem contact op met Ondersteuning."
                    dataStatus = "error"
                    break
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
                userMessage,
            )
        }
    }

    // Permission denied error
    if (
        containsErrorMessage(
            error,
            "Principal does not have permission to perform this action",
        )
    ) {
        console.warn("Permission denied: ", error)
        return dataWithWarning(
            {
                warning: error,
            },
            "U heeft helaas geen rechten om dit te doen.",
        )
    }

    // Missing or invalid parameters errors
    if (
        error instanceof Error &&
        (error.message.startsWith("missing: ") ||
            error.message.startsWith("invalid: "))
    ) {
        console.warn(error.message)
        return dataWithWarning(
            {
                warning: error,
            },
            error.message,
        )
    }

    // All other errors
    console.error("Error: ", error)
    const errorId = reportError(error, {
        scope: "action",
    })
    return dataWithError(
        error instanceof Error ? error.message : "Unknown error",
        `Er is helaas iets fout gegaan. Probeer het later opnieuw of neem contact op met Ondersteuning en meldt de volgende foutcode: ${errorId}.`,
    )
}
