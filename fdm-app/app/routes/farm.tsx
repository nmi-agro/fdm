import { getFarm } from "@nmi-agro/fdm-core"
import posthog from "posthog-js"
import { useEffect } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { redirect, useLoaderData, useMatches } from "react-router"
import { Outlet } from "react-router-dom"
import { SidebarApps } from "~/components/blocks/sidebar/apps"
import { SidebarFarm } from "~/components/blocks/sidebar/farm"
import { SidebarSupport } from "~/components/blocks/sidebar/support"
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
import { useCalendarStore } from "~/store/calendar"
import { useFarmStore } from "~/store/farm"

export const meta: MetaFunction = () => {
    return [
        { title: `Dashboard | ${clientConfig.name}` },
        {
            name: "description",
            content:
                "Beheer je bedrijfsgegevens, percelen en gewassen in één overzichtelijk dashboard.",
        },
    ]
}

/**
 * Retrieves the session from the HTTP request and returns user information if available.
 * Also retrieves the current farm when available.
 *
 * If the session does not contain a user, the function redirects to the "/signin" route.
 * Any errors encountered during session retrieval are processed by the designated error handler.
 *
 * @param request - The HTTP request used for obtaining session data.
 * @returns An object with a "user" property when a valid session is found, and a "farm" property when b_id_farm is found in the URL.
 *
 * @throws {Error} If an error occurs during session retrieval, processed by handleLoaderError.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
    try {
        // Get the session
        const session = await getSession(request)
        const sessionCheckResponse = await checkSession(session, request)
        // If checkSession returns a Response, it means a redirect is needed
        if (sessionCheckResponse instanceof Response) {
            return sessionCheckResponse
        }

        const farm =
            params.b_id_farm && params.b_id_farm !== "undefined"
                ? await getFarm(fdm, session.principal_id, params.b_id_farm)
                : undefined

        // Return user information from loader
        return {
            farm: farm,
            user: session.user,
            userName: session.userName,
            initials: session.initials,
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
    const matches = useMatches()
    const farmMatch = matches.find(
        (match) =>
            match.pathname.startsWith("/farm/") && match.params.b_id_farm,
    )
    const initialFarmId = farmMatch?.params.b_id_farm as string | undefined
    const setFarmId = useFarmStore((state) => state.setFarmId)

    useEffect(() => {
        setFarmId(initialFarmId)
    }, [initialFarmId, setFarmId])

    const calendarMatch = matches.find(
        (match) => match.pathname.startsWith("/farm/") && match.params.calendar,
    )
    const initialCalendar = calendarMatch?.params.calendar as string | undefined
    const setCalendar = useCalendarStore((state) => state.setCalendar)

    useEffect(() => {
        setCalendar(initialCalendar)
    }, [initialCalendar, setCalendar])

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
                    <SidebarFarm farm={loaderData.farm} />
                    <SidebarApps />
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
                <Outlet />
            </SidebarInset>
        </SidebarProvider>
    )
}
