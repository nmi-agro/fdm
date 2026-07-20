import type { LoaderFunctionArgs } from "react-router"
import posthog from "posthog-js"
import { useEffect } from "react"
import { Outlet, useLoaderData } from "react-router"
import { SidebarPlatform } from "~/components/blocks/sidebar/platform"
import { SidebarSupport } from "~/components/blocks/sidebar/support"
import { SidebarTitle } from "~/components/blocks/sidebar/title"
import { SidebarUser } from "~/components/blocks/sidebar/user"
import { ClientErrorPage } from "~/components/custom/error"
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "~/components/ui/sidebar"
import { checkSession, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"

type UserLoaderData = ReturnType<typeof useLoaderData<typeof loader>>

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
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Get the session
    const session = await getSession(request)
    const sessionCheckResponse = await checkSession(session, request)
    // If checkSession returns a Response, it means a redirect is needed
    if (sessionCheckResponse instanceof Response) {
      return sessionCheckResponse
    }

    // Return user information from loader
    return {
      user: session.user,
      userName: session.userName,
      initials: session.initials,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Renders the user-settings app shell: sidebar and a content pane. Shared between the normal
 * route render (`<Outlet />` in the content pane) and this route's `ErrorBoundary` (a friendly
 * `<ClientErrorPage />` in the content pane), so a descendant route error (e.g. a settings
 * sub-page that fails) never leaves the user with a bare, out-of-app-feeling page.
 */
function UserShell({
  loaderData,
  children,
}: {
  loaderData: UserLoaderData
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarTitle />
        <SidebarContent>
          <SidebarPlatform />
        </SidebarContent>
        <SidebarSupport name={loaderData.userName} email={loaderData.user.email} hasNotification={false} />
        <SidebarUser
          name={loaderData.userName}
          email={loaderData.user.email}
          image={loaderData.user.image}
          avatarInitials={loaderData.initials}
          userName={loaderData.userName}
        />
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
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
    <UserShell loaderData={loaderData}>
      <Outlet />
    </UserShell>
  )
}

/**
 * Renders when a descendant route throws. This route's own loader already succeeded, so the
 * sidebar shell can render normally via {@link UserShell}; only the content pane is replaced
 * with the generic, friendly {@link ClientErrorPage}.
 */
export function ErrorBoundary() {
  const loaderData = useLoaderData<typeof loader>()

  return (
    <UserShell loaderData={loaderData}>
      <ClientErrorPage />
    </UserShell>
  )
}
