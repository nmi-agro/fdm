import { type Agent, getAgents } from "@nmi-agro/fdm-helpdesk"
import type { LoaderFunctionArgs } from "react-router-dom"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

// Define the structure expected by the AutoComplete component
type AutocompletePrincipal = {
    value: string
    label: string
    icon: "user" | "organization" // Icon identifier string
}

export async function loader({ request }: LoaderFunctionArgs) {
    try {
        // Get the session
        const session = await getSession(request)

        // Verify user is authenticated
        if (!session.principal_id) {
            throw new Response("Unauthorized", { status: 401 })
        }

        // Get identifier from URL query parameters
        const url = new URL(request.url)
        const identifier = url.searchParams.get("identifier") // Read 'identifier' param
        const usePrincipalId = url.searchParams.has("principal_id")

        if (!usePrincipalId) {
            throw new Error("You must request ?principal_id")
        }

        if (!identifier) {
            return [] // Return empty array directly
        }

        // Basic validation to prevent malicious input
        // Only allow alphanumeric characters, underscores, and hyphens
        if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) {
            return []
        }
        if (identifier.length < 2 || identifier.length > 100) {
            return [] // Return empty for too short or too long inputs
        }

        const principals: Agent[] = await getAgents(fdm, session.principal_id, {
            text: identifier,
            isActive: true,
        })

        // Map the result to the format expected by AutoComplete
        const autocompletePrincipals: AutocompletePrincipal[] = principals.map(
            (p) => ({
                value: p.agent_id,
                label: p.display_name,
                icon: "user", // Pass the type as the icon identifier
            }),
        )

        return autocompletePrincipals // Return array directly
    } catch (error) {
        // Use handleLoaderError for loaders
        return handleLoaderError(error)
    }
}
