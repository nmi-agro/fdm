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
import { Outlet, redirect, useLoaderData, useMatches, useParams } from "react-router"
import { SidebarApps } from "~/components/blocks/sidebar/apps"
import { SidebarFarm, SidebarLabs } from "~/components/blocks/sidebar/farm"
import { SidebarSupport } from "~/components/blocks/sidebar/support"
import { SidebarTitle } from "~/components/blocks/sidebar/title"
import { SidebarUser } from "~/components/blocks/sidebar/user"
import { ClientErrorPage, RouteErrorFallback } from "~/components/custom/error"
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "~/components/ui/sidebar"
import { checkSession, getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { containsErrorMessage, handleLoaderError, PERMISSION_DENIED_MESSAGE } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { useCalendarStore } from "~/store/calendar"
import { useFarmStore } from "~/store/farm"
import { useSelectedFieldStore } from "~/store/selected-field"
import type { Route } from "./+types/farm"

type FarmLoaderData = ReturnType<typeof useLoaderData<typeof loader>>

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
 * If `b_id_farm` is present but doesn't resolve to a farm the principal can access (whether it
 * doesn't exist or the principal simply lacks permission — both look identical to the caller),
 * this does NOT throw: it returns `farmAccessDenied: true` instead, so the layout can keep the
 * sidebar/app shell in place and show a friendly, generic message in the content pane rather
 * than losing the entire shell to the root error page. Any other, unexpected error still throws
 * normally.
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

    const hasFarmParam = Boolean(params.b_id_farm && params.b_id_farm !== "undefined")

    let farm: Awaited<ReturnType<typeof getFarm>> | undefined
    let farmAccessDenied = false
    if (hasFarmParam && params.b_id_farm) {
      try {
        farm = await getFarm(fdm, session.principal_id, params.b_id_farm)
      } catch (err) {
        if (containsErrorMessage(err, PERMISSION_DENIED_MESSAGE)) {
          farmAccessDenied = true
        } else {
          throw err
        }
      }
    }

    // Minimal farm list for the sidebar's farm picker dialog; needed whenever no valid farm is
    // selected — either none was requested, or the requested one couldn't be accessed — so the
    // user always has a real way to get back into the app.
    const farmOptions =
      !hasFarmParam || farmAccessDenied
        ? (await getFarms(fdm, session.principal_id)).map((f) => ({
            b_id_farm: f.b_id_farm,
            b_name_farm: f.b_name_farm,
          }))
        : []

    const farmWritePermission =
      hasFarmParam && !farmAccessDenied && params.b_id_farm
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
      hasFarmParam && !farmAccessDenied && params.b_id_farm
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
      farmAccessDenied: farmAccessDenied,
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
 * Renders the farm app shell: sidebar and a content pane. Shared between the normal route
 * render, the in-loader "farm inaccessible" state, and this route's `ErrorBoundary` for
 * descendant-route errors, so none of those cases ever lose the sidebar — only the content
 * pane changes.
 */
function FarmShell({
  loaderData,
  activeFieldId,
  fieldWritePermission,
  children,
}: {
  loaderData: FarmLoaderData
  activeFieldId: string | undefined
  fieldWritePermission: boolean
  children: React.ReactNode
}) {
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
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  )
}

/**
 * Keeps the sidebar's farm/calendar context (zustand stores) in sync with the current URL. Used
 * by both the normal render and the `ErrorBoundary` below — a descendant-route error (e.g. an
 * invalid field id) must not leave the sidebar showing a stale or "no farm selected" state when
 * the farm itself is perfectly valid.
 */
function useFarmContextSync(farmId: string | undefined, calendar: string | undefined) {
  const setFarmId = useFarmStore((state) => state.setFarmId)
  useEffect(() => {
    setFarmId(farmId)
  }, [farmId, setFarmId])

  const setCalendar = useCalendarStore((state) => state.setCalendar)
  useEffect(() => {
    if (calendar !== undefined) {
      setCalendar(calendar)
    }
  }, [calendar, setCalendar])

  const syncContext = useSelectedFieldStore((state) => state.syncContext)
  useEffect(() => {
    // Expire stale fields across farm or calendar change
    syncContext(farmId, calendar)
  }, [farmId, calendar, syncContext])
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

  const calendarMatch = matches.find(
    (match) => match.pathname.startsWith("/farm/") && match.params.calendar,
  )
  const initialCalendar = calendarMatch?.params.calendar as string | undefined

  // When the requested farm couldn't be accessed, don't leave the store pointing at it — the
  // sidebar should fall back to its normal "no farm selected" state instead of a broken one.
  useFarmContextSync(loaderData.farmAccessDenied ? undefined : initialFarmId, initialCalendar)

  const { b_id: storedFieldId, setSelectedField } = useSelectedFieldStore()

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
    <FarmShell
      loaderData={loaderData}
      activeFieldId={activeFieldId}
      fieldWritePermission={fieldWritePermission}
    >
      {loaderData.farmAccessDenied ? <ClientErrorPage /> : <Outlet />}
    </FarmShell>
  )
}

/**
 * Renders when a descendant route throws (e.g. a field, cultivation, or other resource that
 * doesn't exist or can't be accessed — or a genuine component bug). This route's own loader
 * already succeeded — the requested farm itself is fine — so the sidebar shell can render
 * normally via {@link FarmShell}; only the content pane is replaced with the classified
 * {@link RouteErrorFallback} (the friendly page for an expected client error, or the diagnostic
 * page for a real bug). The app never appears to have been "left".
 *
 * The farm/calendar context is synced from `loaderData.farm` and the URL just like in {@link App},
 * so e.g. an invalid field id under a perfectly valid farm still shows that farm as active in the
 * sidebar instead of falling back to "no farm selected".
 *
 * If instead this route's *own* loader threw (an unexpected error, not the handled
 * `farmAccessDenied` case), `useLoaderData()` has nothing to return — there's no session/farm
 * data to build the sidebar from, so fall back to the bare, shell-less fallback rather than crash.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const loaderData = useLoaderData<typeof loader>() as FarmLoaderData | undefined
  const params = useParams()
  const calendar = params.calendar

  useFarmContextSync(loaderData?.farm?.b_id_farm, calendar)

  if (!loaderData) {
    return <RouteErrorFallback error={error} />
  }

  return (
    <FarmShell loaderData={loaderData} activeFieldId={undefined} fieldWritePermission={false}>
      <RouteErrorFallback error={error} />
    </FarmShell>
  )
}
