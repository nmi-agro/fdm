import {
  addFarmToGroup,
  getFarms,
  listFarmGroups,
  removeFarmFromGroup,
  removeFarmGroup,
  renameFarmGroup,
} from "@nmi-agro/fdm-core"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { data, useFetcher, useLoaderData } from "react-router"
import { dataWithError, dataWithSuccess, redirectWithSuccess } from "remix-toast"
import { z } from "zod"
import { PeriodDateField } from "~/components/blocks/farm-groups/period-date-field"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import {
  formatPeriodDate,
  getDefaultJoinDate,
  getFarmGroupErrorMessage,
  getPeriodStatus,
  type GroupMembership,
  parseDateInput,
} from "~/lib/farm-groups"
import { fdm } from "~/lib/fdm.server"
import {
  getOrganizationForGroups,
  serializeGroup,
  toDateString,
} from "~/lib/organization-groups.server"
import { cn } from "~/lib/utils"
import { useCalendarStore } from "~/store/calendar"
import type { Route } from "./+types/organization.$slug.groups.$b_id_group"

// Meta
export const meta: Route.MetaFunction = ({ loaderData }) => {
  return [
    {
      title: `${loaderData?.group.b_name_group ?? "Groep"} - Groepen | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Beheer de bedrijven in deze groep, inclusief eerdere perioden.",
    },
  ]
}

/**
 * Finds the group of the route within the organization.
 */
async function getGroup(
  principal_id: string,
  organization_id: string,
  b_id_group: string | undefined,
) {
  const groups = await listFarmGroups(fdm, principal_id, organization_id)
  const group = groups.find((g) => g.b_id_group === b_id_group)
  if (!group) {
    throw data("not found: group", { status: 404, statusText: "not found: group" })
  }
  return group
}

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)
    const organization = await getOrganizationForGroups(request, params.slug)

    const farms = await getFarms(fdm, organization.id)
    const farmNames = new Map(farms.map((farm) => [farm.b_id_farm, farm.b_name_farm]))
    const group = await getGroup(session.principal_id, organization.id, params.b_id_group)

    return {
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      today: toDateString(new Date()),
      farms: farms
        .map((farm) => ({ b_id_farm: farm.b_id_farm, b_name_farm: farm.b_name_farm }))
        .sort((a, b) => (a.b_name_farm ?? "").localeCompare(b.b_name_farm ?? "", "nl")),
      group: serializeGroup(group, farmNames),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

const FormSchema = z.object({
  intent: z.enum(["rename_group", "delete_group", "add_farm", "end_membership"]),
  b_id_farm: z.string().optional(),
  b_name_group: z.string().trim().min(1, { error: "Geef de groep een naam" }).optional(),
})

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const session = await getSession(request)
    const organization = await getOrganizationForGroups(request, params.slug)
    const group = await getGroup(session.principal_id, organization.id, params.b_id_group)

    const formData = await request.formData()
    const parsed = FormSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      return dataWithError(null, { message: parsed.error.issues[0]?.message ?? "Ongeldige invoer" })
    }
    const { intent, b_id_farm, b_name_group } = parsed.data

    // Dates are the dates of the period in which the farm is part of the group, chosen by the user
    const joinedField = formData.get("b_group_joined")
    const leavedField = formData.get("b_group_leaved")
    const b_group_joined = parseDateInput(joinedField)
    const b_group_leaved = parseDateInput(leavedField)
    if (
      (typeof joinedField === "string" && joinedField !== "" && !b_group_joined) ||
      (typeof leavedField === "string" && leavedField !== "" && !b_group_leaved)
    ) {
      return dataWithError(null, { message: "Vul een geldige datum in." })
    }

    try {
      if (intent === "rename_group") {
        if (!b_name_group) {
          return dataWithError(null, { message: "Geef de groep een naam." })
        }
        await renameFarmGroup(fdm, session.principal_id, group.b_id_group, b_name_group)
        return dataWithSuccess(null, { message: "De groep is hernoemd." })
      }
      if (intent === "delete_group") {
        await removeFarmGroup(fdm, session.principal_id, group.b_id_group)
        return redirectWithSuccess(`/organization/${organization.slug}/groups`, {
          message: `Groep ${group.b_name_group} is verwijderd.`,
        })
      }
      if (!b_id_farm) {
        throw data("missing: b_id_farm", { status: 400, statusText: "missing: b_id_farm" })
      }
      if (intent === "add_farm") {
        if (b_group_joined && b_group_leaved && b_group_leaved <= b_group_joined) {
          return dataWithError(null, {
            message:
              "De datum tot wanneer het bedrijf deel uitmaakt van de groep moet na de startdatum liggen.",
          })
        }
        await addFarmToGroup(fdm, session.principal_id, group.b_id_group, b_id_farm, b_group_joined)
        if (b_group_leaved) {
          await removeFarmFromGroup(
            fdm,
            session.principal_id,
            group.b_id_group,
            b_id_farm,
            b_group_leaved,
          )
        }
        return dataWithSuccess(null, { message: "De periode van het bedrijf is opgeslagen." })
      }
      if (intent === "end_membership") {
        if (!b_group_leaved) {
          return dataWithError(null, {
            message: "Vul de datum in tot wanneer het bedrijf bij de groep hoort.",
          })
        }
        await removeFarmFromGroup(
          fdm,
          session.principal_id,
          group.b_id_group,
          b_id_farm,
          b_group_leaved,
        )
        return dataWithSuccess(null, { message: "De einddatum is opgeslagen." })
      }
    } catch (error) {
      const message = getFarmGroupErrorMessage(error)
      if (message) {
        return dataWithError(null, { message })
      }
      throw error
    }
    throw data("Ongeldige actie", { status: 400 })
  } catch (error) {
    return handleActionError(error)
  }
}

const statusVariant = {
  active: "default",
  planned: "outline",
  ended: "secondary",
} as const

export default function OrganizationGroup() {
  const { group, farms, today } = useLoaderData<typeof loader>()

  const current: GroupMembership[] = []
  const past: GroupMembership[] = []
  for (const membership of group.memberships) {
    ;(getPeriodStatus(membership, today).key === "ended" ? past : current).push(membership)
  }
  // Most recent periods first for the history
  past.sort((a, b) => b.b_group_joined.localeCompare(a.b_group_joined))

  return (
    <main>
      <FarmTitle
        title={group.b_name_group}
        description="Beheer welke bedrijven in deze groep zitten en in welke periode. Een bedrijf kan in meerdere groepen zitten."
      />
      <FarmContent>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bedrijven in deze groep</CardTitle>
                <CardDescription>
                  Elke regel is een periode waarin het bedrijf deel uitmaakt van de groep. Het gaat
                  om de datums van die periode, niet om het moment waarop u de wijziging invoert.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {current.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Er zijn geen bedrijven actief of gepland in deze groep.
                  </p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {current.map((membership) => (
                      <MembershipRow
                        key={`${membership.b_id_farm}-${membership.b_group_joined}`}
                        groupId={group.b_id_group}
                        membership={membership}
                        today={today}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Eerdere lidmaatschappen</CardTitle>
                <CardDescription>
                  Periodes waarin een bedrijf deel uitmaakte van de groep en die zijn afgelopen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {past.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Er zijn nog geen afgelopen lidmaatschappen.
                  </p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {past.map((membership) => (
                      <MembershipRow
                        key={`${membership.b_id_farm}-${membership.b_group_joined}`}
                        groupId={group.b_id_group}
                        membership={membership}
                        today={today}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <AddFarmCard group={group} farms={farms} />
            <RenameGroupCard group={group} />
            <DeleteGroupCard group={group} />
          </div>
        </div>
      </FarmContent>
    </main>
  )
}

function MembershipRow({
  groupId,
  membership,
  today,
}: {
  groupId: string
  membership: GroupMembership
  today: string
}) {
  const fetcher = useFetcher<typeof action>()
  const isSubmitting = fetcher.state !== "idle"
  const status = getPeriodStatus(membership, today)
  const [leaved, setLeaved] = useState("")

  return (
    <li className="space-y-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grow truncate text-sm font-medium">
          {membership.b_name_farm ?? "Onbekend"}
        </span>
        <Badge variant={statusVariant[status.key]}>{status.label}</Badge>
      </div>
      <p className="text-muted-foreground text-sm">
        Maakt deel uit van de groep vanaf {formatPeriodDate(membership.b_group_joined)}
        {membership.b_group_leaved
          ? ` tot ${formatPeriodDate(membership.b_group_leaved)}`
          : ", zonder einddatum"}
        .
      </p>
      {!membership.b_group_leaved && (
        <fetcher.Form method="post" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="b_id_group" value={groupId} />
          <input type="hidden" name="b_id_farm" value={membership.b_id_farm} />
          <div className="w-60">
            <PeriodDateField
              label="Maakt deel uit van de groep tot"
              name="b_group_leaved"
              value={leaved}
              onChange={setLeaved}
              required
            />
          </div>
          <Button
            type="submit"
            name="intent"
            value="end_membership"
            variant="outline"
            disabled={isSubmitting || !leaved}
          >
            <Spinner className={cn(!isSubmitting && "hidden")} />
            Einddatum opslaan
          </Button>
        </fetcher.Form>
      )}
    </li>
  )
}

function AddFarmCard({
  group,
  farms,
}: {
  group: { b_id_group: string; memberships: GroupMembership[] }
  farms: { b_id_farm: string; b_name_farm: string | null }[]
}) {
  const calendar = useCalendarStore((state) => state.calendar)
  const defaultJoined = getDefaultJoinDate(calendar)

  return (
    // Remount after a period is added, so the form starts again with the defaults
    <AddFarmForm
      key={group.memberships.length}
      group={group}
      farms={farms}
      defaultJoined={defaultJoined}
    />
  )
}

function AddFarmForm({
  group,
  farms,
  defaultJoined,
}: {
  group: { b_id_group: string }
  farms: { b_id_farm: string; b_name_farm: string | null }[]
  defaultJoined: string
}) {
  const fetcher = useFetcher<typeof action>()
  const isSubmitting = fetcher.state !== "idle"
  const [joined, setJoined] = useState(defaultJoined)
  const [leaved, setLeaved] = useState("")
  const [farm, setFarm] = useState("")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bedrijf toevoegen</CardTitle>
        <CardDescription>
          Kies de periode waarin het bedrijf deel uitmaakt van de groep. Die mag ook in het verleden
          of de toekomst liggen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {farms.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Deze organisatie heeft nog geen bedrijven.
          </p>
        ) : (
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="b_id_group" value={group.b_id_group} />
            <div className="space-y-1">
              <Label htmlFor="add-farm" className="text-sm">
                Bedrijf
              </Label>
              <Select name="b_id_farm" value={farm} onValueChange={setFarm} required>
                <SelectTrigger id="add-farm">
                  <SelectValue placeholder="Kies een bedrijf" />
                </SelectTrigger>
                <SelectContent>
                  {farms.map((f) => (
                    <SelectItem key={f.b_id_farm} value={f.b_id_farm}>
                      {f.b_name_farm ?? "Onbekend"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PeriodDateField
              label="Maakt deel uit van de groep vanaf"
              name="b_group_joined"
              value={joined}
              onChange={setJoined}
              required
            />
            <PeriodDateField
              label="Tot (laat leeg als er geen einddatum is)"
              name="b_group_leaved"
              value={leaved}
              onChange={setLeaved}
            />
            <Button
              type="submit"
              name="intent"
              value="add_farm"
              disabled={isSubmitting || !farm || !joined}
            >
              <Spinner className={cn(!isSubmitting && "hidden")} />
              Toevoegen
            </Button>
          </fetcher.Form>
        )}
      </CardContent>
    </Card>
  )
}

function RenameGroupCard({ group }: { group: { b_id_group: string; b_name_group: string } }) {
  const fetcher = useFetcher<typeof action>()
  const isSubmitting = fetcher.state !== "idle"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Naam</CardTitle>
      </CardHeader>
      <CardContent>
        <fetcher.Form method="post" className="flex gap-2">
          <Input
            name="b_name_group"
            defaultValue={group.b_name_group}
            aria-label="Naam van de groep"
            required
          />
          <Button
            type="submit"
            name="intent"
            value="rename_group"
            variant="outline"
            disabled={isSubmitting}
          >
            <Spinner className={cn(!isSubmitting && "hidden")} />
            Hernoemen
          </Button>
        </fetcher.Form>
      </CardContent>
    </Card>
  )
}

function DeleteGroupCard({ group }: { group: { b_name_group: string } }) {
  const fetcher = useFetcher<typeof action>()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-destructive w-full">
          <Trash2 className="size-4" />
          Groep verwijderen
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Groep {group.b_name_group} verwijderen?</AlertDialogTitle>
          <AlertDialogDescription>
            De groep wordt verwijderd, inclusief de periodes van de bedrijven. De bedrijven zelf
            blijven bestaan. Dit kan niet worden teruggedraaid.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <fetcher.Form method="post">
            <AlertDialogAction type="submit" name="intent" value="delete_group">
              Verwijderen
            </AlertDialogAction>
          </fetcher.Form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
