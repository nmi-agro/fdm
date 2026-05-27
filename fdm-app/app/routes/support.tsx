import { checkHelpdeskPermission } from "@nmi-agro/fdm-helpdesk"
import posthog from "posthog-js"
import { useEffect } from "react"
import { useLoaderData } from "react-router"
import { Outlet } from "react-router-dom"
import { Header } from "~/components/blocks/header/base"
import { HeaderHelpdesk } from "~/components/blocks/header/helpdesk"
import { SidebarAdminHelpdesk } from "~/components/blocks/sidebar/admin-helpdesk"
import { SidebarHelpdesk } from "~/components/blocks/sidebar/helpdesk"
import { SidebarTitle } from "~/components/blocks/sidebar/title"
import { SidebarUser } from "~/components/blocks/sidebar/user"
import {
    Sidebar,
    SidebarContent,
    SidebarInset,
    SidebarProvider,
} from "~/components/ui/sidebar"
import { checkSession, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import type { Route } from "./+types/support"

/**
 * Retrieves the session from the HTTP request and returns user information if available.
 *
 * If the session does not contain a user, the function redirects to the "/signin" route.
 * Any errors encountered during session retrieval are processed by the designated error handler.
 *
 * @param request - The HTTP request used for obtaining session data.
 * @returns An object with a "user" property when a valid session is found.
 *
 * @throws {Error} If an error occurs during session retrieval, processed by handleLoaderError.
 */
export async function loader({ request }: Route.LoaderArgs) {
    try {
        // Get the session
        const session = await getSession(request)
        const sessionCheckResponse = await checkSession(session, request)
        // If checkSession returns a Response, it means a redirect is needed
        if (sessionCheckResponse instanceof Response) {
            return sessionCheckResponse
        }

        const helpdeskReadPermission = await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "read",
            "",
            session.principal_id,
            "support",
            false,
        )

        // Return user information from loader
        return {
            user: session.user,
            userName: session.userName,
            initials: session.initials,
            helpdeskReadPermission: helpdeskReadPermission,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders the main application layout.
 *
 * This component retrieves user data from the loader using React Router's useLoaderData hook and passes it to the SidebarApp component within a SidebarProvider context. It also renders an Outlet to display nested routes.
 */
export default function App() {
    const loaderData = useLoaderData<typeof loader>()

    // Identify user if PostHog is configured
    useEffect(() => {
        if (clientConfig.analytics.posthog && loaderData.user) {
            posthog.identify(loaderData.user.id, {
                id: loaderData.user.id,
                email: loaderData.user.email,
                name: loaderData.user.name,
            })
        }
    }, [loaderData.user])

    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarTitle />
                <SidebarContent>
                    <SidebarHelpdesk />
                    {loaderData.helpdeskReadPermission && (
                        <SidebarAdminHelpdesk />
                    )}
                </SidebarContent>
                <SidebarUser
                    name={loaderData.userName}
                    email={loaderData.user.email}
                    image={loaderData.user.image}
                    avatarInitials={loaderData.initials}
                    userName={loaderData.userName}
                />
            </Sidebar>
            <SidebarInset className="flex flex-col">
                <Header action={undefined}>
                    <HeaderHelpdesk />
                </Header>
                <div className="grow">
                    <Outlet />
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
