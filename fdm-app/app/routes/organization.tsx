import posthog from "posthog-js"
import { useEffect } from "react"
import type { LoaderFunctionArgs } from "react-router"
import { redirect, useLoaderData } from "react-router"
import { Outlet } from "react-router-dom"
import { Header } from "~/components/blocks/header/base"
import { HeaderOrganization } from "~/components/blocks/header/organization"
import { SidebarOrganization } from "~/components/blocks/sidebar/organization"
import { SidebarSupport } from "~/components/blocks/sidebar/support"
import { SidebarTitle } from "~/components/blocks/sidebar/title"
import { SidebarUser } from "~/components/blocks/sidebar/user"
import {
    Sidebar,
    SidebarContent,
    SidebarInset,
    SidebarProvider,
} from "~/components/ui/sidebar"
import { auth, checkSession, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"

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
export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        // Get the session
        const session = await getSession(request)
        const sessionCheckResponse = await checkSession(session, request)
        // If checkSession returns a Response, it means a redirect is needed
        if (sessionCheckResponse instanceof Response) {
            return sessionCheckResponse
        }
        const selectedOrganizationSlug = params.slug

        const organizations = await auth.api.listOrganizations({
            headers: request.headers,
        })

        const selectedOrganization = organizations.find(
            (organization) => organization.slug === params.slug,
        )

        let selectedOrganizationRoles: Awaited<
            ReturnType<typeof auth.api.listMembers>
        >["members"][number]["role"][] = []
        if (selectedOrganization) {
            const membersListResponse = await auth.api.listMembers({
                headers: request.headers,
                query: {
                    organizationId: selectedOrganization.id,
                },
            })

            const member = membersListResponse.members.find(
                (member) => member.userId === session.principal_id,
            )

            if (member) {
                selectedOrganizationRoles = [member.role]
            }
        }

        // Return user information from loader
        return {
            user: session.user,
            userName: session.userName,
            initials: session.initials,
            selectedOrganizationSlug: selectedOrganizationSlug,
            selectedOrganizationRoles: selectedOrganizationRoles,
            organizations: organizations,
        }
    } catch (error) {
        // If getSession throws (e.g., invalid token), it might result in a 401
        // We need to handle that case here as well, similar to the ErrorBoundary
        if (error instanceof Response && error.status === 401) {
            const currentPath = new URL(request.url).pathname
            const signInUrl = `/signin?redirectTo=${encodeURIComponent(currentPath)}`
            return redirect(signInUrl)
        }
        // Re-throw other errors to be handled by the ErrorBoundary or default handling
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

    const organization = loaderData.organizations.find(
        (org) => org.slug === loaderData.selectedOrganizationSlug,
    )

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
                    <SidebarOrganization
                        organization={organization}
                        roles={loaderData.selectedOrganizationRoles}
                    />
                </SidebarContent>
                <SidebarSupport
                    name={loaderData.userName}
                    email={loaderData.user.email}
                />
                <SidebarUser
                    name={loaderData.userName}
                    email={loaderData.user.email}
                    image={loaderData.user.image}
                    avatarInitials={loaderData.initials}
                    userName={loaderData.userName}
                />
            </Sidebar>
            <SidebarInset>
                <Header action={undefined}>
                    <HeaderOrganization
                        selectedOrganizationSlug={
                            loaderData.selectedOrganizationSlug
                        }
                        organizationOptions={loaderData.organizations}
                    />
                </Header>
                <Outlet />
            </SidebarInset>
        </SidebarProvider>
    )
}
