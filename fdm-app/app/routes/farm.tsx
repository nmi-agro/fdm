import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { getFarm, getFarms, getFields, checkPermission } from "@nmi-agro/fdm-core"
import {
  checkHelpdeskPermission,
  getUnassignedTicketCount,
  getUnreadAssignedTicketCount,
  getUnreadRequestedTicketCount,
} from "@nmi-agro/fdm-helpdesk"
import posthog from "posthog-js"
import { useEffect } from "react"
import { Outlet, redirect, useLoaderData, useMatches } from "react-router"
import { SidebarApps } from "~/components/blocks/sidebar/apps"
import { SidebarFarm, SidebarLabs } from "~/components/blocks/sidebar/farm"
import { SidebarSupport } from "~/components/blocks/sidebar/support"
import { SidebarTitle } from "~/components/blocks/sidebar/title"
import { SidebarUser } from "~/components/blocks/sidebar/user"
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "~/components/ui/sidebar"
import { checkSession, getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { useCalendarStore } from "~/store/calendar"
import { useFarmStore } from "~/store/farm"
import { useSelectedFieldStore } from "~/store/selected-field"

export const meta: MetaFunction = () => {
  return [
    { title: `Dashboard | ${clientConfig.name}` },
    {
      name: "description",
      content: "Beheer je bedrijfsgegevens, percelen en gewassen in één overzichtelijk dashboard.",
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

    // Minimal farm list for the sidebar's farm picker dialog; only needed when no farm is selected yet
    const isFarmSelected = params.b_id_farm && params.b_id_farm !== "undefined"
    const farmOptions = isFarmSelected
      ? []
      : (await getFarms(fdm, session.principal_id)).map((f) => ({
          b_id_farm: f.b_id_farm,
          b_name_farm: f.b_name_farm,
        }))

    const farmWritePermission =
      params.b_id_farm && params.b_id_farm !== "undefined"
        ? await checkPermission(
            fdm,
            "farm",
            "write",
            params.b_id_farm,
            session.principal_id,
            new URL(request.url).pathname,
            false,
          )
        : false

    const timeframe = getTimeframe(params)

    const fields =
      params.b_id_farm && params.b_id_farm !== "undefined"
        ? await getFields(fdm, session.principal_id, params.b_id_farm, timeframe)
        : []

    const fieldOptions = fields.map((field) => {
      if (!field?.b_id || !field?.b_name) {
        throw new Error("Invalid field data structure")
      }
      return {
        b_id: field.b_id,
        b_name: field.b_name,
        b_area: Math.round((field.b_area ?? 0) * 10) / 10,
      }
    })

    // Sort fields by name alphabetically
    fieldOptions.sort((a, b) => a.b_name.localeCompare(b.b_name))

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
      farm: farm,
      farmOptions: farmOptions,
      user: session.user,
      userName: session.userName,
      initials: session.initials,
      hasNotification: hasNotification,
      farmWritePermission: farmWritePermission,
      fieldOptions: fieldOptions,
    }
  } catch (error) {
    // If getSession throws (e.g., invalid token), it might result in a 401
    // We need to handle that case here as well, similar to the ErrorBoundary
    if (error instanceof Response && error.status === 401) {
      const currentPath = new URL(request.url).pathname
        .replace(/\/_\.data$/, "/")
        .replace(/\.data$/, "")
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
    (match) => match.pathname.startsWith("/farm/") && match.params.b_id_farm,
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
    if (initialCalendar !== undefined) {
      setCalendar(initialCalendar)
    }
  }, [initialCalendar, setCalendar])

  const { b_id: storedFieldId, setSelectedField, syncContext } = useSelectedFieldStore()

  // Expire stale fields across farm or calendar change
  useEffect(() => {
    syncContext(initialFarmId, initialCalendar)
  }, [initialFarmId, initialCalendar, syncContext])

  // Sync store from any route scoped to a specific field (b_id), not just /field/*, so pages
  // like nutrient advice, norms, balance, indicators, and measures also keep the sidebar's
  // active field in sync. Excludes the farm/field creation wizards, whose :b_id is a
  // not-yet-saved draft rather than a real, persisted field.
  const fieldMatch = matches.find(
    (match) =>
      typeof match.params.b_id === "string" &&
      !match.pathname.includes("/create") &&
      !match.pathname.includes("/field/new"),
  )
  const urlFieldId = fieldMatch?.params.b_id as string | undefined
  const fieldWritePermission =
    (fieldMatch?.loaderData as { fieldWritePermission?: boolean } | undefined)
      ?.fieldWritePermission ?? false

  useEffect(() => {
    if (urlFieldId) {
      setSelectedField(urlFieldId, null)
    }
  }, [urlFieldId, setSelectedField])

  // On non-field pages fall back to the last-selected field from the store
  const activeFieldId = urlFieldId ?? storedFieldId ?? undefined

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

  // Register farm group so farm-level dashboards aggregate all events from this farm
  useEffect(() => {
    if (clientConfig.analytics.posthog && loaderData.farm?.b_id_farm) {
      posthog.group("farm", loaderData.farm.b_id_farm, {
        b_name_farm: loaderData.farm.b_name_farm,
      })
    }
  }, [loaderData.farm?.b_id_farm, loaderData.farm?.b_name_farm])

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarTitle />
        <SidebarContent>
          <SidebarFarm
            farm={loaderData.farm}
            farms={loaderData.farmOptions}
            fields={loaderData.fieldOptions}
            activeFieldId={activeFieldId}
            fieldWritePermission={fieldWritePermission}
          />
          <SidebarApps farms={loaderData.farmOptions} />
          <SidebarLabs />
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
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
