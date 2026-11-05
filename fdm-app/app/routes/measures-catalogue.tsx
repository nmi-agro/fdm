import type { LoaderFunctionArgs } from "react-router"
import { Outlet, redirect, useLoaderData } from "react-router"
import { SidebarPlatform } from "~/components/blocks/sidebar/platform"
import { SidebarSupport } from "~/components/blocks/sidebar/support"
import { SidebarTitle } from "~/components/blocks/sidebar/title"
import { SidebarUser } from "~/components/blocks/sidebar/user"
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "~/components/ui/sidebar"
import { checkSession, getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"

/**
 * Layout for the measures catalogue. The catalogue is the same for every user and is not
 * tied to a farm, so this layout only requires a signed-in user.
 *
 * @param request - The HTTP request used for obtaining session data.
 * @returns The user details shown in the sidebar.
 */
export async function loader({ request, url }: LoaderFunctionArgs) {
  try {
    const session = await getSession(request)
    const sessionCheckResponse = await checkSession(session, url)
    if (sessionCheckResponse instanceof Response) {
      return sessionCheckResponse
    }

    return {
      user: session.user,
      userName: session.userName,
      initials: session.initials,
    }
  } catch (error) {
    if (error instanceof Response && error.status === 401) {
      const signInUrl = `/signin?redirectTo=${encodeURIComponent(url.pathname)}`
      return redirect(signInUrl)
    }
    throw handleLoaderError(error)
  }
}

/**
 * Renders the measures catalogue layout with the platform sidebar.
 */
export default function MeasuresCatalogueLayout() {
  const loaderData = useLoaderData<typeof loader>()

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarTitle />
        <SidebarContent>
          <SidebarPlatform />
        </SidebarContent>
        <SidebarSupport name={loaderData.userName} email={loaderData.user.email} />
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
