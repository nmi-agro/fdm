import {
  addHarvest,
  type Cultivation,
  getCultivations,
  getCultivationsFromCatalogue,
  getDefaultsForHarvestParameters,
  getFarms,
  getFields,
  getHarvests,
  getParametersForHarvestCat,
  removeHarvest,
} from "@nmi-agro/fdm-core"
import { AlertTriangle, Info } from "lucide-react"
import { useEffect, useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  redirect,
  useLoaderData,
  useLocation,
  useNavigation,
  useSearchParams,
} from "react-router"
import { dataWithError, dataWithWarning, redirectWithSuccess } from "remix-toast"
import { z } from "zod"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { BatchHarvestForm } from "~/components/blocks/harvest/batch-form"
import { HarvestForm } from "~/components/blocks/harvest/form"
import { getHarvestParameterLabel } from "~/components/blocks/harvest/parameters"
import { BatchFormSchema, FormSchema } from "~/components/blocks/harvest/schema"
import {
  getEffectiveHarvestable,
  getHarvestCapitalizedTerm,
  getHarvestTerm,
} from "~/components/blocks/harvest/utils"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { Badge } from "~/components/ui/badge"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { Label } from "~/components/ui/label"
import { SidebarInset } from "~/components/ui/sidebar"
import { Spinner } from "~/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { modifySearchParams } from "~/lib/url-utils"

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const term = getHarvestCapitalizedTerm(loaderData?.cultivation?.b_lu_croprotation)
  return [
    { title: `${term} toevoegen | ${clientConfig.name}` },
    {
      name: "description",
      content: "",
    },
  ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // Get the active farm
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("missing: b_id_farm", {
        status: 400,
        statusText: "missing: b_id_farm",
      })
    }

    // Get cultivationIds from search params
    const url = new URL(request.url)
    const cultivationIds = url.searchParams.get("cultivationIds")?.split(",").filter(Boolean) ?? []

    if (cultivationIds.length === 0) {
      throw data("missing: cultivationIds", {
        status: 400,
        statusText: "missing: cultivationIds",
      })
    }

    // Ensure only one cultivationId is selected
    if (cultivationIds.length !== 1) {
      throw data("invalid: cultivationIds", {
        status: 400,
        statusText: "Selecteer precies één gewas om oogst toe te voegen.",
      })
    }

    // Get the session
    const session = await getSession(request)

    // Get timeframe from calendar store
    const timeframe = getTimeframe(params)
    const calendar = getCalendar(params)

    // Get a list of possible farms of the user
    const farms = await getFarms(fdm, session.principal_id)

    // Redirect to farms overview if user has no farm
    if (farms.length === 0) {
      return redirect("./farm")
    }

    // Get farms to be selected
    const farmOptions = farms.map((farm) => {
      if (!farm?.b_id_farm || !farm?.b_name_farm) {
        throw new Error("Invalid farm data structure")
      }
      return {
        b_id_farm: farm.b_id_farm,
        b_name_farm: farm.b_name_farm,
      }
    })

    // Get all fields for the farm and their cultivations
    const allFieldsWithCultivations = await Promise.all(
      (await getFields(fdm, session.principal_id, b_id_farm, timeframe)).map(async (field) => {
        const cultivations = await getCultivations(fdm, session.principal_id, field.b_id, timeframe)
        return {
          ...field,
          cultivations: cultivations,
        }
      }),
    )

    // Get fieldIds from search params (if any)
    const fieldIdsFromSearchParams =
      url.searchParams.get("fieldIds")?.split(",").filter(Boolean) ?? null

    const cultivationCatalogueData = await getCultivationsFromCatalogue(
      fdm,
      session.principal_id,
      b_id_farm,
    )

    const targetCultivation = cultivationCatalogueData.find(
      (c) => c.b_lu_catalogue === cultivationIds[0],
    )

    if (!targetCultivation) {
      throw new Response(`Cultivation with ID ${cultivationIds[0]} not found.`, {
        status: 404,
        statusText: `Cultivation with ID ${cultivationIds[0]} not found.`,
      })
    }

    let selectedFieldsData = []
    if (fieldIdsFromSearchParams) {
      // If fieldIds are in search params, use them to determine selected fields
      selectedFieldsData =
        fieldIdsFromSearchParams.length > 0
          ? allFieldsWithCultivations.filter((field) =>
              fieldIdsFromSearchParams.includes(field.b_id),
            )
          : []
    } else {
      // Otherwise, default to fields with the selected cultivation
      selectedFieldsData = allFieldsWithCultivations.filter((field) =>
        field.cultivations.some((c) => cultivationIds.includes(c.b_lu_catalogue)),
      )
    }

    type HarvestApplication = Awaited<ReturnType<typeof getHarvests>>[number]

    const selectedFields = await Promise.all(
      selectedFieldsData.map(async (field) => {
        let harvestApplication: HarvestApplication | undefined
        let harvestableAnalysis: Partial<
          HarvestApplication["harvestable"]["harvestable_analyses"][number]
        > = {}
        let hasHarvest = false

        const targetFieldCultivation = field.cultivations.find(
          (c) => c.b_lu_catalogue === targetCultivation.b_lu_catalogue,
        )

        if (targetFieldCultivation) {
          const harvests = await getHarvests(fdm, session.principal_id, targetFieldCultivation.b_lu)
          if (harvests.length > 0) {
            harvestApplication = harvests[0]
            harvestableAnalysis = harvestApplication.harvestable?.harvestable_analyses[0] ?? {}
            hasHarvest =
              harvestableAnalysis.b_lu_yield !== undefined ||
              harvestableAnalysis.b_lu_n_harvestable !== undefined ||
              harvestApplication.b_lu_harvest_date !== undefined
          }
        }

        return {
          ...field,
          hasHarvest,
          harvestApplication,
          harvestableAnalysis,
        }
      }),
    )

    let firstFieldWithData: (typeof selectedFields)[number] | undefined
    if (targetCultivation.b_lu_harvestable === "once") {
      firstFieldWithData = selectedFields.find((f) => f.hasHarvest)
    }

    const harvestApplication: HarvestApplication | Partial<HarvestApplication> =
      firstFieldWithData?.harvestApplication ?? {
        b_lu_harvest_date: undefined,
      }

    let harvestableAnalysis: Partial<
      HarvestApplication["harvestable"]["harvestable_analyses"][number]
    > = firstFieldWithData?.harvestableAnalysis ?? {}

    // Apply defaults if no harvest data was found to pre-fill the form
    // This applies to both 'once' (if no existing harvest) and 'multiple' harvestable crops
    if (
      selectedFields.length > 0 && // Ensure fields are selected
      Object.keys(harvestableAnalysis).length === 0 // Check if harvestableAnalysis is still empty
    ) {
      harvestableAnalysis = getDefaultsForHarvestParameters(
        targetCultivation.b_lu_catalogue,
        cultivationCatalogueData,
      )
    }

    const b_lu_starts = selectedFields.map(
      (field) =>
        field.cultivations.find((cultivation) =>
          cultivationIds.includes(cultivation.b_lu_catalogue),
        )?.b_lu_start,
    )
    const b_lu_ends = selectedFields.map(
      (field) =>
        field.cultivations.find((cultivation) =>
          cultivationIds.includes(cultivation.b_lu_catalogue),
        )?.b_lu_end,
    )
    const b_lu_start = b_lu_starts.reduce(
      (max, date) => (max && date ? (max > date ? max : date) : max || date),
      undefined,
    )
    const b_lu_end = b_lu_ends.reduce(
      (min, date) => (min && date ? (min < date ? min : date) : min || date),
      undefined,
    )

    const fieldOptions = allFieldsWithCultivations.map((field) => {
      if (!field?.b_id || !field?.b_name) {
        throw new Error("Invalid field data structure")
      }
      return {
        b_id: field.b_id,
        b_name: field.b_name,
        b_area: Math.round((field.b_area ?? 0) * 10) / 10,
        cultivations: field.cultivations.map((c) => c.b_lu_catalogue), // Pass cultivations for each field
      }
    })

    const harvestParameters = getParametersForHarvestCat(targetCultivation.b_lu_harvestcat)
    const b_date_harvest_default =
      cultivationCatalogueData.find(
        (item) => item.b_lu_catalogue === targetCultivation.b_lu_catalogue,
      )?.b_date_harvest_default ?? null

    // Return user information from loader
    return {
      b_id_farm: b_id_farm,
      farmOptions: farmOptions,
      fieldAmount: selectedFields.length,
      calendar: calendar,
      selectedFields: selectedFields.map((field) => ({
        b_id: field.b_id,
        b_name: field.b_name,
        b_area: Math.round((field.b_area ?? 0) * 10) / 10,
        cultivations: field.cultivations.map((c: { b_lu_catalogue: string }) => c.b_lu_catalogue),
        hasHarvest: field.hasHarvest,
      })),
      fieldOptions: fieldOptions, // All fields for selection
      cultivation: targetCultivation,
      cultivationName: targetCultivation?.b_lu_name ?? "onbekend gewas",
      cultivationIds: cultivationIds,
      b_lu_harvestable: getEffectiveHarvestable(
        targetCultivation.b_lu_harvestable ?? "once",
        targetCultivation.b_lu_croprotation,
      ),
      harvestApplication: harvestApplication,
      harvestableAnalysis: harvestableAnalysis,
      harvestParameters: harvestParameters,
      b_lu_start: b_lu_start,
      b_lu_end: b_lu_end,
      b_date_harvest_default: b_date_harvest_default,
      create: url.searchParams.has("create"),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export default function FarmRotationHarvestAddIndex() {
  const loaderData = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>(
    loaderData.selectedFields.map((field) => field.b_id!),
  )
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false)

  useEffect(() => {
    setSelectedFieldIds(loaderData.selectedFields.map((field) => field.b_id!))
  }, [loaderData.selectedFields])

  const isSubmitting = navigation.state === "submitting" && Boolean(navigation.formData)

  const handleSelectionChange = () => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set("fieldIds", selectedFieldIds.join(","))
    newSearchParams.set("cultivationIds", loaderData.cultivationIds.join(","))
    setSearchParams(newSearchParams, { preventScrollReset: true })
  }

  const isSelected = (fieldId: string) => selectedFieldIds.includes(fieldId)

  const getTermSingular = getHarvestTerm(loaderData.cultivation.b_lu_croprotation)
  const getTermPlural = getHarvestTerm(loaderData.cultivation.b_lu_croprotation, true)
  const getCapitalizedTerm = getHarvestCapitalizedTerm(loaderData.cultivation.b_lu_croprotation)
  const getCapitalizedTermPlural = getHarvestCapitalizedTerm(
    loaderData.cultivation.b_lu_croprotation,
    true,
  )

  const toggleSelection = (fieldId: string) => {
    setSelectedFieldIds((prev) =>
      isSelected(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId],
    )
  }

  const displayedSelectedFields = loaderData.fieldOptions.filter((field) =>
    selectedFieldIds.includes(field.b_id!),
  )

  const isHarvestUpdate = loaderData.harvestApplication.b_lu_harvest_date
  const canBatchAdd = !isHarvestUpdate && loaderData.b_lu_harvestable === "multiple"
  const [isBatchAdd, setIsBatchAdd] = useState(false)

  // Switch back to the single harvest form if the conditions for batch harvest no longer hold
  useEffect(() => {
    if (!canBatchAdd && isBatchAdd) {
      setIsBatchAdd(false)
    }
  }, [canBatchAdd, isBatchAdd])

  function handleSelectionDialogOpenChange(open: boolean) {
    if (!open) {
      handleSelectionChange()
    }
    setOpen(open)
  }

  // Confirmation Handling
  const [resolveConfirmationPromise, setResolveConfirmationPromise] =
    useState<[(value: boolean) => void]>()
  const [confirmationPromise, setConfirmationPromise] = useState<Promise<boolean>>()

  function handleConfirmation() {
    if (loaderData.b_lu_harvestable === "multiple") {
      return Promise.resolve(true)
    }
    // Check if any of the currently selected fields already have a harvest.
    const hasExistingHarvest = loaderData.selectedFields
      .filter((field) => selectedFieldIds.includes(field.b_id!))
      .some((field) => field.hasHarvest)

    if (hasExistingHarvest) {
      return initiateConfirmation()
    }

    return Promise.resolve(true)
  }

  function initiateConfirmation() {
    if (!showOverwriteWarning) {
      setShowOverwriteWarning(true)
    }

    if (confirmationPromise) {
      return confirmationPromise
    }

    const myConfirmationPromise = new Promise<boolean>((resolve) =>
      setResolveConfirmationPromise([resolve]),
    )
    setConfirmationPromise(myConfirmationPromise)

    return myConfirmationPromise
  }

  function resolveConfirmation(response: boolean) {
    if (resolveConfirmationPromise) {
      resolveConfirmationPromise[0](response)
    }

    if (confirmationPromise) {
      setConfirmationPromise(undefined)
    }

    setShowOverwriteWarning(false)
  }

  const backlink = loaderData.create
    ? `/farm/create/${loaderData.b_id_farm}/${loaderData.calendar}/rotation`
    : `/farm/${loaderData.b_id_farm}/${loaderData.calendar}/rotation`
  return (
    <SidebarInset>
      <Header
        action={{
          to: backlink,
          label: "Terug naar bouwplan",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={loaderData.b_id_farm} farmOptions={loaderData.farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbItem className="hidden md:block">Bouwplan</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="hidden md:block">
          {isHarvestUpdate ? `${getCapitalizedTerm} bijwerken` : `${getCapitalizedTerm} toevoegen`}
        </BreadcrumbItem>
      </Header>
      <main>
        <FarmTitle
          title={
            isHarvestUpdate
              ? `${getCapitalizedTerm} bijwerken in ${loaderData.cultivationName}`
              : `${getCapitalizedTerm} toevoegen aan ${loaderData.cultivationName}`
          }
          description={
            isHarvestUpdate
              ? `Kies 1 of meerdere percelen om hun ${getTermPlural} bij te werken of te verwijderen`
              : `Kies 1 of meerdere percelen om een ${getTermSingular} toe te voegen`
          }
        />
        <div className="relative">
          {isSubmitting && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex items-center text-sm text-muted-foreground">
                <Spinner className="mr-2" />
                <span>{getCapitalizedTerm} wordt toegevoegd...</span>
              </div>
            </div>
          )}
          <FarmContent>
            <div className="flex flex-col space-y-8 pb-10 md:flex-row md:space-x-12 md:space-y-0">
              <Card className="md:w-1/3">
                <CardHeader>
                  <CardTitle>Geselecteerde percelen</CardTitle>
                  <CardDescription>
                    De {getTermSingular} wordt toegepast op de volgende percelen.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {displayedSelectedFields.length > 0 ? (
                    <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                      {displayedSelectedFields.map((field) => (
                        <div
                          key={field.b_id}
                          className="flex items-center justify-between rounded-md border p-3"
                        >
                          <p className="text-sm font-medium">{field.b_name}</p>
                          <div className="flex gap-2 items-center">
                            {!field.cultivations.some((c) =>
                              loaderData.cultivationIds.includes(c),
                            ) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Dit perceel heeft het geselecteerde gewas niet</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <Badge variant="secondary">{field.b_area} ha</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full min-h-96 flex-col items-center justify-center rounded-md border border-dashed text-center">
                      <Info className="h-10 w-10 text-muted-foreground/50" />
                      <h3 className="mt-4 text-lg font-semibold">Geen percelen geselecteerd</h3>
                      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                        Pas uw selectie aan, of ga naar het percelenoverzicht voor meer
                        filtermogelijkheden.
                      </p>
                      <Button asChild variant="link" className="mt-4">
                        <NavLink to={backlink}>Terug naar bouwplan</NavLink>
                      </Button>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Dialog open={open} onOpenChange={handleSelectionDialogOpenChange}>
                    <DialogTrigger asChild>
                      <Button variant="secondary" className="w-full">
                        Wijzig selectie
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Percelen selecteren</DialogTitle>
                        <DialogDescription>Selecteer de percelen voor de oogst.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="max-h-[30vh] space-y-2 overflow-y-auto rounded-md border p-2 mb-4">
                          {loaderData.fieldOptions
                            .filter((field) =>
                              field.cultivations.some((c) => loaderData.cultivationIds.includes(c)),
                            )
                            .map((field) => (
                              <div
                                key={field.b_id}
                                className="flex items-center space-x-2 rounded-md p-2 hover:bg-accent"
                              >
                                <Checkbox
                                  id={field.b_id}
                                  checked={isSelected(field.b_id!)}
                                  onCheckedChange={() => toggleSelection(field.b_id!)}
                                />
                                <Label htmlFor={field.b_id} className="flex-1 cursor-pointer">
                                  {field.b_name}
                                </Label>
                                <Badge variant="secondary">{field.b_area} ha</Badge>
                              </div>
                            ))}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          type="button"
                          onClick={() => handleSelectionDialogOpenChange(false)}
                        >
                          Sluiten
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              </Card>
              <Card className="flex-1">
                <CardHeader className="flex flex-row items-start">
                  <div className="grow">
                    <CardTitle>
                      {isBatchAdd ? getCapitalizedTermPlural : getCapitalizedTerm}{" "}
                      {isHarvestUpdate ? "bijwerken" : "toevoegen"}
                    </CardTitle>
                    <CardDescription>
                      {loaderData.fieldAmount === 0
                        ? "Selecteer eerst een of meerdere percelen."
                        : loaderData.fieldAmount === 1
                          ? isHarvestUpdate
                            ? `Werk de ${isBatchAdd ? getTermPlural : getTermSingular} bij van het geselecteerde perceel.`
                            : `Voeg ${isBatchAdd ? `nieuwe ${getTermPlural}` : `een nieuwe ${getTermSingular}`} toe aan het geselecteerde perceel.`
                          : isHarvestUpdate
                            ? `Werk de ${isBatchAdd ? getTermPlural : getTermSingular} bij van de geselecteerde percelen.`
                            : `Voeg ${isBatchAdd ? `nieuwe ${getTermPlural}` : `een nieuwe ${getTermSingular}`} toe aan de ${loaderData.fieldAmount} geselecteerde percelen.`}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {loaderData.b_lu_harvestable === "none" ? (
                    <div className="flex h-full min-h-60 items-center justify-center rounded-md border border-dashed">
                      <p className="text-sm text-muted-foreground">Dit gewas is niet oogstbaar.</p>
                    </div>
                  ) : loaderData.fieldAmount > 0 ? (
                    isBatchAdd ? (
                      <BatchHarvestForm
                        calendar={loaderData.calendar}
                        b_lu_croprotation={loaderData.cultivation.b_lu_croprotation}
                        onBack={() => setIsBatchAdd(false)}
                        b_lu_start={loaderData.b_lu_start ?? null}
                        b_lu_end={loaderData.b_lu_end ?? null}
                        harvestParameters={loaderData.harvestParameters}
                        b_date_harvest_default={loaderData.b_date_harvest_default}
                        defaultHarvest={{
                          ...loaderData.harvestableAnalysis,
                        }}
                      />
                    ) : (
                      <HarvestForm
                        key={selectedFieldIds.join(",")}
                        allowBatch={canBatchAdd}
                        onBatchClick={() => setIsBatchAdd(true)}
                        b_lu_croprotation={loaderData.cultivation.b_lu_croprotation ?? undefined}
                        harvestParameters={loaderData.harvestParameters}
                        b_lu_harvest_date={loaderData.harvestApplication.b_lu_harvest_date}
                        b_date_harvest_default={loaderData.b_date_harvest_default}
                        b_lu_yield={loaderData.harvestableAnalysis.b_lu_yield ?? undefined}
                        b_lu_yield_fresh={
                          loaderData.harvestableAnalysis.b_lu_yield_fresh ?? undefined
                        }
                        b_lu_yield_bruto={
                          loaderData.harvestableAnalysis.b_lu_yield_bruto ?? undefined
                        }
                        b_lu_tarra={loaderData.harvestableAnalysis.b_lu_tarra ?? undefined}
                        b_lu_uww={loaderData.harvestableAnalysis.b_lu_uww ?? undefined}
                        b_lu_moist={loaderData.harvestableAnalysis.b_lu_moist ?? undefined}
                        b_lu_dm={loaderData.harvestableAnalysis.b_lu_dm ?? undefined}
                        b_lu_cp={loaderData.harvestableAnalysis.b_lu_cp ?? undefined}
                        b_lu_n_harvestable={
                          loaderData.harvestableAnalysis.b_lu_n_harvestable ?? undefined
                        }
                        b_lu_harvestable={loaderData.b_lu_harvestable}
                        b_lu_start={loaderData.b_lu_start}
                        b_lu_end={loaderData.b_lu_end}
                        action={modifySearchParams(
                          `${location.pathname}${location.search}`,
                          (searchParams) =>
                            searchParams.set("fieldIds", selectedFieldIds.join(",")),
                        )}
                        handleConfirmation={handleConfirmation}
                      />
                    )
                  ) : (
                    <div className="flex h-full min-h-60 items-center justify-center rounded-md border border-dashed">
                      <p className="text-sm text-muted-foreground">
                        Selecteer eerst percelen in de linkerkolom.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </FarmContent>
        </div>
        {showOverwriteWarning && (
          <Dialog
            open={showOverwriteWarning}
            onOpenChange={(open) => {
              if (!open) {
                resolveConfirmation(false)
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bestaande {getTermSingular} overschrijven?</DialogTitle>
                <DialogDescription>
                  Er is al een {getTermSingular} geregistreerd voor één of meerdere van de
                  geselecteerde percelen. Als u doorgaat, worden de opgeslagen {getTermPlural}
                  overschreven.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => resolveConfirmation(false)}>
                  Annuleren
                </Button>
                <Button onClick={() => resolveConfirmation(true)}>Overschrijven</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </SidebarInset>
  )
}

const ActionSchema = z.discriminatedUnion("intent", [
  FormSchema.extend({ intent: z.literal("single_harvest") }),
  BatchFormSchema.extend({ intent: z.literal("batch_harvest") }),
])
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const { b_id_farm, calendar = "all" } = params
    if (!b_id_farm) {
      throw new Error("Farm ID is missing")
    }

    const session = await getSession(request)
    const url = new URL(request.url)
    const timeframe = getTimeframe(params)

    const fieldIds = url.searchParams.get("fieldIds")?.split(",").filter(Boolean) ?? []
    const cultivationIds = url.searchParams.get("cultivationIds")?.split(",").filter(Boolean) ?? []

    if (!fieldIds || fieldIds.length === 0) {
      return dataWithError(null, "Selecteer eerst een perceel.")
    }

    if (cultivationIds.length !== 1) {
      return dataWithError(null, "Selecteer precies één gewas.")
    }

    const cultivationCatalogueData = await getCultivationsFromCatalogue(
      fdm,
      session.principal_id,
      b_id_farm,
    )

    const targetCultivation = cultivationCatalogueData.find(
      (c: { b_lu_catalogue: string; b_lu_harvestable: "once" | "multiple" | "none" }) =>
        c.b_lu_catalogue === cultivationIds[0],
    )

    if (!targetCultivation) {
      return dataWithError(null, "Gewas niet gevonden.")
    }

    const effectiveHarvestable = getEffectiveHarvestable(
      targetCultivation.b_lu_harvestable ?? "once",
      targetCultivation.b_lu_croprotation,
    )

    if (effectiveHarvestable === "none") {
      return dataWithError(null, "Dit gewas is niet oogstbaar.")
    }

    const redirectURL = url.searchParams.has("create")
      ? `/farm/create/${b_id_farm}/${calendar}/rotation`
      : `/farm/${b_id_farm}/${calendar}/rotation`

    const termCapitalizedSingular = getHarvestCapitalizedTerm(targetCultivation.b_lu_croprotation)
    const termCapitalizedPlural = getHarvestCapitalizedTerm(
      targetCultivation.b_lu_croprotation,
      true,
    )

    if (request.method === "DELETE") {
      for (const fieldId of fieldIds) {
        const cultivationsForField = await getCultivations(
          fdm,
          session.principal_id,
          fieldId,
          timeframe,
        )

        const targetCultivationInstance = cultivationsForField.find(
          (c) => c.b_lu_catalogue === cultivationIds[0],
        )

        if (!targetCultivationInstance) {
          return dataWithError(null, `Gewas niet gevonden voor perceel ${fieldId}.`)
        }

        const b_lu = targetCultivationInstance.b_lu

        // Check for existing harvests for this specific cultivation instance
        const existingHarvests = await getHarvests(fdm, session.principal_id, b_lu)
        // If there are existing harvests, remove them before adding new ones
        for (const harvest of existingHarvests) {
          await removeHarvest(fdm, session.principal_id, harvest.b_id_harvesting)
        }
      }

      return redirectWithSuccess(redirectURL, {
        message: `${termCapitalizedSingular} succesvol verwijderd van ${fieldIds.length} ${fieldIds.length === 1 ? "perceel" : "percelen"}.`,
      })
    }

    const formValues = await extractFormValuesFromRequest(request, ActionSchema)

    const firstTargetCultivation = (
      await getCultivations(fdm, session.principal_id, fieldIds[0], timeframe)
    ).find((c) => c.b_lu_catalogue === cultivationIds[0])

    if (!firstTargetCultivation) {
      return dataWithError(null, `Gewas niet gevonden voor perceel ${fieldIds[0]}.`)
    }

    const firstEffectiveHarvestable = getEffectiveHarvestable(
      firstTargetCultivation.b_lu_harvestable ?? "once",
      firstTargetCultivation.b_lu_croprotation,
    )

    // Batch harvest only works when the effective harvestable type allows it
    if (formValues.intent === "batch_harvest" && firstEffectiveHarvestable !== "multiple") {
      return dataWithError(
        {
          warning: `Je kunt bij ${firstTargetCultivation.b_lu_catalogue} geen sneden in batches toevoegen. Alleen gras is toegestaan.`,
        },
        `Je kunt bij ${firstTargetCultivation.b_lu_name} geen sneden in batches toevoegen. Alleen gras is toegestaan.`,
      )
    }

    // Batch harvest must not add multiple harvests to a cultivation that can only be harvested once
    if (
      formValues.intent === "batch_harvest" &&
      formValues.harvests.length > 1 &&
      firstEffectiveHarvestable !== "multiple"
    ) {
      return dataWithWarning(null, "Dit gewas kan niet meer dan één keer geoogst worden.")
    }

    if (formValues.intent === "batch_harvest") {
      const errors = formValues.harvests.map((row) => validateRow(firstTargetCultivation, row))

      if (errors.some((error) => Object.keys(error).length > 0))
        return dataWithWarning(
          { errors: { harvests: errors } },
          "Invoer is ongeldig. Controleer het formulier.",
        )
    }

    if (formValues.intent === "single_harvest") {
      const errors = validateRow(firstTargetCultivation, formValues)
      if (Object.keys(errors).length > 0) {
        return dataWithWarning({ errors }, "Invoer is ongeldig. Controleer het formulier.")
      }
    }

    const targetCultivationInstances = [firstTargetCultivation].concat(
      await Promise.all(
        fieldIds.slice(1).map(async (fieldId) => {
          const cultivationsForField = await getCultivations(
            fdm,
            session.principal_id,
            fieldId,
            timeframe,
          )

          const targetCultivationInstance = cultivationsForField.find(
            (c) => c.b_lu_catalogue === cultivationIds[0],
          )

          if (!targetCultivationInstance) {
            throw dataWithError(null, `Gewas niet gevonden voor perceel ${fieldId}.`)
          }

          return targetCultivationInstance
        }),
      ),
    )

    if (formValues.intent === "batch_harvest") {
      await fdm.transaction(async (tx) => {
        for (let f = 0; f < fieldIds.length; f++) {
          await Promise.all(
            formValues.harvests.map((row, h) =>
              addHarvestFromRow(
                tx,
                session.principal_id,
                targetCultivationInstances[f],
                row,
                h === 0,
              ),
            ),
          )
        }
      })
      return redirectWithSuccess(redirectURL, {
        message: `${termCapitalizedPlural} zijn succesvol toegevoegd aan ${fieldIds.length} ${fieldIds.length === 1 ? "perceel" : "percelen"}.`,
      })
    }

    if (formValues.intent === "single_harvest") {
      await fdm.transaction(async (tx) => {
        for (let f = 0; f < fieldIds.length; f++) {
          await addHarvestFromRow(
            tx,
            session.principal_id,
            targetCultivationInstances[f],
            formValues,
            true,
          )
        }
      })
      return redirectWithSuccess(redirectURL, {
        message: `${termCapitalizedSingular} succesvol toegevoegd aan ${fieldIds.length} ${fieldIds.length === 1 ? "perceel" : "percelen"}.`,
      })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return dataWithWarning(null, "Invoer is ongeldig. Controleer het formulier.")
    }
    throw handleActionError(error)
  }
}

function validateRow(targetCultivationInstance: Cultivation, row: z.infer<typeof FormSchema>) {
  const errors: Partial<Record<keyof z.infer<typeof FormSchema>, { message: string }>> = {}

  if (!row.b_lu_harvest_date) {
    errors.b_lu_harvest_date = { message: "Selecteer een oogstdatum" }
  }

  // Get required harvest parameters for the cultivation's harvest category
  const requiredHarvestParameters = getParametersForHarvestCat(
    targetCultivationInstance.b_lu_harvestcat,
  )

  // Check if all required parameters are present
  for (const param of requiredHarvestParameters) {
    if (row[param] === undefined || row[param] === null) {
      errors[param] = {
        message: `${getHarvestParameterLabel(param)} is nodig voor dit gewas.`,
      }
    }
  }

  return errors
}

async function addHarvestFromRow(
  tx: Omit<typeof fdm, "$client">,
  principal_id: string,
  targetCultivationInstance: Cultivation,
  formValues: z.infer<typeof FormSchema>,
  first: boolean,
) {
  // Get required harvest parameters for the cultivation's harvest category
  const requiredHarvestParameters = getParametersForHarvestCat(
    targetCultivationInstance.b_lu_harvestcat,
  )

  // Filter form values to include only required parameters for updateHarvest
  const harvestProperties: Record<string, number> = {}
  for (const param of requiredHarvestParameters) {
    if (formValues[param] !== undefined) {
      harvestProperties[param] = formValues[param]
    }
  }

  const effectiveHarvestable = getEffectiveHarvestable(
    targetCultivationInstance.b_lu_harvestable ?? "once",
    targetCultivationInstance.b_lu_croprotation,
  )
  if (first && effectiveHarvestable === "once") {
    // Check for existing harvests for this specific cultivation instance
    const existingHarvests = await getHarvests(tx, principal_id, targetCultivationInstance.b_lu)

    if (existingHarvests.length > 0) {
      // If there are existing harvests, remove them before adding new ones
      for (const harvest of existingHarvests) {
        await removeHarvest(tx, principal_id, harvest.b_id_harvesting)
      }
    }
  }

  await addHarvest(
    tx,
    principal_id,
    targetCultivationInstance.b_lu,
    formValues.b_lu_harvest_date,
    harvestProperties,
  )
}
