import { cowHead } from "@lucide/lab"
import {
  checkPermission,
  getCultivationsForFarm,
  getFarm,
  getFarms,
  getFields,
} from "@nmi-agro/fdm-core"
import {
  AlertTriangle,
  ArrowRightLeft,
  BookOpenText,
  ChevronDown,
  ChevronUp,
  CloudDownload,
  CloudUpload,
  DownloadIcon,
  FileStack,
  Home,
  Icon,
  Landmark,
  Loader2,
  MapIcon,
  PlusIcon,
  ScrollText,
  Shapes,
  Sprout,
  Square,
  Trash2,
  UserRoundCheck,
} from "lucide-react"
import { useState } from "react"
import {
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
} from "react-router"
import { toast } from "sonner"
import { CultivationSuggestionStatusBanner } from "~/components/blocks/cultivation/suggestion"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
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
import { getNmiApiKey } from "~/integrations/nmi.server"
import { getRvoCredentials } from "~/integrations/rvo.server"
import { getSession } from "~/lib/auth.server"
import { getCalendarSelection } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { getCultivationSuggestionResult } from "~/lib/cultivation-suggestion.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getMainCultivation } from "~/lib/hoofdteelt.server"
import { cn } from "~/lib/utils"
import { useCalendarStore } from "~/store/calendar"

// Cap on simultaneous cultivation-suggestion lookups per farm, so farms with many fields
// missing a main cultivation don't overload the external NMI API with unbounded parallel
// requests (same concurrency-limiting approach as the nutrient advice overview loader).
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
export async function loader({ request, params }: LoaderFunctionArgs) {
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

    // Get the farm details
    const farm = await getFarm(fdm, session.principal_id, b_id_farm)

    // Get the list of fields
    const fields = await getFields(fdm, session.principal_id, b_id_farm)

    // Calculate total area for this farm
    const farmArea = fields.reduce((acc, field) => acc + (field.b_area ?? 0), 0)

    // Fields without a registered main cultivation ("hoofdteelt") for the active year are a data-completeness
    // signal worth surfacing. The active year follows the same calendar selection driving the rest of the
    // dashboard: an optional "calendar" search param (set when navigating here from a calendar-scoped page),
    // falling back to the current year. The resolved year is also returned so the NavLink target stays aligned
    // with the count.
    const activeYear =
      new URL(request.url).searchParams.get("calendar") ?? new Date().getFullYear().toString()
    const cultivationsByField = await getCultivationsForFarm(fdm, session.principal_id, b_id_farm, {
      start: new Date(`${activeYear}-01-01T00:00:00.000Z`),
      end: new Date(`${activeYear}-12-31T23:59:59.999Z`),
    })
    const fieldsMissingCultivation = fields.filter(
      (field) => !getMainCultivation(cultivationsByField.get(field.b_id) ?? [], activeYear),
    )

    // For fields missing a main cultivation, look up an NMI-estimate-based suggestion (BRP guess)
    // so the user can accept it instead of searching for the crop from scratch. Silently omitted
    // (never blocks the dashboard) when no NMI API key is configured or no estimate is available.
    // Looked up in small concurrency-limited batches so a farm with many affected fields doesn't
    // fire unbounded parallel requests at the external NMI API.
    const nmiApiKey = getNmiApiKey()
    const fieldsMissingCultivationDetails: {
      b_id: string
      b_name: string
      result: Awaited<ReturnType<typeof getCultivationSuggestionResult>>
    }[] = []
    for (const fieldsChunk of chunk(fieldsMissingCultivation, CULTIVATION_SUGGESTION_CONCURRENCY)) {
      const chunkResults = await Promise.all(
        fieldsChunk.map(async (field) => ({
          b_id: field.b_id,
          b_name: field.b_name,
          result: await getCultivationSuggestionResult(
            fdm,
            session.principal_id,
            b_id_farm,
            field.b_id,
            activeYear,
            nmiApiKey,
          ),
        })),
      )
      fieldsMissingCultivationDetails.push(...chunkResults)
    }

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
      new URL(request.url).pathname,
      false,
    )

    const rvoCredentials = getRvoCredentials()
    const isRvoConfigured = rvoCredentials !== undefined

    // Return the farm ID and session info
    return {
      b_id_farm: b_id_farm,
      b_name_farm: farm.b_name_farm,
      fieldsNumber: fields.length,
      farmArea: Math.round(farmArea),
      fieldsMissingCultivation: fieldsMissingCultivation.length,
      fieldsMissingCultivationDetails,
      cultivationYear: activeYear,
      farmOptions: farmOptions,
      roles: roles,
      farmWritePermission,
      isRvoConfigured,
    }
  } catch (error) {
    throw handleLoaderError(error)
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
  const years = getCalendarSelection()
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [showMissingCultivationDetails, setShowMissingCultivationDetails] = useState(false)

  const handleDownloadPdf = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (isGeneratingPdf) return

    setIsGeneratingPdf(true)
    toast.info("Bemestingsplan wordt gegenereerd", {
      description: "Dit kan enkele seconden duren...",
    })

    try {
      const response = await fetch(`/farm/${loaderData.b_id_farm}/${calendar}/bemestingsplan.pdf`)
      if (!response.ok) throw new Error("Download failed")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Bemestingsplan_${loaderData.b_name_farm}_${calendar}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("Download voltooid")
    } catch (error) {
      console.error(error)
      toast.error("Er ging iets mis bij het genereren van de PDF")
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  return (
    <SidebarInset>
      <Header
        action={{
          to: "/",
          label: "Naar overzicht bedrijven",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={loaderData.b_id_farm} farmOptions={loaderData.farmOptions} />
      </Header>
      <main>
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
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <NavLink to={`${calendar}/field`}>
                    <Card className="transition-all hover:shadow-md">
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
                    <Card className="transition-all hover:shadow-md">
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
                  <Card
                    className={cn(
                      "h-full transition-all",
                      isGeneratingPdf ? "opacity-60" : "hover:shadow-md",
                    )}
                  >
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={isGeneratingPdf}
                      aria-busy={isGeneratingPdf}
                      className="focus-visible:ring-ring w-full cursor-pointer rounded-xl text-left outline-hidden focus-visible:ring-[3px] disabled:cursor-not-allowed"
                    >
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="bg-muted rounded-lg p-3">
                            {isGeneratingPdf ? (
                              <Loader2 className="text-primary h-6 w-6 animate-spin" />
                            ) : (
                              <DownloadIcon className="text-primary h-6 w-6" />
                            )}
                          </div>
                          <div>
                            <CardTitle>Download bemestingsplan</CardTitle>
                            <CardDescription>
                              pdf met gebruiksruimte en bemestingsadvies op bedrijfs- en
                              perceelsniveau.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </button>
                  </Card>
                </div>
              </div>

              {/* Acties - secondary/occasional tasks, demoted to a compact list */}
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">Acties</h2>
                <Card>
                  <CardContent className="divide-border divide-y p-0">
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
                  <CardContent className="space-y-4 pt-6">
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
                    {loaderData.fieldsMissingCultivation > 0 && (
                      <div className="border-destructive/30 bg-destructive/5 rounded-lg border">
                        <button
                          type="button"
                          onClick={() => setShowMissingCultivationDetails((prev) => !prev)}
                          className="hover:bg-destructive/10 flex w-full items-start gap-2 rounded-t-lg p-3 text-left transition-colors"
                        >
                          <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
                          <p className="flex-1 text-sm">
                            <span className="font-medium">
                              {loaderData.fieldsMissingCultivation}{" "}
                              {loaderData.fieldsMissingCultivation === 1
                                ? "perceel mist"
                                : "percelen missen"}
                            </span>{" "}
                            een hoofdteelt voor dit jaar.
                          </p>
                          {showMissingCultivationDetails ? (
                            <ChevronUp className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronDown className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
                          )}
                        </button>
                        <NavLink
                          to={`${loaderData.cultivationYear}/field`}
                          className="text-muted-foreground hover:text-foreground block px-3 pb-3 text-sm underline"
                        >
                          Bekijk de percelen om dit aan te vullen
                        </NavLink>
                        {showMissingCultivationDetails && (
                          <div className="space-y-2 border-t p-3">
                            {loaderData.fieldsMissingCultivationDetails.map((field) => (
                              <div key={field.b_id} className="space-y-1">
                                <CultivationSuggestionStatusBanner
                                  b_id_farm={loaderData.b_id_farm}
                                  calendar={loaderData.cultivationYear}
                                  b_id={field.b_id}
                                  b_name={field.b_name}
                                  result={field.result}
                                />
                                {field.result.status !== "suggested" && (
                                  <NavLink
                                    to={`${loaderData.cultivationYear}/field/${field.b_id}/cultivation`}
                                    className="text-muted-foreground hover:text-foreground block text-sm underline"
                                  >
                                    {field.b_name}: hoofdteelt handmatig toevoegen
                                  </NavLink>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
                  </CardContent>
                </Card>
              </div>

              {/* Settings */}
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">Gegevens</h2>
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-1">
                      <Button variant="ghost" className="w-full justify-start" asChild>
                        <NavLink to="settings">
                          <Home className="mr-2 h-4 w-4" />
                          Bedrijf
                        </NavLink>
                      </Button>
                      <Button variant="ghost" className="w-full justify-start" asChild>
                        <NavLink to="fertilizers">
                          <Shapes className="mr-2 h-4 w-4" />
                          Meststoffen
                        </NavLink>
                      </Button>
                      <Button variant="ghost" className="w-full justify-start" asChild>
                        <NavLink to="settings/derogation">
                          <ChevronUp className="mr-2 h-4 w-4" />
                          Derogatie
                        </NavLink>
                      </Button>
                      <Button variant="ghost" className="w-full justify-start" asChild>
                        <NavLink to="settings/organic-certification">
                          <ScrollText className="mr-2 h-4 w-4" />
                          Bio-certificaat
                        </NavLink>
                      </Button>
                      <Button variant="ghost" className="w-full justify-start" asChild>
                        <NavLink to="settings/grazing-intention">
                          <Icon iconNode={cowHead} className="mr-2 h-4 w-4" />
                          Beweiding
                        </NavLink>
                      </Button>
                      <Button variant="ghost" className="w-full justify-start" asChild>
                        <NavLink to="settings/access">
                          <UserRoundCheck className="mr-2 h-4 w-4" />
                          Toegang
                        </NavLink>
                      </Button>
                    </div>
                    <Separator className="my-3" />
                    <Button
                      variant="ghost"
                      className="hover:text-destructive hover:bg-destructive/10 w-full justify-start"
                      asChild
                    >
                      <NavLink to="settings/delete">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Verwijderen
                      </NavLink>
                    </Button>
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
