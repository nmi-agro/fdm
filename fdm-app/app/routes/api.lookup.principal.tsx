import type { LoaderFunctionArgs } from "react-router"
import { lookupPrincipal } from "@nmi-agro/fdm-core"
import { checkHelpdeskPermission } from "@nmi-agro/fdm-helpdesk"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

// Define the structure expected by the AutoComplete component
type AutocompletePrincipal = {
  value: string
  label: string
  icon: "user" | "organization" // Icon identifier string
  description?: string // Muted second line, e.g. the email address the searcher typed
}

export async function loader({ request, url }: LoaderFunctionArgs) {
  try {
    // Get the session
    const session = await getSession(request)

    // Verify user is authenticated
    if (!session.principal_id) {
      throw new Response("Unauthorized", { status: 401 })
    }

    // Get identifier from URL query parameters
    const identifier = url.searchParams.get("identifier") // Read 'identifier' param
    const useEmail = url.searchParams.has("email")
    const usePrincipalId = url.searchParams.has("principal_id")

    const isHelpdeskLookup = useEmail || usePrincipalId
    if (isHelpdeskLookup) {
      await checkHelpdeskPermission(
        fdm,
        "helpdesk",
        "write",
        "",
        session.principal_id,
        "routes/api.lookup.principal",
      )
    }

    if (!identifier) {
      return [] // Return empty array directly
    }

    // Basic validation to prevent malicious input
    // Only allow alphanumeric characters, at-sign, plus, period, underscores, hyphens and spaces
    // (spaces are needed to search organizations by name)
    if (!/^[a-zA-Z0-9@+._ -]+$/.test(identifier)) {
      return []
    }
    const trimmedIdentifier = identifier.trim()
    if (trimmedIdentifier.length < 2 || trimmedIdentifier.length > 100) {
      return [] // Return empty for too short or too long inputs
    }

    // Searching users by name is reserved for the helpdesk; everyone else finds users by exact email only.
    const principals = await lookupPrincipal(fdm, trimmedIdentifier, {
      includeUserNameSearch: isHelpdeskLookup,
    })

    const valueSubscript = useEmail ? "email" : usePrincipalId ? "id" : "username"

    // Map the result to the format expected by AutoComplete
    const autocompletePrincipals: AutocompletePrincipal[] = principals
      .map((p): Omit<AutocompletePrincipal, "value"> & { value: string | null } => ({
        // Users are addressed by email (invitations reject usernames); this is the email the
        // searcher typed, so returning it reveals nothing new. Organizations use their slug.
        value: !isHelpdeskLookup && p.type === "user" ? p.email : p[valueSubscript],
        label: p.displayUserName ?? p.username,
        icon: p.type, // Pass the type as the icon identifier
        // A user is only matched on the email the searcher typed, so showing it reveals nothing new
        description: !isHelpdeskLookup && p.type === "user" ? trimmedIdentifier : undefined,
      }))
      .filter((result): result is AutocompletePrincipal => typeof result.value === "string")

    return autocompletePrincipals // Return array directly
  } catch (error) {
    // Use handleLoaderError for loaders
    return handleLoaderError(error)
  }
}
