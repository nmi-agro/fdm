import { type LoaderFunctionArgs, Outlet, useLoaderData, useLocation } from "react-router"
import { Header } from "~/components/blocks/header/base"
import { HeaderUser } from "~/components/blocks/header/user"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"

/**
 * Loads session data for the user settings layout.
 *
 * @param request - The HTTP request used to retrieve session data.
 * @returns An object containing basic user information.
 *
 * @throws {Error} If session retrieval fails.
 */
export async function loader({ request }: LoaderFunctionArgs) {
    try {
        const session = await getSession(request)
        return {
            user: session.user,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders the layout for user account settings.
 *
 * Navigation between Profiel and API-sleutels lives in the main sidebar.
 */
export default function UserSettingsLayout() {
    const { user } = useLoaderData<typeof loader>()
    const { pathname } = useLocation()

    const page = pathname.includes("api-keys")
        ? { label: "API-sleutels", href: "/user/settings/api-keys" }
        : { label: "Profiel", href: "/user/settings/profile" }

    return (
        <SidebarInset>
            <Header action={undefined}>
                <HeaderUser name={user.name} page={page} />
            </Header>
            <main>
                <Outlet />
            </main>
        </SidebarInset>
    )
}
