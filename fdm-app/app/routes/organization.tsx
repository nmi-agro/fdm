import type { LoaderFunctionArgs } from "react-router"
import {
  checkHelpdeskPermission,
  getUnassignedTicketCount,
  getUnreadAssignedTicketCount,
  getUnreadRequestedTicketCount,
} from "@nmi-agro/fdm-helpdesk"
import posthog from "posthog-js"
import { useEffect } from "react"
import { Outlet, redirect, useLoaderData } from "react-router"
import { Header } from "~/components/blocks/header/base"
import { HeaderOrganization } from "~/components/blocks/header/organization"
import { SidebarOrganization } from "~/components/blocks/sidebar/organization"
import { SidebarOrganizationApps } from "~/components/blocks/sidebar/organization-apps"
import { SidebarSupport } from "~/components/blocks/sidebar/support"
import { SidebarTitle } from "~/components/blocks/sidebar/title"
import { SidebarUser } from "~/components/blocks/sidebar/user"
import { RouteErrorFallback } from "~/components/custom/error"
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "~/components/ui/sidebar"
import { auth, checkSession, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import type { Route } from "./+types/organization"

type OrganizationLoaderData = ReturnType<typeof useLoaderData<typeof loader>>

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

    const helpdeskReadPermission = await checkHelpdeskPermission(
      fdm,
      "helpdesk",
      "read",
      "",
      session.principal_id,
      "routes/farm",
      false,
    )
    const [numUnread, numUnassigned] = await Promise.all([
      helpdeskReadPermission
        ? getUnreadAssignedTicketCount(fdm, session.principal_id)
        : getUnreadRequestedTicketCount(fdm, session.principal_id),
      helpdeskReadPermission ? getUnassignedTicketCount(fdm, session.principal_id) : 0,
    ])
    const hasNotification = numUnread > 0 || numUnassigned > 0

    // Return user information from loader
    return {
      user: session.user,
      userName: session.userName,
      initials: session.initials,
      selectedOrganizationSlug: selectedOrganizationSlug,
      selectedOrganizationRoles: selectedOrganizationRoles,
      organizations: organizations,
      hasNotification: hasNotification,
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
 * Renders the organization app shell: sidebar, header, and a content pane. Shared between the
 * normal route render (`<Outlet />` in the content pane) and this route's `ErrorBoundary` (a
 * friendly `<ClientErrorPage />` in the content pane) so a descendant route error never leaves
 * the user with a bare, out-of-app-feeling page — the sidebar and header stay in place.
 */
function OrganizationShell({
  loaderData,
  children,
}: {
  loaderData: OrganizationLoaderData
  children: React.ReactNode
}) {
  const organization = loaderData.organizations.find(
    (org) => org.slug === loaderData.selectedOrganizationSlug,
  )

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarTitle />
        <SidebarContent>
          <SidebarOrganization organization={organization} roles={loaderData.selectedOrganizationRoles} />
          <SidebarOrganizationApps />
        </SidebarContent>
        <SidebarSupport
          name={loaderData.userName}
          email={loaderData.user.email}
          hasNotification={loaderData.hasNotification}
        />
        <SidebarUser
          name={loaderData.userName}
          email={loaderData.user.email}
          image={loaderData.user.image}
          avatarInitials={loaderData.initials}
          userName={loaderData.userName}
        />
      </Sidebar>
      <SidebarInset className="min-w-0">
        <Header
          action={{
            to: loaderData.selectedOrganizationSlug
              ? `/organization/${loaderData.selectedOrganizationSlug}`
              : "/organization",
            label: "Terug naar organisatie",
            disabled: false,
          }}
        >
          <HeaderOrganization
            selectedOrganizationSlug={loaderData.selectedOrganizationSlug}
            organizationOptions={loaderData.organizations}
          />
        </Header>
        {children}
      </SidebarInset>
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

  // Register organization group so org-level dashboards aggregate events
  useEffect(() => {
    if (clientConfig.analytics.posthog && organization) {
      posthog.group("organization", organization.slug, {
        name: organization.name,
      })
    }
  }, [loaderData.selectedOrganizationSlug, organization?.name])

  return (
    <OrganizationShell loaderData={loaderData}>
      <Outlet />
    </OrganizationShell>
  )
}

/**
 * Renders when a descendant route throws (e.g. a farm/settings page the user can't access, a
 * resource that doesn't exist, or a genuine component bug). This route's own loader already
 * succeeded, so the sidebar/header shell can render normally via {@link OrganizationShell}; only
 * the content pane is replaced with the classified {@link RouteErrorFallback} — the app never
 * appears to have been "left".
 *
 * If instead this route's *own* loader threw, `useLoaderData()` has nothing to return — fall
 * back to the bare, shell-less fallback rather than crash on undefined loader data.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const loaderData = useLoaderData<typeof loader>() as OrganizationLoaderData | undefined

  if (!loaderData) {
    return <RouteErrorFallback error={error} />
  }

  return (
    <OrganizationShell loaderData={loaderData}>
      <RouteErrorFallback error={error} />
    </OrganizationShell>
  )
}
