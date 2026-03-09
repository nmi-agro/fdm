import {
    addHarvest,
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
import {
    dataWithError,
    dataWithWarning,
    redirectWithSuccess,
} from "remix-toast"
import { z } from "zod"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { HarvestForm } from "~/components/blocks/harvest/form"
import { FormSchema } from "~/components/blocks/harvest/schema"
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { modifySearchParams } from "~/lib/url-utils"
import { getHarvestParameterLabel } from "../components/blocks/harvest/parameters"

export const meta: MetaFunction = () => {
    return [
        { title: `Oogst toevoegen | ${clientConfig.name}` },
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
        const cultivationIds =
            url.searchParams
                .get("cultivationIds")
                ?.split(",")
                .filter(Boolean) ?? []

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
                statusText:
                    "Selecteer precies één gewas om oogst toe te voegen.",
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
            (
                await getFields(fdm, session.principal_id, b_id_farm, timeframe)
            ).map(async (field) => {
                const cultivations = await getCultivations(
                    fdm,
                    session.principal_id,
                    field.b_id,
                    timeframe,
                )
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
            throw new Response(
                `Cultivation with ID ${cultivationIds[0]} not found.`,
                {
                    status: 404,
                    statusText: `Cultivation with ID ${cultivationIds[0]} not found.`,
                },
            )
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
                field.cultivations.some((c) =>
                    cultivationIds.includes(c.b_lu_catalogue),
                ),
            )
        }

        type HarvestApplication = Awaited<
            ReturnType<typeof getHarvests>
        >[number]

        const selectedFields = await Promise.all(
            selectedFieldsData.map(async (field) => {
                let harvestApplication: HarvestApplication | undefined
                let harvestableAnalysis: Partial<
                    HarvestApplication["harvestable"]["harvestable_analyses"][number]
                > = {}
                let hasHarvest = false

                const targetFieldCultivation = field.cultivations.find(
                    (c) =>
                        c.b_lu_catalogue === targetCultivation.b_lu_catalogue,
                )

                if (targetFieldCultivation) {
                    const harvests = await getHarvests(
                        fdm,
                        session.principal_id,
                        targetFieldCultivation.b_lu,
                    )
                    if (harvests.length > 0) {
                        harvestApplication = harvests[0]
                        hasHarvest =
                            harvestApplication.b_lu_yield !== undefined ||
                            harvestApplication.b_lu_n_harvestable !==
                                undefined ||
                            harvestApplication.b_lu_harvest_date !== undefined
                        if (
                            harvestApplication?.harvestable
                                ?.harvestable_analyses.length > 0
                        ) {
                            harvestableAnalysis =
                                harvestApplication.harvestable
                                    .harvestable_analyses[0]
                        }
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

        const harvestApplication:
            | HarvestApplication
            | Partial<HarvestApplication> =
            firstFieldWithData?.harvestApplication ?? {
                b_lu_yield: undefined,
                b_lu_n_harvestable: undefined,
                b_lu_harvest_date: undefined,
                b_lu_start: undefined,
                b_lu_end: undefined,
                b_lu_harvestable: undefined,
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
            (max, date) =>
                max && date ? (max > date ? max : date) : max || date,
            undefined,
        )
        const b_lu_end = b_lu_ends.reduce(
            (min, date) =>
                min && date ? (min < date ? min : date) : min || date,
            undefined,
        )

        const fieldOptions = allFieldsWithCultivations.map((field) => {
            if (!field?.b_id || !field?.b_name) {
                throw new Error("Invalid field data structure")
            }
            return {
                b_id: field.b_id,
                b_name: field.b_name,
                b_area: Math.round(field.b_area * 10) / 10,
                cultivations: field.cultivations.map((c) => c.b_lu_catalogue), // Pass cultivations for each field
            }
        })

        const harvestParameters = getParametersForHarvestCat(
            targetCultivation.b_lu_harvestcat,
        )
        const b_date_harvest_default =
            cultivationCatalogueData.find(
                (item) =>
                    item.b_lu_catalogue === targetCultivation.b_lu_catalogue,
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
                b_area: Math.round(field.b_area * 10) / 10,
                cultivations: field.cultivations.map(
                    (c: { b_lu_catalogue: string }) => c.b_lu_catalogue,
                ),
                hasHarvest: field.hasHarvest,
            })),
            fieldOptions: fieldOptions, // All fields for selection
            cultivation: targetCultivation,
            cultivationName: targetCultivation?.b_lu_name ?? "onbekend gewas",
            cultivationIds: cultivationIds,
            b_lu_harvestable: targetCultivation.b_lu_harvestable ?? "once",
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
        setSelectedFieldIds(
            loaderData.selectedFields.map((field) => field.b_id!),
        )
    }, [loaderData.selectedFields])

    const isSubmitting =
        navigation.state === "submitting" && Boolean(navigation.formData)

    const handleSelectionChange = () => {
        const newSearchParams = new URLSearchParams(searchParams)
        newSearchParams.set("fieldIds", selectedFieldIds.join(","))
        newSearchParams.set(
            "cultivationIds",
            loaderData.cultivationIds.join(","),
        )
        setSearchParams(newSearchParams, { preventScrollReset: true })
    }

    const isSelected = (fieldId: string) => selectedFieldIds.includes(fieldId)

    const toggleSelection = (fieldId: string) => {
        setSelectedFieldIds((prev) =>
            isSelected(fieldId)
                ? prev.filter((id) => id !== fieldId)
                : [...prev, fieldId],
        )
    }

    const displayedSelectedFields = loaderData.fieldOptions.filter((field) =>
        selectedFieldIds.includes(field.b_id!),
    )

    const isHarvestUpdate = loaderData.harvestApplication.b_lu_harvest_date

    function handleSelectionDialogOpenChange(open: boolean) {
        if (!open) {
            handleSelectionChange()
        }
        setOpen(open)
    }

    // Confirmation Handling
    const [resolveConfirmationPromise, setResolveConfirmationPromise] =
        useState<[(value: boolean) => void]>()
    const [confirmationPromise, setConfirmationPromise] =
        useState<Promise<boolean>>()

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
                <HeaderFarm
                    b_id_farm={loaderData.b_id_farm}
                    farmOptions={loaderData.farmOptions}
                />
                <BreadcrumbSeparator />
                <BreadcrumbItem className="hidden md:block">
                    Bouwplan
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="hidden md:block">
                    {isHarvestUpdate ? "Oogst bijwerken" : "Oogst toevoegen"}
                </BreadcrumbItem>
            </Header>
            <main>
                <FarmTitle
                    title={
                        isHarvestUpdate
                            ? `Oogst bijwerken in ${loaderData.cultivationName}`
                            : `Oogst toevoegen aan ${loaderData.cultivationName}`
                    }
                    description={
                        isHarvestUpdate
                            ? "Kies 1 of meerdere percelen om hun oogst bij te werken of te verwijderen"
                            : "Kies 1 of meerdere percelen om een oogst toe te voegen"
                    }
                />
                <div className="relative">
                    {isSubmitting && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                            <div className="flex items-center text-sm text-muted-foreground">
                                <Spinner className="mr-2" />
                                <span>Oogst wordt toegevoegd...</span>
                            </div>
                        </div>
                    )}
                    <FarmContent>
                        <div className="flex flex-col space-y-8 pb-10 md:flex-row md:space-x-12 md:space-y-0">
                            <Card className="md:w-1/3">
                                <CardHeader>
                                    <CardTitle>
                                        Geselecteerde percelen
                                    </CardTitle>
                                    <CardDescription>
                                        De oogst wordt toegepast op de volgende
                                        percelen.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {displayedSelectedFields.length > 0 ? (
                                        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                                            {displayedSelectedFields.map(
                                                (field) => (
                                                    <div
                                                        key={field.b_id}
                                                        className="flex items-center justify-between rounded-md border p-3"
                                                    >
                                                        <p className="text-sm font-medium">
                                                            {field.b_name}
                                                        </p>
                                                        <div className="flex gap-2 items-center">
                                                            {!field.cultivations.some(
                                                                (c) =>
                                                                    loaderData.cultivationIds.includes(
                                                                        c,
                                                                    ),
                                                            ) && (
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger
                                                                            asChild
                                                                        >
                                                                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>
                                                                                Dit
                                                                                perceel
                                                                                heeft
                                                                                het
                                                                                geselecteerde
                                                                                gewas
                                                                                niet
                                                                            </p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            )}
                                                            <Badge variant="secondary">
                                                                {field.b_area}{" "}
                                                                ha
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex h-full min-h-96 flex-col items-center justify-center rounded-md border border-dashed text-center">
                                            <Info className="h-10 w-10 text-muted-foreground/50" />
                                            <h3 className="mt-4 text-lg font-semibold">
                                                Geen percelen geselecteerd
                                            </h3>
                                            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                                                Pas uw selectie aan, of ga naar
                                                het percelenoverzicht voor meer
                                                filtermogelijkheden.
                                            </p>
                                            <Button
                                                asChild
                                                variant="link"
                                                className="mt-4"
                                            >
                                                <NavLink to={backlink}>
                                                    Terug naar bouwplan
                                                </NavLink>
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter>
                                    <Dialog
                                        open={open}
                                        onOpenChange={
                                            handleSelectionDialogOpenChange
                                        }
                                    >
                                        <DialogTrigger asChild>
                                            <Button
                                                variant="secondary"
                                                className="w-full"
                                            >
                                                Wijzig selectie
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[425px]">
                                            <DialogHeader>
                                                <DialogTitle>
                                                    Percelen selecteren
                                                </DialogTitle>
                                                <DialogDescription>
                                                    Selecteer de percelen voor
                                                    de oogst.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="max-h-[30vh] space-y-2 overflow-y-auto rounded-md border p-2 mb-4">
                                                    {loaderData.fieldOptions
                                                        .filter((field) =>
                                                            field.cultivations.some(
                                                                (c) =>
                                                                    loaderData.cultivationIds.includes(
                                                                        c,
                                                                    ),
                                                            ),
                                                        )
                                                        .map((field) => (
                                                            <div
                                                                key={field.b_id}
                                                                className="flex items-center space-x-2 rounded-md p-2 hover:bg-accent"
                                                            >
                                                                <Checkbox
                                                                    id={
                                                                        field.b_id
                                                                    }
                                                                    checked={isSelected(
                                                                        field.b_id!,
                                                                    )}
                                                                    onCheckedChange={() =>
                                                                        toggleSelection(
                                                                            field.b_id!,
                                                                        )
                                                                    }
                                                                />
                                                                <Label
                                                                    htmlFor={
                                                                        field.b_id
                                                                    }
                                                                    className="flex-1 cursor-pointer"
                                                                >
                                                                    {
                                                                        field.b_name
                                                                    }
                                                                </Label>
                                                                <Badge variant="secondary">
                                                                    {
                                                                        field.b_area
                                                                    }{" "}
                                                                    ha
                                                                </Badge>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button
                                                    type="button"
                                                    onClick={() =>
                                                        handleSelectionDialogOpenChange(
                                                            false,
                                                        )
                                                    }
                                                >
                                                    Sluiten
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </CardFooter>
                            </Card>
                            <Card className="flex-1">
                                <CardHeader>
                                    <CardTitle>
                                        {isHarvestUpdate
                                            ? "Oogst bijwerken"
                                            : "Oogst toevoegen"}
                                    </CardTitle>
                                    <CardDescription>
                                        {loaderData.fieldAmount === 0
                                            ? "Selecteer eerst een of meerdere percelen."
                                            : loaderData.fieldAmount === 1
                                              ? isHarvestUpdate
                                                  ? "Werk oogst bij van het geselecteerde perceel."
                                                  : "Voeg een nieuwe oogst toe aan de geselecteerde perceel."
                                              : isHarvestUpdate
                                                ? "Werk oogst bij van de geselecteerde percelen."
                                                : `Voeg een nieuwe oogst toe aan de ${loaderData.fieldAmount} geselecteerde percelen.`}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loaderData.b_lu_harvestable === "none" ? (
                                        <div className="flex h-full min-h-60 items-center justify-center rounded-md border border-dashed">
                                            <p className="text-sm text-muted-foreground">
                                                Dit gewas is niet oogstbaar.
                                            </p>
                                        </div>
                                    ) : loaderData.fieldAmount > 0 ? (
                                        <HarvestForm
                                            key={selectedFieldIds.join(",")}
                                            harvestParameters={
                                                loaderData.harvestParameters
                                            }
                                            b_lu_harvest_date={
                                                loaderData.harvestApplication
                                                    .b_lu_harvest_date
                                            }
                                            b_date_harvest_default={
                                                loaderData.b_date_harvest_default
                                            }
                                            b_lu_yield={
                                                loaderData.harvestableAnalysis
                                                    .b_lu_yield
                                            }
                                            b_lu_yield_fresh={
                                                loaderData.harvestableAnalysis
                                                    .b_lu_yield_fresh
                                            }
                                            b_lu_yield_bruto={
                                                loaderData.harvestableAnalysis
                                                    .b_lu_yield_bruto
                                            }
                                            b_lu_tarra={
                                                loaderData.harvestableAnalysis
                                                    .b_lu_tarra
                                            }
                                            b_lu_uww={
                                                loaderData.harvestableAnalysis
                                                    .b_lu_uww
                                            }
                                            b_lu_moist={
                                                loaderData.harvestableAnalysis
                                                    .b_lu_moist
                                            }
                                            b_lu_dm={
                                                loaderData.harvestableAnalysis
                                                    .b_lu_dm
                                            }
                                            b_lu_cp={
                                                loaderData.harvestableAnalysis
                                                    .b_lu_cp
                                            }
                                            b_lu_n_harvestable={
                                                loaderData.harvestableAnalysis
                                                    .b_lu_n_harvestable
                                            }
                                            b_lu_harvestable={
                                                loaderData.cultivation
                                                    .b_lu_harvestable
                                            }
                                            b_lu_start={loaderData.b_lu_start}
                                            b_lu_end={loaderData.b_lu_end}
                                            action={modifySearchParams(
                                                `${location.pathname}${location.search}`,
                                                (searchParams) =>
                                                    searchParams.set(
                                                        "fieldIds",
                                                        selectedFieldIds.join(
                                                            ",",
                                                        ),
                                                    ),
                                            )}
                                            handleConfirmation={
                                                handleConfirmation
                                            }
                                        />
                                    ) : (
                                        <div className="flex h-full min-h-60 items-center justify-center rounded-md border border-dashed">
                                            <p className="text-sm text-muted-foreground">
                                                Selecteer eerst percelen in de
                                                linkerkolom.
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
                                <DialogTitle>
                                    Bestaande oogst overschrijven?
                                </DialogTitle>
                                <DialogDescription>
                                    Er is al een oogst geregistreerd voor één of
                                    meerdere van de geselecteerde percelen. Als
                                    u doorgaat, worden de opgeslagen oogsten
                                    overschreven.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => resolveConfirmation(false)}
                                >
                                    Annuleren
                                </Button>
                                <Button
                                    onClick={() => resolveConfirmation(true)}
                                >
                                    Overschrijven
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </main>
        </SidebarInset>
    )
}

export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const { b_id_farm, calendar = "all" } = params
        if (!b_id_farm) {
            throw new Error("Farm ID is missing")
        }

        const session = await getSession(request)
        const url = new URL(request.url)
        const fieldIds =
            url.searchParams.get("fieldIds")?.split(",").filter(Boolean) ?? []
        const cultivationIds =
            url.searchParams
                .get("cultivationIds")
                ?.split(",")
                .filter(Boolean) ?? []

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
            (c: {
                b_lu_catalogue: string
                b_lu_harvestable: "once" | "multiple" | "none"
            }) => c.b_lu_catalogue === cultivationIds[0],
        )

        if (!targetCultivation) {
            return dataWithError(null, "Gewas niet gevonden.")
        }

        const b_lu_harvestable = targetCultivation.b_lu_harvestable

        if (b_lu_harvestable === "none") {
            return dataWithError(null, "Dit gewas is niet oogstbaar.")
        }

        const redirectURL = url.searchParams.has("create")
            ? `/farm/create/${b_id_farm}/${calendar}/rotation`
            : `/farm/${b_id_farm}/${calendar}/rotation`

        if (request.method === "DELETE") {
            for (const fieldId of fieldIds) {
                const cultivationsForField = await getCultivations(
                    fdm,
                    session.principal_id,
                    fieldId,
                )

                const targetCultivationInstance = cultivationsForField.find(
                    (c) => c.b_lu_catalogue === cultivationIds[0],
                )

                if (!targetCultivationInstance) {
                    return dataWithError(
                        null,
                        `Gewas niet gevonden voor perceel ${fieldId}.`,
                    )
                }

                const b_lu = targetCultivationInstance.b_lu

                // Check for existing harvests for this specific cultivation instance
                const existingHarvests = await getHarvests(
                    fdm,
                    session.principal_id,
                    b_lu,
                )
                // If there are existing harvests, remove them before adding new ones
                for (const harvest of existingHarvests) {
                    await removeHarvest(
                        fdm,
                        session.principal_id,
                        harvest.b_id_harvesting,
                    )
                }
            }

            return redirectWithSuccess(redirectURL, {
                message: `Oogst succesvol verwijderd van ${fieldIds.length} ${fieldIds.length === 1 ? "perceel" : "percelen"}.`,
            })
        }

        const formValues = await extractFormValuesFromRequest(
            request,
            FormSchema,
        )
        if (!formValues.b_lu_harvest_date) {
            const errors = [
                {
                    path: "b_lu_harvest_date",
                    message: "Selecteer een oogstdatum",
                },
            ]

            throw new Error(JSON.stringify(errors))
        }

        for (const fieldId of fieldIds) {
            const cultivationsForField = await getCultivations(
                fdm,
                session.principal_id,
                fieldId,
            )

            const targetCultivationInstance = cultivationsForField.find(
                (c) => c.b_lu_catalogue === cultivationIds[0],
            )

            if (!targetCultivationInstance) {
                return dataWithError(
                    null,
                    `Gewas niet gevonden voor perceel ${fieldId}.`,
                )
            }

            const b_lu = targetCultivationInstance.b_lu

            // Get required harvest parameters for the cultivation's harvest category
            const requiredHarvestParameters = getParametersForHarvestCat(
                targetCultivationInstance.b_lu_harvestcat,
            )

            // Check if all required parameters are present
            const missingParameters: string[] = []
            for (const param of requiredHarvestParameters) {
                if (
                    (formValues as Record<string, any>)[param] === undefined ||
                    (formValues as Record<string, any>)[param] === null
                ) {
                    missingParameters.push(param)
                }
            }
            const missingParameterLabels = missingParameters.map((param) => {
                return getHarvestParameterLabel(param)
            })

            if (missingParameters.length > 0) {
                return dataWithWarning(
                    {
                        warning: `Missing required harvest parameters: ${missingParameters.join(
                            ", ",
                        )}`,
                    },
                    `Voor de volgende parameters ontbreekt een waarde: ${missingParameterLabels.join(
                        ", ",
                    )}`,
                )
            }

            // Filter form values to include only required parameters for updateHarvest
            const harvestProperties: Record<string, any> = {}
            for (const param of requiredHarvestParameters) {
                if ((formValues as Record<string, any>)[param] !== undefined) {
                    harvestProperties[param] = (
                        formValues as Record<string, any>
                    )[param]
                }
            }

            if (b_lu_harvestable === "once") {
                // Check for existing harvests for this specific cultivation instance
                const existingHarvests = await getHarvests(
                    fdm,
                    session.principal_id,
                    b_lu,
                )

                if (existingHarvests.length > 0) {
                    // If there are existing harvests, remove them before adding new ones
                    for (const harvest of existingHarvests) {
                        await removeHarvest(
                            fdm,
                            session.principal_id,
                            harvest.b_id_harvesting,
                        )
                    }
                }
            }

            await addHarvest(
                fdm,
                session.principal_id,
                b_lu,
                formValues.b_lu_harvest_date,
                harvestProperties,
            )
        }

        return redirectWithSuccess(redirectURL, {
            message: `Oogst succesvol toegevoegd aan ${fieldIds.length} ${fieldIds.length === 1 ? "perceel" : "percelen"}.`,
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return dataWithError(
                null,
                "Invoer is ongeldig. Controleer het formulier.",
            )
        }
        throw handleActionError(error)
    }
}
