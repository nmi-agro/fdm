import {
  addGrazing,
  checkPermission,
  getFarm,
  getFarms,
  removeGrazing,
  updateGrazing,
} from "@nmi-agro/fdm-core"
import { Compass, Plus, Sparkles, SquareArrowRightExit, Warehouse } from "lucide-react"
import { useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
} from "react-router"
import { dataWithSuccess } from "remix-toast"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { CalendarGrid } from "~/components/blocks/grazing/calendar-grid"
import { QuickEntrySheet } from "~/components/blocks/grazing/quick-entry-sheet"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { fetchGrazingCalendarMatrix } from "~/lib/grazing-calendar.server"

export const meta: MetaFunction = () => {
  return [
    { title: `Beweiding | ${clientConfig.name}` },
    {
      name: "description",
      content: "Beweidingskalender en graslandgebruik per perceel.",
    },
  ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const calendar = params.calendar ?? String(new Date().getFullYear())
    const calendarYear = parseInt(calendar, 10) || new Date().getFullYear()

    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)

    const [farm, farms, matrix] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
      getFarms(fdm, session.principal_id),
      fetchGrazingCalendarMatrix(session.principal_id, b_id_farm, calendarYear),
    ])

    const farmOptions = farms.map((f) => ({
      b_id_farm: f.b_id_farm,
      b_name_farm: f.b_name_farm,
    }))

    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      new URL(request.url).pathname,
      false,
    )

    return {
      b_id_farm,
      b_name_farm: farm.b_name_farm,
      calendar,
      farmOptions,
      matrix,
      openGrazings: matrix.openGrazings,
      farmWritePermission,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const calendar = params.calendar ?? String(new Date().getFullYear())
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)
    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      new URL(request.url).pathname,
      false,
    )
    if (!farmWritePermission) {
      throw data("U heeft geen schrijfrechten op dit bedrijf.", { status: 403 })
    }

    const formData = await request.formData()
    const intent = String(formData.get("intent") ?? "")

    if (intent === "add_grazing") {
      const b_id = String(formData.get("b_id") ?? "")
      const l_id_herd = String(formData.get("l_id_herd") ?? "")
      const l_grazing_start = new Date(String(formData.get("l_grazing_start")))
      const endVal = formData.get("l_grazing_end")
      const l_grazing_end = endVal ? new Date(String(endVal)) : undefined
      const hoursVal = formData.get("l_grazing_hours")
      const l_grazing_hours = hoursVal ? parseFloat(String(hoursVal)) : undefined
      const areaTypeVal = formData.get("l_grazing_type") as "full" | "partial" | null
      const areaVal = formData.get("l_grazing_area")
      const l_grazing_area = areaVal ? parseFloat(String(areaVal)) : undefined

      await addGrazing(fdm, session.principal_id, l_id_herd, l_grazing_start, {
        b_id: b_id || undefined,
        l_grazing_end,
        l_grazing_hours,
        l_grazing_type: areaTypeVal ?? "full",
        l_grazing_area,
      })

      return dataWithSuccess(
        {},
        {
          message: `Beweiding vastgelegd. Beweiding ${calendar} staat aan en telt mee voor de stikstofgebruiksnorm.`,
        },
      )
    }

    if (intent === "update_grazing") {
      const l_id_grazing = String(formData.get("l_id_grazing") ?? "")
      const startVal = formData.get("l_grazing_start")
      const endVal = formData.get("l_grazing_end")
      const hoursVal = formData.get("l_grazing_hours")
      const areaTypeVal = formData.get("l_grazing_type") as "full" | "partial" | null
      const areaVal = formData.get("l_grazing_area")

      await updateGrazing(fdm, session.principal_id, l_id_grazing, {
        l_grazing_start: startVal ? new Date(String(startVal)) : undefined,
        l_grazing_end: endVal ? new Date(String(endVal)) : undefined,
        l_grazing_hours: hoursVal ? parseFloat(String(hoursVal)) : undefined,
        l_grazing_type: areaTypeVal ?? undefined,
        l_grazing_area: areaVal ? parseFloat(String(areaVal)) : undefined,
      })

      return dataWithSuccess({}, { message: "Beweidingsregistratie bijgewerkt." })
    }

    if (intent === "remove_grazing") {
      const l_id_grazing = String(formData.get("l_id_grazing") ?? "")
      await removeGrazing(fdm, session.principal_id, l_id_grazing)
      return dataWithSuccess({}, { message: "Beweiding verwijderd." })
    }

    throw data("Ongeldige actie", { status: 400 })
  } catch (error) {
    return handleActionError(error)
  }
}

export default function BeweidingskalenderPage() {
  const { b_id_farm, calendar, farmOptions, matrix, openGrazings, farmWritePermission } =
    useLoaderData<typeof loader>()

  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false)

  const hasKoppels = matrix.herds.length > 0
  const hasGrassland = matrix.fields.length > 0

  return (
    <SidebarInset>
      <Header
        action={{
          to: `/farm/${b_id_farm}`,
          label: "Terug naar bedrijf",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbItem>Beweiding</BreadcrumbItem>
      </Header>

      <main>
        <FarmTitle
          title={`Beweiding ${calendar}`}
          description="Plan en registreer de beweiding en het graslandgebruik van je percelen."
          rightNode={
            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
                <NavLink to={`/farm/${b_id_farm}/${calendar}/grazing/plan`}>
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Graslandgebruiksysteem planner
                </NavLink>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
                <NavLink to={`/farm/${b_id_farm}/${calendar}/grazing/today`}>
                  <Compass className="h-3.5 w-3.5 text-primary" />
                  Vandaag op de kaart
                </NavLink>
              </Button>
              {farmWritePermission && (
                <Button
                  size="sm"
                  onClick={() => setIsQuickEntryOpen(true)}
                  disabled={!hasKoppels || !hasGrassland}
                  className="gap-1.5 text-xs font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Koeien naar buiten
                </Button>
              )}
            </div>
          }
        />

        <FarmContent>
          <div className="space-y-6">
            {!hasKoppels ? (
              <div className="rounded-xl border border-dashed p-12 text-center">
                <Warehouse className="text-muted-foreground mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-semibold">Nog geen melkvee aanwezig</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  Voeg je eerste koppel toe om te starten met de beweidingskalender.
                </p>
                <Button className="mt-6 gap-1.5" asChild>
                  <NavLink to={`/farm/${b_id_farm}/${calendar}/livestock/new`}>
                    <Plus className="h-4 w-4" />
                    Melkvee toevoegen
                  </NavLink>
                </Button>
              </div>
            ) : !hasGrassland ? (
              <div className="rounded-xl border border-dashed p-12 text-center">
                <SquareArrowRightExit className="text-muted-foreground mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-semibold">Geen graslandpercelen gevonden</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  Er zijn voor dit kalenderjaar geen percelen met graslandteelt geregistreerd in het bouwplan.
                </p>
                <Button className="mt-6 gap-1.5" asChild>
                  <NavLink to={`/farm/${b_id_farm}/${calendar}/rotation`}>
                    Naar Bouwplan
                  </NavLink>
                </Button>
              </div>
            ) : (
              <CalendarGrid
                matrix={matrix}
                b_id_farm={b_id_farm}
                calendar={calendar}
                canWrite={farmWritePermission}
              />
            )}
          </div>
        </FarmContent>
      </main>

      {/* Quick Entry Sheet */}
      <QuickEntrySheet
        open={isQuickEntryOpen}
        onOpenChange={setIsQuickEntryOpen}
        b_id_farm={b_id_farm}
        calendar={calendar}
        herds={matrix.herds}
        fields={matrix.fields}
        openGrazings={openGrazings}
        canWrite={farmWritePermission}
      />
    </SidebarInset>
  )
}

