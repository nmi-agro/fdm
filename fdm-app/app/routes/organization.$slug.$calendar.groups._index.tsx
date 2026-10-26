import { createFarmGroup, getFarms, listFarmGroups } from "@nmi-agro/fdm-core"
import { UserGroup } from "lucide-react"
import { NavLink, redirect, useFetcher, useLoaderData } from "react-router"
import { dataWithError } from "remix-toast"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import {
  formatCalendarLabel,
  getFarmGroupErrorMessage,
  summarizeMemberships,
} from "~/lib/farm-groups"
import { fdm } from "~/lib/fdm.server"
import { getOrganizationForGroups, serializeGroup } from "~/lib/organization-groups.server"
import { cn } from "~/lib/utils"
import type { Route } from "./+types/organization.$slug.$calendar.groups._index"

// Meta
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Groepen - Organisatie | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bekijk en beheer de groepen bedrijven van jouw organisatie.",
    },
  ]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    // Rejects an unsupported calendar year
    getTimeframe(params)
    const calendar = getCalendar(params)
    const session = await getSession(request)
    const organization = await getOrganizationForGroups(request, params.slug)

    const farms = await getFarms(fdm, organization.id)
    const farmNames = new Map(farms.map((farm) => [farm.b_id_farm, farm.b_name_farm]))
    const groups = await listFarmGroups(fdm, session.principal_id, organization.id)

    return {
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      calendar,
      groups: groups
        .map((group) => serializeGroup(group, farmNames))
        .sort((a, b) => a.b_name_group.localeCompare(b.b_name_group, "nl")),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const session = await getSession(request)
    const organization = await getOrganizationForGroups(request, params.slug)

    const formData = await request.formData()
    const nameField = formData.get("b_name_group")
    const b_name_group = typeof nameField === "string" ? nameField.trim() : ""
    if (!b_name_group) {
      return dataWithError(null, { message: "Geef de groep een naam." })
    }

    try {
      const b_id_group = await createFarmGroup(
        fdm,
        session.principal_id,
        organization.id,
        b_name_group,
      )
      // Continue on the page of the new group to add farms
      return redirect(
        `/organization/${organization.slug}/${getCalendar(params)}/groups/${b_id_group}`,
      )
    } catch (error) {
      const message = getFarmGroupErrorMessage(error)
      if (message) {
        return dataWithError(null, { message })
      }
      throw error
    }
  } catch (error) {
    return handleActionError(error)
  }
}

export default function OrganizationGroups() {
  const { organization, groups, calendar } = useLoaderData<typeof loader>()
  const calendarLabel = formatCalendarLabel(calendar)

  return (
    <main>
      <FarmTitle
        title={`Groepen van ${organization.name}`}
        description="Verdeel de bedrijven van deze organisatie in groepen, bijvoorbeeld per project. Een bedrijf kan in meerdere groepen zitten."
      />
      <FarmContent>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">Groepen in {calendarLabel}</h2>
              <p className="text-muted-foreground text-sm">
                De bedrijven per groep gelden voor {calendarLabel}. Kies een ander jaar in de
                kalender om een ander jaar te zien.
              </p>
            </div>
            {groups.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Deze organisatie heeft nog geen groepen. Maak rechts de eerste groep aan.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {groups.map((group) => {
                  const summary = summarizeMemberships(group.memberships, calendar)
                  return (
                    <NavLink key={group.b_id_group} to={`./${group.b_id_group}`} className="block">
                      <Card className="hover:border-primary/50 h-full transition-all hover:shadow-md">
                        <CardHeader>
                          <div className="flex items-center gap-3">
                            <div className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                              <UserGroup className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="truncate text-xl">
                                {group.b_name_group}
                              </CardTitle>
                              <CardDescription>
                                {summary.farmCount}{" "}
                                {summary.farmCount === 1 ? "bedrijf" : "bedrijven"} in{" "}
                                {calendarLabel}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        {summary.farmNames.length > 0 && (
                          <CardContent>
                            <p className="text-muted-foreground line-clamp-2 text-sm">
                              {summary.farmNames.join(", ")}
                            </p>
                          </CardContent>
                        )}
                      </Card>
                    </NavLink>
                  )
                })}
              </div>
            )}
          </section>
          <CreateGroupCard key={groups.length} />
        </div>
      </FarmContent>
    </main>
  )
}

function CreateGroupCard() {
  const fetcher = useFetcher<typeof action>()
  const isSubmitting = fetcher.state !== "idle"

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Nieuwe groep</CardTitle>
        <CardDescription>Geef de groep een naam die voor alle leden herkenbaar is.</CardDescription>
      </CardHeader>
      <CardContent>
        <fetcher.Form method="post" className="flex gap-2">
          <Input
            name="b_name_group"
            placeholder="Bijvoorbeeld: Project A"
            aria-label="Naam van de groep"
            required
          />
          <Button type="submit" disabled={isSubmitting}>
            <Spinner className={cn(!isSubmitting && "hidden")} />
            Aanmaken
          </Button>
        </fetcher.Form>
      </CardContent>
    </Card>
  )
}
