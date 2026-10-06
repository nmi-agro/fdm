import {
  acceptInvitation,
  declineInvitation,
  getFarms,
  getFields,
  listFarmGroups,
  listPendingInvitationsForUser,
} from "@nmi-agro/fdm-core"
import { Square, UserGroup, Users } from "lucide-react"
import { useRef } from "react"
import { useEffect } from "react"
import { data, NavLink, redirect, useLoaderData, useSearchParams } from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import { cn } from "@/app/lib/utils"
import { FarmCard, type FarmWithRoles } from "~/components/blocks/farm/farm-card"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { PendingInvitationCard } from "~/components/blocks/farm/pending-invitation"
import { NoFarmsMessage } from "~/components/blocks/organization/no-farms-message"
import { OrganizationAvatar } from "~/components/blocks/organization/organization-avatar"
import { Expandable, ExpandableContent, ExpandableTrigger } from "~/components/custom/expandable"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import { SidebarInset } from "~/components/ui/sidebar"
import { auth, getSession } from "~/lib/auth.server"
import { getCalendarSelection, getTimeframe, isSupportedYear } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { parseOrganizationMetadata } from "~/lib/organization-helpers"
import { AccessFormSchema } from "~/lib/schemas/access.schema"
import { useCalendarStore } from "~/store/calendar"
import type { Route } from "./+types/organization.$slug._index"

// Meta
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Organisatie | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bekijk en bewerk de gegevens van jouw organisatie.",
    },
  ]
}

export async function loader({ params, request, url }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)

    // Redirect in case a corrected calendar selection is needed.
    let activeYear = new Date().getFullYear().toString()
    const calendarParam = url.searchParams.get("calendar")
    if (calendarParam) {
      const year = Number(calendarParam)
      if (isSupportedYear(year)) {
        activeYear = calendarParam
      } else {
        const searchParams = new URLSearchParams(url.searchParams)
        searchParams.set("calendar", activeYear)
        return redirect(`/organization/${params.slug}?${searchParams.toString()}`)
      }
    }
    const calendar = activeYear
    const timeframe = getTimeframe({ calendar: activeYear })

    const organizations = await auth.api.listOrganizations({
      headers: request.headers,
    })

    const rawOrganization = organizations.find((org) => org.slug === params.slug)

    if (!rawOrganization) {
      throw data("Organisatie niet gevonden.", {
        status: 404,
        statusText: "Organisatie niet gevonden.",
      })
    }

    const organization = {
      ...rawOrganization,
      metadata: parseOrganizationMetadata(rawOrganization),
    }

    const members = await auth.api.listMembers({
      headers: request.headers,
      query: { organizationSlug: params.slug },
    })

    const userRoles = new Set(
      members.members
        .filter((member) => member.userId === session.principal_id)
        .map((member) => member.role),
    )

    // TODO: Sync role permissions with fdm-core better
    const canModify = userRoles.has("owner") || userRoles.has("admin")

    // Get pending farm invitations for this organization
    const allPendingInvitations = await listPendingInvitationsForUser(
      fdm,
      session.principal_id,
      true,
    )
    const pendingInvitations = allPendingInvitations.filter(
      (invitation) => invitation.target_principal_id === organization.id,
    )

    // Get a list of possible farms of the user
    const farms = await getFarms(fdm, organization.id)
    const farmGroups = await listFarmGroups(fdm, session.principal_id, organization.id)

    const farmsExtended: (FarmWithRoles & {
      b_area_farm: number | null
    })[] = await Promise.all(
      farms.map(async (farm) => {
        const fields = await getFields(fdm, session.principal_id, farm.b_id_farm, timeframe)

        const farmArea = fields.reduce((acc, field) => acc + (field.b_area ?? 0), 0)

        return {
          ...farm,
          roles: undefined,
          b_area_farm: farmArea,
          userRoles: [...new Set(farm.roles.map((role) => role.role))],
          groups: farmGroups
            .filter((group) => group.b_id_farms.includes(farm.b_id_farm))
            .map((group) => ({ b_id_group: group.b_id_group, b_name_group: group.b_name_group })),
        }
      }),
    )

    const totalArea = farmsExtended.reduce((acc, farm) => acc + (farm.b_area_farm ?? 0), 0)

    return {
      farms: farmsExtended,
      groups: farmGroups.map((group) => ({
        b_id_group: group.b_id_group,
        b_name_group: group.b_name_group,
        farmCount: group.b_id_farms.length,
      })),
      totalArea: totalArea,
      calendar: calendar,
      slug: params.slug,
      organization: organization,
      members: members.members,
      pendingInvitations: pendingInvitations,
      canModify: canModify,
    }
  } catch (e) {
    throw handleLoaderError(e)
  }
}

/**
 * Renders the user interface for farm management.
 *
 * This component uses data from the loader to display a personalized greeting and either a list of available
 * farms for selection or a prompt to create a new farm if none exist. It integrates various UI elements like
 * the header, title, card layout, and navigation buttons to facilitate seamless interaction.
 */
export default function AppIndex() {
  const loaderData = useLoaderData<typeof loader>()
  const calendar = useCalendarStore((store) => store.calendar)
  const setCalendar = useCalendarStore((store) => store.setCalendar)
  const [searchParams, setSearchParams] = useSearchParams()

  const lastRedirectedCalendarVal = useRef(loaderData.calendar)
  const pendingCalendarVal = useRef<string | null>(null)
  // Set the selected calendar year to what is sent from the server
  useEffect(() => {
    if (searchParams.get("calendar") === loaderData.calendar) {
      pendingCalendarVal.current = loaderData.calendar
      setCalendar(loaderData.calendar)
    }
  }, [loaderData.calendar, searchParams, setCalendar])

  useEffect(() => {
    if (pendingCalendarVal.current !== null) {
      if (calendar !== pendingCalendarVal.current) {
        return
      }
      pendingCalendarVal.current = null
    }
    if (
      calendar &&
      calendar !== lastRedirectedCalendarVal.current &&
      loaderData.calendar !== calendar
    ) {
      setSearchParams({ ...Object.fromEntries(searchParams.entries()), calendar: calendar })
      lastRedirectedCalendarVal.current = calendar
    }
  }, [loaderData.calendar, searchParams, setSearchParams, calendar, setCalendar])

  const years = getCalendarSelection()
  const description = loaderData.organization.metadata.data?.description
  return (
    <SidebarInset>
      <main>
        <FarmTitle
          title={`Dashboard van ${loaderData.organization.name}`}
          description={"Bekijk alle informatie over deze organisatie"}
          rightNode={
            <OrganizationAvatar
              src={loaderData.organization.logo}
              alt={`Logo van ${loaderData.organization.name}`}
              className="size-14"
            />
          }
        />
        <FarmContent>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left Column */}
            <div className="space-y-8 lg:col-span-2">
              {/* Quick Actions */}
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">Overzichten</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <NavLink to={`${calendar}/farms`}>
                    <Card className="transition-all hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="bg-primary text-primary-foreground rounded-lg p-3">
                            <Square className="h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle>Bedrijven</CardTitle>
                            <CardDescription>
                              Uitgebreide tabel met bedrijven met toegang tot deze organisatie.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </NavLink>
                  <NavLink to="members">
                    <Card className="transition-all hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="bg-primary text-primary-foreground rounded-lg p-3">
                            <Users className="h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle>Leden</CardTitle>
                            <CardDescription>
                              Bekijk en beheer de gebruikers die toegang hebben tot deze
                              organisatie.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </NavLink>
                </div>
              </div>
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">Bedrijven</h2>
                {loaderData.farms.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {loaderData.farms.map((farm) => (
                      <FarmCard key={farm.b_id_farm} farm={farm} />
                    ))}
                  </div>
                ) : (
                  loaderData.pendingInvitations.length === 0 && <NoFarmsMessage />
                )}
              </div>
              {loaderData.pendingInvitations.length > 0 && (
                <div className="w-full space-y-4">
                  <h2 className="text-xl font-semibold">Openstaande uitnodigingen</h2>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {loaderData.pendingInvitations.map((invitation) => (
                      <PendingInvitationCard
                        key={invitation.invitation_id}
                        principalType="organization"
                        invitation={invitation}
                        canAccept={invitation.can_accept}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Overview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold tracking-tight">Overzicht</h2>
                  <Button asChild variant="outline">
                    <NavLink to="./settings" className={cn(!loaderData.canModify && "invisible")}>
                      Instellingen
                    </NavLink>
                  </Button>
                </div>
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    {/* tiles */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/50 space-y-1 rounded-lg p-3">
                        <p className="text-muted-foreground text-xs">Bedrijven</p>
                        <p className="text-2xl font-bold">{loaderData.farms.length}</p>
                      </div>
                      <div className="bg-muted/50 space-y-1 rounded-lg p-3">
                        <p className="text-muted-foreground text-xs">Oppervlakte</p>
                        <p className="text-2xl font-bold">
                          {Math.round(loaderData.totalArea * 10) / 10}
                          <span className="text-muted-foreground ml-1 text-sm font-normal">ha</span>
                        </p>
                      </div>
                    </div>
                    <Separator />
                    {/* Year selector */}
                    <div className="flex items-center justify-between">
                      <p className="text-muted-foreground text-sm">Jaar</p>
                      <Select value={calendar} onValueChange={(value) => setCalendar(value)}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Selecteer een jaar" />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map((year) => (
                            <SelectItem key={year} value={year}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Separator />
                    {/* Description */}
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-sm">Beschrijving</p>
                      <Expandable>
                        <ExpandableContent className="text-sm whitespace-pre-line">
                          {description && description.length > 0
                            ? description
                            : "Geen beschrijving"}
                        </ExpandableContent>
                        <ExpandableTrigger />
                      </Expandable>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Groups */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold tracking-tight">Groepen</h2>
                  <Button asChild variant="outline">
                    <NavLink to="./groups">Beheer</NavLink>
                  </Button>
                </div>
                <Card>
                  <CardContent className="pt-6">
                    {loaderData.groups.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        Deze organisatie heeft nog geen groepen.
                      </p>
                    ) : (
                      <ul className="grid gap-4">
                        {loaderData.groups.map((group) => (
                          <li key={group.b_id_group}>
                            <NavLink
                              to={`./groups/${group.b_id_group}`}
                              className="hover:text-primary flex items-center gap-3"
                            >
                              <div className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                                <UserGroup className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm leading-none font-medium">
                                  {group.b_name_group}
                                </p>
                                <p className="text-muted-foreground mt-1 text-xs">
                                  {group.farmCount}{" "}
                                  {group.farmCount === 1 ? "bedrijf" : "bedrijven"}
                                </p>
                              </div>
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold tracking-tight">Leden</h2>
                  <Button asChild variant="outline">
                    <NavLink to="./members" className={cn(!loaderData.canModify && "invisible")}>
                      Beheer
                    </NavLink>
                  </Button>
                </div>
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-1">
                      <div className="grid gap-6">
                        {loaderData.members.map((member) => {
                          const initials = (member.user.name || "?").charAt(0).toUpperCase()
                          return (
                            <div key={member.id} className="flex items-center space-x-4">
                              <Avatar>
                                <AvatarImage src={member.user.image ?? undefined} />
                                <AvatarFallback>{initials}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm leading-none font-medium">
                                  {member.user.name}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </FarmContent>
      </main>
    </SidebarInset>
  )
}

export async function action({ request }: Route.ActionArgs) {
  try {
    const session = await getSession(request)
    const formValues = await extractFormValuesFromRequest(request, AccessFormSchema)

    if (formValues.intent === "accept_farm_invitation") {
      if (!formValues.invitation_id) {
        return dataWithError(null, "Ontbrekend uitnodigings id")
      }
      await acceptInvitation(fdm, formValues.invitation_id, session.user.id)
      return dataWithSuccess(null, {
        message: "Uitnodiging geaccepteerd! 🎉",
      })
    }

    if (formValues.intent === "decline_farm_invitation") {
      if (!formValues.invitation_id) {
        return dataWithError(null, "Ontbrekend uitnodigings id")
      }
      await declineInvitation(fdm, formValues.invitation_id, session.user.id)
      return dataWithSuccess(null, {
        message: "Uitnodiging geweigerd.",
      })
    }

    return dataWithError(null, "Onbekende actie")
  } catch (error) {
    void handleActionError(error)
    return dataWithError(null, "Er is iets misgegaan")
  }
}
