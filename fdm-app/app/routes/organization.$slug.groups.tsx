import {
  createFarmGroup,
  getFarms,
  listFarmGroups,
  removeFarmFromGroup,
  removeFarmGroup,
  renameFarmGroup,
} from "@nmi-agro/fdm-core"
import { Trash2, X } from "lucide-react"
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
import { Spinner } from "~/components/ui/spinner"
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
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

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)
    const organization = await getOrganization(request, params.slug)

    const farms = await getFarms(fdm, organization.id)
    const farmNames = new Map(farms.map((farm) => [farm.b_id_farm, farm.b_name_farm]))
    const groups = await listFarmGroups(fdm, session.principal_id, organization.id)

    return {
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      groups: groups.map((group) => ({
        b_id_group: group.b_id_group,
        b_name_group: group.b_name_group,
        farms: group.b_id_farms
          .filter((b_id_farm) => farmNames.has(b_id_farm))
          .map((b_id_farm) => ({
            b_id_farm,
            b_name_farm: farmNames.get(b_id_farm) ?? null,
          })),
      })),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

const FormSchema = z.object({
  intent: z.enum(["create_group", "rename_group", "delete_group", "remove_farm"]),
  b_id_group: z.string().optional(),
  b_id_farm: z.string().optional(),
  b_name_group: z.string().trim().min(1, { error: "Geef de groep een naam" }).optional(),
})

/**
 * Translates validation and conflict errors of the farm group functions into a Dutch message.
 */
function getGroupErrorMessage(error: unknown): string | undefined {
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : ""
  if (cause.includes("already exists")) {
    return "Er bestaat al een groep met deze naam."
  }
  if (cause.includes("Name of the farm group is required")) {
    return "Geef de groep een naam."
  }
  return undefined
}

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const session = await getSession(request)
    const organization = await getOrganization(request, params.slug)

    const parsed = FormSchema.safeParse(Object.fromEntries(await request.formData()))
    if (!parsed.success) {
      return dataWithError(null, { message: parsed.error.issues[0]?.message ?? "Ongeldige invoer" })
    }
    const { intent, b_id_group, b_id_farm, b_name_group } = parsed.data

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
      if (intent === "remove_farm") {
        if (!b_id_farm) {
          throw data("missing: b_id_farm", { status: 400, statusText: "missing: b_id_farm" })
        }
        await removeFarmFromGroup(fdm, session.principal_id, b_id_group, b_id_farm)
        return dataWithSuccess(null, { message: "Het bedrijf is uit de groep gehaald." })
      }
    } catch (error) {
      const message = getGroupErrorMessage(error)
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
  const { organization, groups } = useLoaderData<typeof loader>()

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
          groups.map((group) => <GroupCard key={group.b_id_group} group={group} />)
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

type GroupData = {
  b_id_group: string
  b_name_group: string
  farms: { b_id_farm: string; b_name_farm: string | null }[]
}

function GroupCard({ group }: { group: GroupData }) {
  const renameFetcher = useFetcher<typeof action>()
  const deleteFetcher = useFetcher<typeof action>()
  const removeFetcher = useFetcher<typeof action>()
  const isRenaming = renameFetcher.state !== "idle"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {group.b_name_group}
          <Badge variant="secondary">
            {group.farms.length} {group.farms.length === 1 ? "bedrijf" : "bedrijven"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {group.farms.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Er zitten nog geen bedrijven in deze groep. Wijs bedrijven toe vanuit het
            bedrijvenoverzicht.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {group.farms.map((farm) => (
              <li key={farm.b_id_farm} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate text-sm">{farm.b_name_farm ?? "Onbekend"}</span>
                <removeFetcher.Form method="post">
                  <input type="hidden" name="b_id_group" value={group.b_id_group} />
                  <input type="hidden" name="b_id_farm" value={farm.b_id_farm} />
                  <Button
                    type="submit"
                    name="intent"
                    value="remove_farm"
                    variant="ghost"
                    size="icon"
                    aria-label={`${farm.b_name_farm ?? "Bedrijf"} uit de groep halen`}
                  >
                    <X className="size-4" />
                  </Button>
                </removeFetcher.Form>
              </li>
            ))}
          </ul>
        )}

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
                  De groep wordt verwijderd. De bedrijven zelf blijven bestaan. Dit kan niet worden
                  teruggedraaid.
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
