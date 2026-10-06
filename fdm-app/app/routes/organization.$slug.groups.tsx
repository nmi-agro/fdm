import {
  addFarmToGroup,
  createFarmGroup,
  getFarms,
  listFarmGroups,
  removeFarmFromGroup,
  removeFarmGroup,
  renameFarmGroup,
} from "@nmi-agro/fdm-core"
import { Trash2 } from "lucide-react"
import { data, useFetcher, useLoaderData } from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import { z } from "zod"
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
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { formatPeriodDate, getFarmGroupErrorMessage, parseDateInput } from "~/lib/farm-groups"
import { fdm } from "~/lib/fdm.server"
import { cn } from "~/lib/utils"
import type { Route } from "./+types/organization.$slug.groups"

// Meta
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Groepen - Organisatie | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Beheer de groepen bedrijven van jouw organisatie.",
    },
  ]
}

/**
 * Finds the organization of the route for the signed-in user.
 */
async function getOrganization(request: Request, slug: string | undefined) {
  if (!slug) {
    throw data("not found: organization", { status: 404, statusText: "not found: organization" })
  }
  const organizations = await auth.api.listOrganizations({ headers: request.headers })
  const organization = organizations.find((org) => org.slug === slug)
  if (!organization) {
    throw data("not found: organization", { status: 404, statusText: "not found: organization" })
  }
  return organization
}

/** Formats a date as `YYYY-MM-DD`. */
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)
    const organization = await getOrganization(request, params.slug)

    const farms = await getFarms(fdm, organization.id)
    const farmNames = new Map(farms.map((farm) => [farm.b_id_farm, farm.b_name_farm]))
    const groups = await listFarmGroups(fdm, session.principal_id, organization.id)

    return {
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      today: toDateString(new Date()),
      farms: farms
        .map((farm) => ({ b_id_farm: farm.b_id_farm, b_name_farm: farm.b_name_farm }))
        .sort((a, b) => (a.b_name_farm ?? "").localeCompare(b.b_name_farm ?? "", "nl")),
      groups: groups.map((group) => ({
        b_id_group: group.b_id_group,
        b_name_group: group.b_name_group,
        memberships: group.memberships
          .filter((membership) => farmNames.has(membership.b_id_farm))
          .map((membership) => ({
            b_id_farm: membership.b_id_farm,
            b_name_farm: farmNames.get(membership.b_id_farm) ?? null,
            b_group_joined: toDateString(membership.b_group_joined),
            b_group_leaved: membership.b_group_leaved
              ? toDateString(membership.b_group_leaved)
              : null,
          })),
      })),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

const FormSchema = z.object({
  intent: z.enum(["create_group", "rename_group", "delete_group", "add_farm", "end_membership"]),
  b_id_group: z.string().optional(),
  b_id_farm: z.string().optional(),
  b_name_group: z.string().trim().min(1, { error: "Geef de groep een naam" }).optional(),
})

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const session = await getSession(request)
    const organization = await getOrganization(request, params.slug)

    const formData = await request.formData()
    const parsed = FormSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      return dataWithError(null, { message: parsed.error.issues[0]?.message ?? "Ongeldige invoer" })
    }
    const { intent, b_id_group, b_id_farm, b_name_group } = parsed.data

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
      if (intent === "create_group") {
        if (!b_name_group) {
          return dataWithError(null, { message: "Geef de groep een naam." })
        }
        await createFarmGroup(fdm, session.principal_id, organization.id, b_name_group)
        return dataWithSuccess(null, { message: `Groep ${b_name_group} is aangemaakt.` })
      }

      // The group must belong to this organization
      const groups = await listFarmGroups(fdm, session.principal_id, organization.id)
      const group = groups.find((g) => g.b_id_group === b_id_group)
      if (!b_id_group || !group) {
        throw data("not found: group", { status: 404, statusText: "not found: group" })
      }

      if (intent === "rename_group") {
        if (!b_name_group) {
          return dataWithError(null, { message: "Geef de groep een naam." })
        }
        await renameFarmGroup(fdm, session.principal_id, b_id_group, b_name_group)
        return dataWithSuccess(null, { message: "De groep is hernoemd." })
      }
      if (intent === "delete_group") {
        await removeFarmGroup(fdm, session.principal_id, b_id_group)
        return dataWithSuccess(null, { message: `Groep ${group.b_name_group} is verwijderd.` })
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
        await addFarmToGroup(fdm, session.principal_id, b_id_group, b_id_farm, b_group_joined)
        if (b_group_leaved) {
          await removeFarmFromGroup(
            fdm,
            session.principal_id,
            b_id_group,
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
        await removeFarmFromGroup(fdm, session.principal_id, b_id_group, b_id_farm, b_group_leaved)
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

export default function OrganizationGroups() {
  const { organization, groups, farms, today } = useLoaderData<typeof loader>()

  return (
    <main>
      <FarmTitle
        title={`Groepen van ${organization.name}`}
        description="Verdeel de bedrijven van deze organisatie in groepen, bijvoorbeeld per project. Een bedrijf kan in meerdere groepen zitten."
        action={{ label: "Terug naar bedrijven", to: "./.." }}
      />
      <div className="mx-auto max-w-3xl space-y-4 px-4 pb-8">
        <CreateGroupCard key={groups.length} />
        {groups.length === 0 ? (
          <p className="text-muted-foreground px-1 text-sm">
            Deze organisatie heeft nog geen groepen.
          </p>
        ) : (
          groups.map((group) => (
            <GroupCard key={group.b_id_group} group={group} farms={farms} today={today} />
          ))
        )}
      </div>
    </main>
  )
}

function CreateGroupCard() {
  const fetcher = useFetcher<typeof action>()
  const isSubmitting = fetcher.state !== "idle"

  return (
    <Card>
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
          <Button type="submit" name="intent" value="create_group" disabled={isSubmitting}>
            <Spinner className={cn(!isSubmitting && "hidden")} />
            Aanmaken
          </Button>
        </fetcher.Form>
      </CardContent>
    </Card>
  )
}

type Membership = {
  b_id_farm: string
  b_name_farm: string | null
  b_group_joined: string
  b_group_leaved: string | null
}

type GroupData = {
  b_id_group: string
  b_name_group: string
  memberships: Membership[]
}

/**
 * Describes the period in which a farm is part of the group, relative to today.
 */
function getPeriodStatus(membership: Membership, today: string) {
  if (membership.b_group_joined > today) {
    return { label: "Gepland", variant: "outline" as const }
  }
  if (membership.b_group_leaved && membership.b_group_leaved <= today) {
    return { label: "Beëindigd", variant: "secondary" as const }
  }
  return { label: "Actief", variant: "default" as const }
}

function GroupCard({
  group,
  farms,
  today,
}: {
  group: GroupData
  farms: { b_id_farm: string; b_name_farm: string | null }[]
  today: string
}) {
  const renameFetcher = useFetcher<typeof action>()
  const deleteFetcher = useFetcher<typeof action>()
  const isRenaming = renameFetcher.state !== "idle"
  const activeCount = new Set(
    group.memberships
      .filter((membership) => getPeriodStatus(membership, today).label === "Actief")
      .map((membership) => membership.b_id_farm),
  ).size

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {group.b_name_group}
          <Badge variant="secondary">
            {activeCount} {activeCount === 1 ? "bedrijf" : "bedrijven"} nu
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <renameFetcher.Form method="post" className="flex gap-2">
          <input type="hidden" name="b_id_group" value={group.b_id_group} />
          <Input
            name="b_name_group"
            defaultValue={group.b_name_group}
            aria-label={`Naam van groep ${group.b_name_group}`}
            required
          />
          <Button
            type="submit"
            name="intent"
            value="rename_group"
            variant="outline"
            disabled={isRenaming}
          >
            <Spinner className={cn(!isRenaming && "hidden")} />
            Hernoemen
          </Button>
        </renameFetcher.Form>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Bedrijven in deze groep</h3>
            <p className="text-muted-foreground text-sm">
              Per bedrijf ziet u de periode waarin het deel uitmaakt van de groep. Dit zijn de
              datums van die periode, niet het moment waarop de wijziging is ingevoerd.
            </p>
          </div>
          {group.memberships.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Er zijn nog geen bedrijven aan deze groep toegevoegd.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {group.memberships.map((membership) => (
                <MembershipRow
                  key={`${membership.b_id_farm}-${membership.b_group_joined}`}
                  group={group}
                  membership={membership}
                  today={today}
                />
              ))}
            </ul>
          )}
          <AddFarmForm group={group} farms={farms} today={today} />
        </section>

        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive">
                <Trash2 className="size-4" />
                Verwijderen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Groep {group.b_name_group} verwijderen?</AlertDialogTitle>
                <AlertDialogDescription>
                  De groep wordt verwijderd, inclusief de perioden van de bedrijven. De bedrijven
                  zelf blijven bestaan. Dit kan niet worden teruggedraaid.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <deleteFetcher.Form method="post">
                  <input type="hidden" name="b_id_group" value={group.b_id_group} />
                  <AlertDialogAction type="submit" name="intent" value="delete_group">
                    Verwijderen
                  </AlertDialogAction>
                </deleteFetcher.Form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}

function MembershipRow({
  group,
  membership,
  today,
}: {
  group: GroupData
  membership: Membership
  today: string
}) {
  const fetcher = useFetcher<typeof action>()
  const isSubmitting = fetcher.state !== "idle"
  const status = getPeriodStatus(membership, today)
  const fieldId = `end-${group.b_id_group}-${membership.b_id_farm}-${membership.b_group_joined}`

  return (
    <li className="space-y-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grow truncate text-sm font-medium">
          {membership.b_name_farm ?? "Onbekend"}
        </span>
        <Badge variant={status.variant}>{status.label}</Badge>
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
          <input type="hidden" name="b_id_group" value={group.b_id_group} />
          <input type="hidden" name="b_id_farm" value={membership.b_id_farm} />
          <div className="space-y-1">
            <Label htmlFor={fieldId} className="text-xs">
              Maakt deel uit van de groep tot
            </Label>
            <Input id={fieldId} type="date" name="b_group_leaved" required className="w-44" />
          </div>
          <Button
            type="submit"
            name="intent"
            value="end_membership"
            variant="outline"
            disabled={isSubmitting}
          >
            <Spinner className={cn(!isSubmitting && "hidden")} />
            Einddatum opslaan
          </Button>
        </fetcher.Form>
      )}
    </li>
  )
}

function AddFarmForm({
  group,
  farms,
  today,
}: {
  group: GroupData
  farms: { b_id_farm: string; b_name_farm: string | null }[]
  today: string
}) {
  const fetcher = useFetcher<typeof action>()
  const isSubmitting = fetcher.state !== "idle"
  const idPrefix = `add-${group.b_id_group}`

  if (farms.length === 0) {
    return null
  }

  return (
    <fetcher.Form
      method="post"
      className="bg-muted/30 space-y-3 rounded-md border p-3"
      key={group.memberships.length}
    >
      <input type="hidden" name="b_id_group" value={group.b_id_group} />
      <p className="text-sm font-medium">Bedrijf toevoegen</p>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-farm`} className="text-xs">
          Bedrijf
        </Label>
        <Select name="b_id_farm" required>
          <SelectTrigger id={`${idPrefix}-farm`}>
            <SelectValue placeholder="Kies een bedrijf" />
          </SelectTrigger>
          <SelectContent>
            {farms.map((farm) => (
              <SelectItem key={farm.b_id_farm} value={farm.b_id_farm}>
                {farm.b_name_farm ?? "Onbekend"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-joined`} className="text-xs">
            Maakt deel uit van de groep vanaf
          </Label>
          <Input
            id={`${idPrefix}-joined`}
            type="date"
            name="b_group_joined"
            defaultValue={today}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-leaved`} className="text-xs">
            Tot (laat leeg als er geen einddatum is)
          </Label>
          <Input id={`${idPrefix}-leaved`} type="date" name="b_group_leaved" />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        De datums gaan over de periode waarin het bedrijf deel uitmaakt van de groep. Het maakt niet
        uit wanneer u dit invoert; de periode mag ook in het verleden of de toekomst liggen.
      </p>
      <Button type="submit" name="intent" value="add_farm" disabled={isSubmitting}>
        <Spinner className={cn(!isSubmitting && "hidden")} />
        Toevoegen
      </Button>
    </fetcher.Form>
  )
}
