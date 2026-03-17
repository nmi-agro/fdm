import {
    createDisplayUsername,
    createFdmAuth,
    type FdmAuth,
} from "@nmi-agro/fdm-core"
import type { Session } from "better-auth"
import { redirect } from "react-router"
import { fdm } from "~/lib/fdm.server"
import type { ExtendedUser } from "~/types/extended-user"
import { serverConfig } from "./config.server"
import {
    sendMagicLinkEmailToUser,
    sendWelcomeEmailToUser,
} from "./email.server"

// Initialize better-auth instance for FDM
export const auth: FdmAuth = createFdmAuth(
    fdm,
    serverConfig.auth.google,
    serverConfig.auth.microsoft,
    sendMagicLinkEmailToUser,
    false,
    sendWelcomeEmailToUser,
)

// Get the session
export async function getSession(request: Request): Promise<FdmSession> {
    const session = await auth.api.getSession({
        headers: request.headers,
    })

    if (!session) {
        throw new Response("Unauthorized", { status: 401 })
    }

    // Cast session.user to ExtendedUser for type safety
    const user = session.user as ExtendedUser

    // Determine avatar initials
    let initials = user.email[0]
    if (user.firstname && user.surname) {
        initials = user.firstname[0] + user.surname[0]
    } else if (user.firstname) {
        initials = user.firstname[0]
    } else if (user.name) {
        initials = user.name[0]
    }

    // Determine userName
    const displayUserName =
        user.displayUsername ||
        createDisplayUsername(user.firstname, user.surname) ||
        user.name ||
        user.email

    // Expand session
    const sessionWithUserName = {
        ...session,
        userName: displayUserName,
        principal_id: user.id,
        initials: initials,
    }

    return sessionWithUserName
}

interface FdmSession {
    session: Session
    user: ExtendedUser
    userName: string
    principal_id: string
    initials: string
}

export async function checkSession(
    session: FdmSession,
    request: Request,
): Promise<undefined | Response> {
    if (!session?.user) {
        // Get the original URL the user tried to access
        const currentPath = new URL(request.url).pathname
        // Construct the sign-in URL with the redirectTo parameter
        const signInUrl = `/signin?redirectTo=${encodeURIComponent(currentPath)}`
        // Perform the redirect
        return redirect(signInUrl)
    }
    // Check if profile is complete, otherwise redirect to welcome page
    if (!session.user.firstname || !session.user.surname) {
        // Get the original URL the user tried to access
        const currentPath = new URL(request.url).pathname
        // Construct the welcome URL with the redirectTo parameter
        const welcomeUrl = `/welcome?redirectTo=${encodeURIComponent(currentPath)}`
        console.log(`Redirecting to ${welcomeUrl}`)
        // Perform the redirect
        return redirect(welcomeUrl)
    }
}
