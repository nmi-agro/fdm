import { cowHead } from "@lucide/lab"
import {
  addCultivation,
  checkPermission,
  getCultivationsForFarm,
  getFarm,
  getFarms,
  getFields,
} from "@nmi-agro/fdm-core"
import { cn } from "cn"
import {
  AlertTriangle,
  ArrowRightLeft,
  // FARM_VERIFICATION_HIDDEN: re-enable when farmers can verify their own farm
  // BadgeAlert,
  // BadgeCheck,
  BookOpenText,
  ChevronUp,
  CloudDownload,
  CloudUpload,
  File,
  FileStack,
  Home,
  Icon,
  Landmark,
  MapIcon,
  PlusIcon,
  ScrollText,
  Shapes,
  Sprout,
  Square,
  Trash2,
  UserRoundCheck,
} from "lucide-react"
import { Suspense, useEffect, useRef } from "react"
import {
  type ActionFunctionArgs,
  Await,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  redirect,
  useLoaderData,
  useSearchParams,
} from "react-router"
import { dataWithSuccess } from "remix-toast"
import type { HelpHandle } from "~/lib/manual/help-targets"
import {
  CultivationAssistant,
  type FieldCultivationSuggestion,
} from "~/components/blocks/cultivation/assistant"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
// FARM_VERIFICATION_HIDDEN: re-enable when farmers can verify their own farm
// import { FarmVerificationInfo } from "~/components/blocks/farm/farm-verification-info"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { PageContainer } from "~/components/custom/page-container"
import { buttonVariants } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import { useFarmWarmup } from "~/hooks/use-farm-warmup"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { getRvoCredentials } from "~/integrations/rvo.server"
import { captureEvent } from "~/lib/analytics.server"
import { getSession } from "~/lib/auth.server"
import { getCalendarSelection, getTimeframe, isSupportedYear } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { getCultivationSuggestionResultsForFarm } from "~/lib/cultivation-suggestion.server"
import { handleActionError, handleLoaderError, isToastResponse } from "~/lib/error"
// FARM_VERIFICATION_HIDDEN: re-enable when farmers can verify their own farm
// import { getFarmVerificationStatus } from "~/lib/farm-verification.server"
import { fdm } from "~/lib/fdm.server"
import { farmTodayKey } from "~/lib/grazing-dates"
import { getMainCultivation } from "~/lib/hoofdteelt.server"
import { serverNow } from "~/lib/server-now.server"
import { useCalendarStore } from "~/store/calendar"

// Cap on simultaneous cultivation-suggestion lookups per farm, so farms with many fields
// missing a main cultivation don't overload the external NMI API with unbounded parallel
// requests (same concurrency-limiting approach as the nutrient advice overview loader). Also
// caps the cultivations that are added at the same time when suggestions are accepted.
const CULTIVATION_SUGGESTION_CONCURRENCY = 4

/** Splits an array into consecutive chunks of at most `size` items each. */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

// Meta

export const handle: HelpHandle = { help: "dashboard" }

export const meta: MetaFunction = () => {
  return [
    { title: `Bedrijf | ${clientConfig.name}` },
    {
      name: "description",
      content: "Bekijk en bewerk de gegevens van je bedrijf.",
    },
  ]
}

/**
 * Processes a request to retrieve a farm's session details.
 *
 * This function extracts the farm ID from the route parameters and throws an error with a 400 status
 * if the ID is missing. When a valid farm ID is provided, it retrieves the session associated with the
 * incoming request and returns an object containing both the farm ID and the session information.
 *
 * @returns An object with "farmId" and "session" properties.
 *
 * @throws {Response} If the farm ID is not provided.
 */
export async function loader({ request, params, url }: LoaderFunctionArgs) {
  try {
    // Get the farm id
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", {
        status: 400,
        statusText: "Farm ID is required",
      })
    }

    // Get the session
    const session = await getSession(request)

    // Fields without a registered main cultivation ("hoofdteelt") for the active year are a data-completeness
    // signal worth surfacing. The active year follows the same calendar selection driving the rest of the
    // dashboard: an optional "calendar" search param (set when navigating here from a calendar-scoped page),
    // falling back to the current year. The resolved year is also returned so the NavLink target stays aligned
    // with the count.
    let activeYear = new Date().getFullYear().toString()
    const calendarParam = url.searchParams.get("calendar")
    if (calendarParam) {
      const year = Number(calendarParam)
      if (isSupportedYear(year)) {
        activeYear = calendarParam
      } else {
        const searchParams = new URLSearchParams(url.searchParams)
        searchParams.set("calendar", activeYear)
        return redirect(`/farm/${b_id_farm}?${searchParams.toString()}`)
      }
    }

    const timeframe = getTimeframe({ calendar: activeYear })

    // Get the farm details
    const farm = await getFarm(fdm, session.principal_id, b_id_farm)

    // Get the list of fields
    const fields = await getFields(fdm, session.principal_id, b_id_farm, timeframe)

    // Calculate total area for this farm
    const farmArea = fields.reduce((acc, field) => acc + (field.b_area ?? 0), 0)

    const cultivationsByField = await getCultivationsForFarm(
      fdm,
      session.principal_id,
      b_id_farm,
      timeframe,
    )

    const fieldsMissingCultivation = fields.filter(
      (field) => !getMainCultivation(cultivationsByField.get(field.b_id) ?? [], activeYear),
    )

    // For fields missing a main cultivation, look up an NMI-estimate-based suggestion (BRP guess)
    // so the user can accept it instead of searching for the crop from scratch. Silently omitted
    // when no NMI API key is configured or no estimate is available. The database is read once
    // for the farm and the NMI API gets a limited number of requests at the same time. Not
    // awaited, so the dashboard renders without waiting for the NMI API.
    const fieldsMissingCultivationDetails: Promise<FieldCultivationSuggestion[]> =
      getCultivationSuggestionResultsForFarm(
        fdm,
        session.principal_id,
        b_id_farm,
        fieldsMissingCultivation.map((field) => field.b_id),
        activeYear,
        getNmiApiKey(),
        { concurrency: CULTIVATION_SUGGESTION_CONCURRENCY },
      ).then((results) =>
        fieldsMissingCultivation.map((field) => ({
          b_id: field.b_id,
          b_name: field.b_name,
          result: results.get(field.b_id) ?? { status: "unavailable" },
        })),
      )

    // Get a list of possible farms of the user
    const farms = await getFarms(fdm, session.principal_id)
    const farmOptions = farms.map((farm) => {
      return {
        b_id_farm: farm.b_id_farm,
        b_name_farm: farm.b_name_farm,
      }
    })

    // Find unique roles
    const roles = [...new Set(farm.roles.map((role) => role.role))]

    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      url.pathname,
      false,
    )
    // FARM_VERIFICATION_HIDDEN: re-enable when farmers can verify their own farm
    // const farmVerification = await getFarmVerificationStatus(fdm, session.principal_id, b_id_farm)

    // Whether the farm has ever had a herd, as in the sidebar
    const hasHerds = farm.b_farm_livestock

    const rvoCredentials = getRvoCredentials()
    const isRvoConfigured = rvoCredentials !== undefined

    // Return the farm ID and session info
    return {
      b_id_farm: b_id_farm,
      b_name_farm: farm.b_name_farm,
      activeYear: activeYear,
      fieldsNumber: fields.length,
      farmArea: Math.round(farmArea),
      fieldsMissingCultivation: fieldsMissingCultivation.length,
      fieldsMissingCultivationDetails,
      cultivationYear: activeYear,
      farmOptions: farmOptions,
      roles: roles,
      farmWritePermission,
      // FARM_VERIFICATION_HIDDEN: re-enable when farmers can verify their own farm
      // farmVerification,
      isRvoConfigured,
      hasHerds,
      // Today's grazing is always in the current year in the Netherlands, whatever year is
      // selected
      grazingYear: farmTodayKey(serverNow()).slice(0, 4),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Handles action requests for the farm dashboard, such as batch-accepting BRP cultivation suggestions in a single step.
 */
export async function action({ request, params, url }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
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
      url.pathname,
      false,
    )
    if (!farmWritePermission) {
      throw data("U heeft geen schrijfrechten op dit bedrijf.", { status: 403 })
    }

    const formData = await request.formData()
    const intent = formData.get("intent")

    if (intent === "accept_all_suggestions") {
      let activeYear = new Date().getFullYear().toString()
      const calendarValue = formData.get("calendar")
      if (typeof calendarValue === "string") {
        const year = Number(calendarValue)
        if (isSupportedYear(year)) {
          activeYear = calendarValue
        }
      }
      const timeframe = getTimeframe({ calendar: activeYear })

      const selectedBIds = formData.getAll("selected_b_id").map(String)
      if (selectedBIds.length === 0) {
        throw data("Geen percelen geselecteerd.", { status: 400 })
      }

      // Fetch fields and cultivations for the farm
      const [fields, cultivationsByField] = await Promise.all([
        getFields(fdm, session.principal_id, b_id_farm, timeframe),
        getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
      ])

      const fieldsMissingCultivation = fields
        .filter((field) => selectedBIds.includes(field.b_id))
        .filter(
          (field) => !getMainCultivation(cultivationsByField.get(field.b_id) ?? [], activeYear),
        )

      // The suggestions of all selected fields, with one database read for the farm and a limited
      // number of NMI API requests at the same time
      const suggestions = await getCultivationSuggestionResultsForFarm(
        fdm,
        session.principal_id,
        b_id_farm,
        fieldsMissingCultivation.map((field) => field.b_id),
        activeYear,
        getNmiApiKey(),
        { concurrency: CULTIVATION_SUGGESTION_CONCURRENCY },
      )
      const suggestedFields = fieldsMissingCultivation.flatMap((field) => {
        const result = suggestions.get(field.b_id)
        return result?.status === "suggested" ? [{ b_id: field.b_id, ...result.suggestion }] : []
      })

      let acceptedCount = 0
      let failedCount = 0

      for (const fieldsChunk of chunk(suggestedFields, CULTIVATION_SUGGESTION_CONCURRENCY)) {
        const results = await Promise.allSettled(
          fieldsChunk.map(async (suggestion) => {
            await addCultivation(
              fdm,
              session.principal_id,
              suggestion.b_lu_catalogue,
              suggestion.b_id,
              suggestion.b_lu_start,
              suggestion.b_lu_end,
            )

            captureEvent(session.principal_id, "cultivation_added", {
              b_id_farm,
              b_id: suggestion.b_id,
              b_lu_catalogue: suggestion.b_lu_catalogue,
              calendar: activeYear,
              source: "batch_brp_suggestion",
            })
          }),
        )

        for (const res of results) {
          if (res.status === "fulfilled") {
            acceptedCount++
          } else {
            failedCount++
          }
        }
      }

      let message: string
      if (failedCount > 0) {
        if (acceptedCount > 0) {
          message = `${acceptedCount} ${acceptedCount === 1 ? "hoofdteelt" : "hoofdteelten"} toegevoegd, ${failedCount} ${failedCount === 1 ? "perceel" : "percelen"} mislukt.`
        } else {
          message = `Het toevoegen van BRP-hoofdteelten is mislukt voor ${failedCount} ${failedCount === 1 ? "perceel" : "percelen"}.`
        }
      } else {
        if (acceptedCount > 0) {
          message = `${acceptedCount} ${acceptedCount === 1 ? "hoofdteelt" : "hoofdteelten"} succesvol toegevoegd! 🎉`
        } else {
          message = "Geen BRP-voorstellen beschikbaar om toe te voegen."
        }
      }

      return dataWithSuccess({ acceptedCount, failedCount }, { message })
    }

    throw data("Ongeldige actie", { status: 400 })
  } catch (error) {
    // extractFormValuesFromRequest already turned validation errors into a toast response
    if (isToastResponse(error)) return error
    return handleActionError(error)
  }
}

/**
 * A disabled-aware NavLink for the "Acties" list: shows an icon, title and description, and swaps
 * in `disabledDescription` (with a warning icon) plus disables navigation when `disabled` is true.
 */
function ActionLink({
  to,
  icon,
  title,
  description,
  disabledDescription,
  disabled,
}: {
  to: string
  icon: React.ReactNode
  title: string
  description: string
  disabledDescription: string
  disabled: boolean
}) {
  return (
    <NavLink
      to={to}
      className={cn(
        "hover:bg-accent flex items-center gap-4 p-4 transition-colors first:rounded-t-xl last:rounded-b-xl",
        disabled && "pointer-events-none",
      )}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
    >
      <div className={cn("bg-muted shrink-0 rounded-lg p-2.5", disabled && "opacity-50")}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={cn("text-sm font-medium", disabled && "text-muted-foreground")}>{title}</p>
        {disabled ? (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {disabledDescription}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
      </div>
    </NavLink>
  )
}

export default function FarmDashboardIndex() {
  const loaderData = useLoaderData<typeof loader>()

  const calendar = useCalendarStore((state) => state.calendar)
  const setCalendar = useCalendarStore((state) => state.setCalendar)
  const [searchParams, setSearchParams] = useSearchParams()

  // Fill the calculation cache in the background, so the calculation pages open faster. Only for
  // the year that stays: without a year in the URL, the page first switches to the selected year.
  useFarmWarmup(
    loaderData.b_id_farm,
    loaderData.activeYear,
    loaderData.fieldsNumber > 0 &&
      (searchParams.get("calendar") === loaderData.activeYear ||
        calendar === loaderData.activeYear),
  )
  const years = getCalendarSelection()

  const lastRedirectedCalendarVal = useRef(loaderData.activeYear)
  const pendingCalendarVal = useRef<string | null>(null)
  // Set the selected calendar year to what is sent from the server
  useEffect(() => {
    if (searchParams.get("calendar") === loaderData.activeYear) {
      pendingCalendarVal.current = loaderData.activeYear
      setCalendar(loaderData.activeYear)
    }
  }, [loaderData.activeYear, searchParams, setCalendar])

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
      loaderData.activeYear !== calendar
    ) {
      setSearchParams({ ...Object.fromEntries(searchParams.entries()), calendar: calendar })
      lastRedirectedCalendarVal.current = calendar
    }
  }, [loaderData.activeYear, searchParams, setSearchParams, calendar, setCalendar])

  return (
    <PageContainer>
      <Header
        action={{
          to: "/",
          label: "Naar overzicht bedrijven",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={loaderData.b_id_farm} farmOptions={loaderData.farmOptions} />
      </Header>
      <div>
        <FarmTitle
          title={`${loaderData.b_name_farm}`}
          description={"Een overzicht van de bedrijfsgegevens en applicaties."}
        />
        <FarmContent>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left Column */}
            <div className="space-y-8 lg:col-span-2">
              {/* Quick Actions - primary, most-used destinations get the most visual weight */}
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">Overzichten</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <NavLink to={`${calendar}/field`}>
                    <Card className="h-full transition-all hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="bg-primary text-primary-foreground rounded-lg p-3.5">
                            <Square className="h-7 w-7" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Percelen</CardTitle>
                            <CardDescription>
                              Uitgebreide tabel met o.a. gewassen en gebruikte meststoffen per
                              perceel.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </NavLink>
                  <NavLink to={`${calendar}/rotation`}>
                    <Card className="h-full transition-all hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="bg-primary text-primary-foreground rounded-lg p-3.5">
                            <Sprout className="h-7 w-7" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Bouwplan</CardTitle>
                            <CardDescription>
                              Uitgebreide tabel met o.a. zaaidata, oogstdata en gebruikte
                              meststoffen per gewas.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </NavLink>
                  {loaderData.hasHerds && (
                    <NavLink to={`${calendar}/livestock/grazing`}>
                      <Card className="h-full transition-all hover:shadow-md">
                        <CardHeader>
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="bg-primary text-primary-foreground shrink-0 rounded-lg p-3.5">
                              <Icon iconNode={cowHead} className="h-7 w-7" />
                            </div>
                            {/* A soft hyphen breaks the long title as Beweidings-kalender in a
                                narrow card; browsers lack a Dutch hyphenation dictionary */}
                            <div className="min-w-0">
                              <CardTitle className="text-lg">Beweidings&shy;kalender</CardTitle>
                              <CardDescription>
                                Beweiding, maaien en bemesting per perceel, dag voor dag.
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    </NavLink>
                  )}
                </div>
              </div>

              {/* Apps */}
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">Apps</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <NavLink to={`${calendar}/atlas`}>
                    <Card className="h-full transition-all hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="bg-muted rounded-lg p-3">
                            <MapIcon className="text-primary h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle>Atlas</CardTitle>
                            <CardDescription>Gewaspercelen op de kaart.</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </NavLink>
                  <NavLink to={`${calendar}/balance/nitrogen`}>
                    <Card className="h-full transition-all hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="bg-muted rounded-lg p-3">
                            <ArrowRightLeft className="text-primary h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle>Stikstofbalans</CardTitle>
                            <CardDescription>
                              Aanvoer, afvoer en emissie van stikstof.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </NavLink>
                  <NavLink to={`${calendar}/balance/organic-matter`}>
                    <Card className="h-full transition-all hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="bg-muted rounded-lg p-3">
                            <ArrowRightLeft className="text-primary h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle>OS Balans</CardTitle>
                            <CardDescription>
                              Aanvoer en afbraak van organische stof.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </NavLink>

                  <NavLink to={`${calendar}/nutrient_advice`}>
                    <Card className="h-full transition-all hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="bg-muted rounded-lg p-3">
                            <BookOpenText className="text-primary h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle>Bemestingsadvies</CardTitle>
                            <CardDescription>
                              Volgens Handboek Bodem en Bemesting en Adviesbasis Bemesting.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </NavLink>
                  <NavLink to={`${calendar}/norms`}>
                    <Card className="h-full transition-all hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="bg-muted rounded-lg p-3">
                            <Landmark className="text-primary h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle>Gebruiksruimte</CardTitle>
                            <CardDescription>
                              Normen op bedrijfs- en perceelsniveau.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </NavLink>
                  <Card>
                    <NavLink
                      to="bemestingsplan"
                      className="focus-visible:ring-ring w-full cursor-pointer rounded-xl text-left outline-hidden focus-visible:ring-[3px] disabled:cursor-not-allowed"
                    >
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="bg-muted rounded-lg p-3">
                            <File />
                          </div>
                          <div>
                            <CardTitle>Bemestingsplan</CardTitle>
                            <CardDescription>
                              pdf's met gebruiksruimte en bemestingsadvies op bedrijfs- en
                              perceelsniveau.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </NavLink>
                  </Card>
                </div>
              </div>

              {/* Acties - secondary/occasional tasks, demoted to a compact list */}
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">Acties</h2>
                <Card className="py-0">
                  <CardContent className="divide-border divide-y p-0">
                    {loaderData.hasHerds && (
                      <ActionLink
                        to={`${loaderData.grazingYear}/atlas/grazing`}
                        icon={<Icon iconNode={cowHead} className="text-primary h-5 w-5" />}
                        title="Beweiding vandaag"
                        description="Leg vast op welk perceel de koppels vandaag weiden."
                        disabledDescription="U heeft geen schrijfrechten om beweiding vast te leggen."
                        disabled={!loaderData.farmWritePermission}
                      />
                    )}
                    <NavLink
                      to={"soil-analysis/bulk"}
                      className="hover:bg-accent flex items-center gap-4 p-4 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      <div className="bg-muted shrink-0 rounded-lg p-2.5">
                        <FileStack className="text-primary h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Upload bodemanalyses</p>
                        <p className="text-muted-foreground text-xs">
                          Upload meerdere pdf's met bodemanalyses en koppel ze aan percelen.
                        </p>
                      </div>
                    </NavLink>
                    {loaderData.isRvoConfigured && (
                      <ActionLink
                        to={`${calendar}/rvo`}
                        icon={<CloudDownload className="text-primary h-5 w-5" />}
                        title="Ophalen bij RVO"
                        // FARM_VERIFICATION_HIDDEN: re-enable when farmers can verify their own farm
                        // description="Importeer percelen vanuit RVO. Dit verifieert het bedrijf als het KvK-nummer overeenkomt."
                        description="Importeer percelen vanuit RVO."
                        disabledDescription="U heeft geen schrijfrechten om percelen te importeren."
                        disabled={!loaderData.farmWritePermission}
                      />
                    )}
                    <ActionLink
                      to={`/farm/${loaderData.b_id_farm}/${calendar}/upload`}
                      icon={<CloudUpload className="text-primary h-5 w-5" />}
                      title="RVO Shapefile uploaden"
                      description="Importeer nieuwe of bijgewerkte percelen door een shapefile van RVO Mijn Percelen te uploaden."
                      disabledDescription="U heeft geen schrijfrechten om een shapefile te uploaden."
                      disabled={!loaderData.farmWritePermission}
                    />
                    <NavLink
                      to={`${calendar}/field/new`}
                      className="hover:bg-accent flex items-center gap-4 p-4 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      <div className="bg-muted shrink-0 rounded-lg p-2.5">
                        <PlusIcon className="text-primary h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Nieuwe percelen</p>
                        <p className="text-muted-foreground text-xs">
                          Voeg nieuwe percelen toe aan dit bedrijf.
                        </p>
                      </div>
                    </NavLink>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Overview */}
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">Overzicht</h2>
                <Card>
                  <CardContent className="space-y-4">
                    {/* tiles */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/50 space-y-1 rounded-lg p-3">
                        <p className="text-muted-foreground text-xs">Percelen</p>
                        <p className="text-2xl font-bold">{loaderData.fieldsNumber}</p>
                      </div>
                      <div className="bg-muted/50 space-y-1 rounded-lg p-3">
                        <p className="text-muted-foreground text-xs">Oppervlakte</p>
                        <p className="text-2xl font-bold">
                          {loaderData.farmArea}
                          <span className="text-muted-foreground ml-1 text-sm font-normal">ha</span>
                        </p>
                      </div>
                    </div>
                    {/* FARM_VERIFICATION_HIDDEN: re-enable when farmers can verify their own farm
                    <div
                      className={cn(
                        "rounded-xl border p-3.5",
                        loaderData.farmVerification.isVerified
                          ? "border-green-600/30 bg-green-50/60 dark:bg-green-950/20"
                          : "border-border bg-muted/30",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {loaderData.farmVerification.isVerified ? (
                          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-700 dark:text-green-400" />
                        ) : (
                          <BadgeAlert className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-sm font-semibold">
                            {loaderData.farmVerification.isVerified
                              ? "Geverifieerd"
                              : "Dit bedrijf is nog niet geverifieerd"}
                            <FarmVerificationInfo />
                          </p>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {loaderData.farmVerification.latest
                              ? `Laatst geverifieerd door ${loaderData.farmVerification.latest.display_name}.`
                              : "Haal percelen op bij RVO met eHerkenning. Als het KvK-nummer overeenkomt, wordt dit bedrijf geverifieerd."}
                          </p>
                        </div>
                      </div>
                    </div>
                    */}
                    {loaderData.fieldsMissingCultivation > 0 && (
                      // The suggestions come from the NMI API; the dashboard does not wait for them
                      <Suspense
                        fallback={
                          <CultivationAssistant
                            b_id_farm={loaderData.b_id_farm}
                            cultivationYear={loaderData.cultivationYear}
                            fieldsMissingCultivation={loaderData.fieldsMissingCultivation}
                            fields={undefined}
                            canWrite={loaderData.farmWritePermission}
                          />
                        }
                      >
                        <Await resolve={loaderData.fieldsMissingCultivationDetails}>
                          {(fieldsMissingCultivationDetails) => (
                            <CultivationAssistant
                              b_id_farm={loaderData.b_id_farm}
                              cultivationYear={loaderData.cultivationYear}
                              fieldsMissingCultivation={loaderData.fieldsMissingCultivation}
                              fields={fieldsMissingCultivationDetails}
                              canWrite={loaderData.farmWritePermission}
                            />
                          )}
                        </Await>
                      </Suspense>
                    )}
                    <Separator />
                    {/* Role + Year */}
                    <div className="flex items-center justify-between">
                      <p className="text-muted-foreground text-sm">Rol</p>
                      <p className="text-sm font-medium">
                        {loaderData.roles.includes("owner")
                          ? "Eigenaar"
                          : loaderData.roles.includes("advisor")
                            ? "Adviseur"
                            : loaderData.roles.includes("researcher")
                              ? "Onderzoeker"
                              : loaderData.roles[0]}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-muted-foreground text-sm">Jaar</p>
                      <Select
                        value={calendar}
                        onValueChange={(value) => {
                          if (typeof value === "string") {
                            setCalendar(value)
                          }
                        }}
                      >
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
                  </CardContent>
                </Card>
              </div>

              {/* Settings */}
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">Gegevens</h2>
                <Card>
                  <CardContent>
                    <div className="space-y-1">
                      <NavLink
                        to="settings"
                        className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start")}
                      >
                        <Home className="mr-2 h-4 w-4" />
                        Bedrijf
                      </NavLink>
                      <NavLink
                        to="fertilizers"
                        className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start")}
                      >
                        <Shapes className="mr-2 h-4 w-4" />
                        Meststoffen
                      </NavLink>
                      <NavLink
                        to="settings/derogation"
                        className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start")}
                      >
                        <ChevronUp className="mr-2 h-4 w-4" />
                        Derogatie
                      </NavLink>
                      <NavLink
                        to="settings/organic-certification"
                        className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start")}
                      >
                        <ScrollText className="mr-2 h-4 w-4" />
                        Bio-certificaat
                      </NavLink>
                      <NavLink
                        to="settings/grazing-intention"
                        className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start")}
                      >
                        <Icon iconNode={cowHead} className="mr-2 h-4 w-4" />
                        Beweiding
                      </NavLink>
                      <NavLink
                        to="settings/access"
                        className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start")}
                      >
                        <UserRoundCheck className="mr-2 h-4 w-4" />
                        Toegang
                      </NavLink>
                    </div>
                    <Separator className="my-3" />
                    <NavLink
                      to="settings/delete"
                      className={cn(
                        buttonVariants({ variant: "ghost" }),
                        "hover:text-destructive hover:bg-destructive/10 w-full justify-start",
                      )}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Verwijderen
                    </NavLink>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </FarmContent>
      </div>
    </PageContainer>
  )
}
