import {
    addFertilizerApplication,
    type FertilizerApplication,
    type Field,
    getCultivations,
    getCultivationsFromCatalogue,
    getFarms,
    getFertilizerApplication,
    getFertilizerParametersDescription,
    getFertilizers,
    getField,
    getFields,
    updateFertilizerApplication,
} from "@nmi-agro/fdm-core"
import { AlertTriangle, Info } from "lucide-react"
import { useEffect, useState } from "react"
import {
    type ActionFunctionArgs,
    data,
    type MetaFunction,
    NavLink,
    redirect,
    useLoaderData,
    useLocation,
    useNavigation,
    useSearchParams,
} from "react-router"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import { z } from "zod"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import {
    FertilizerApplicationForm,
    type FertilizerOption,
} from "~/components/blocks/fertilizer-applications/form"
import {
    FormSchema,
    FormSchemaModify,
    FormSchemaPartialModify,
} from "~/components/blocks/fertilizer-applications/formschema"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "~/components/ui/accordion"
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
import { isOfOrigin, modifySearchParams } from "~/lib/url-utils"
import type { Route } from "./+types/farm.$b_id_farm.$calendar.rotation_.fertilizer._index"

export const meta: MetaFunction = () => {
    return [
        { title: `Bemesting toevoegen | ${clientConfig.name}` },
        {
            name: "description",
            content: "",
        },
    ]
}

function parseAppIds(
    appIdPairs: string[],
): { b_id: string; p_app_id: string }[] {
    const applicationRefs: { p_app_id: string; b_id: string }[] = []

    // Parse application references
    for (const appId of appIdPairs) {
        const splitting = appId.split(":")
        if (splitting.length < 2) {
            throw new Error(`invalid b_id:p_app_id : ${appId}`)
        }
        const [b_id, p_app_id] = splitting
        applicationRefs.push({ b_id, p_app_id })
    }

    return applicationRefs
}

type PathParams = Route.LoaderArgs["params"]
interface StrategizedLoaderData {
    fields: (Field & { cultivations?: string[] })[]
    selectedFieldIds: string[]
    canReselect: boolean
    appIds: string[] | null
    exampleFertilizerApplication?: Partial<FertilizerApplication> | null
    fertilizerApplication?: Partial<FertilizerApplication> | null
}
function loadByStrategy(
    principal_id: string,
    params: PathParams,
    searchParams: URLSearchParams,
) {
    // Get cultivationIds from search params
    const appIds = searchParams.get("appIds")?.split(",").filter(Boolean)

    if (appIds && appIds.length > 0) {
        return loadByAppIds(principal_id, params, appIds)
    }

    // Get cultivationIds from search params
    const cultivationIds =
        searchParams.get("cultivationIds")?.split(",").filter(Boolean) ?? []

    if (!cultivationIds || cultivationIds.length === 0) {
        throw data("missing: cultivationIds", {
            status: 400,
            statusText: "missing: cultivationIds",
        })
    }

    // Get fieldIds from search params (if any)
    const fieldIdsFromSearchParams =
        searchParams.get("fieldIds")?.split(",").filter(Boolean) ?? null

    return loadByCultivationAndFieldIds(
        principal_id,
        params,
        cultivationIds,
        fieldIdsFromSearchParams,
    )
}

async function loadByCultivationAndFieldIds(
    principal_id: string,
    params: PathParams,
    cultivationIds: string[],
    fieldIds: string[] | null,
): Promise<StrategizedLoaderData> {
    const timeframe = getTimeframe(params)
    const fields = await getFields(
        fdm,
        principal_id,
        params.b_id_farm,
        timeframe,
    )

    const fieldsExtended = await Promise.all(
        fields.map(async (field) => {
            const cultivations = await getCultivations(
                fdm,
                principal_id,
                field.b_id,
                timeframe,
            )
            return {
                ...field,
                cultivations: cultivations.map((c) => c.b_lu_catalogue),
            }
        }),
    )

    const fieldsWithCultivation = fieldsExtended.filter((field) =>
        field.cultivations.some((b_lu_catalogue) =>
            cultivationIds.includes(b_lu_catalogue),
        ),
    )

    const fieldIdsSet = new Set(fieldIds)

    const selectedFieldIds = fieldIds
        ? fieldsWithCultivation
              .map((cultivation) => cultivation.b_id)
              .filter((b_id) => fieldIdsSet.has(b_id))
        : fieldsWithCultivation.map((cultivation) => cultivation.b_id)

    return {
        fields: fieldsWithCultivation,
        selectedFieldIds: selectedFieldIds,
        canReselect: true,
        appIds: null,
        exampleFertilizerApplication: undefined,
        fertilizerApplication: undefined,
    }
}

async function loadByAppIds(
    principal_id: string,
    _params: PathParams,
    appIdPairs: string[],
): Promise<StrategizedLoaderData> {
    const applicationRefs = parseAppIds(appIdPairs)

    const fields = await Promise.all(
        applicationRefs.map((ref) => getField(fdm, principal_id, ref.b_id)),
    )

    const fertilizerApplications = (await Promise.all(
        applicationRefs.map(async ({ p_app_id }) =>
            getFertilizerApplication(fdm, principal_id, p_app_id),
        ),
    )) as FertilizerApplication[]

    let exampleFertilizerApplication: Partial<FertilizerApplication> = {}
    let fertilizerApplication: Partial<FertilizerApplication> = {}

    if (fertilizerApplications.length > 0) {
        // These will be shown as form placeholders at worst
        exampleFertilizerApplication = { ...fertilizerApplications[0] }

        // These keys are shown on the form
        const keyTypes = {
            p_id: "string",
            p_app_date: "date",
            p_app_method: "string",
            p_app_amount: "number",
        } as const
        const keys = Object.keys(keyTypes) as (keyof typeof keyTypes)[]

        // Select the values that can be shown on the form
        fertilizerApplication = Object.fromEntries(
            keys.map((key) => [key, exampleFertilizerApplication[key]]),
        )

        // Only keep values that are common between the fertilizer applications
        for (const key of keys) {
            for (const app of fertilizerApplications) {
                if (
                    exampleFertilizerApplication[key] === null ||
                    typeof exampleFertilizerApplication[key] === "undefined" ||
                    app[key] === null ||
                    typeof app[key] === "undefined"
                ) {
                    delete fertilizerApplication[key]
                    continue
                }
                if (
                    keyTypes[key] === "date"
                        ? (
                              exampleFertilizerApplication[key] as Date
                          ).getTime() !== (app[key] as Date).getTime()
                        : exampleFertilizerApplication[key] !== app[key]
                ) {
                    delete fertilizerApplication[key]
                }
            }
        }

        // If the fertilizer types are different, assume the application methods are different too
        if (!fertilizerApplication.p_id) {
            delete fertilizerApplication.p_app_method
            // Also, no specific placeholder should be shown
            delete exampleFertilizerApplication.p_app_amount
        }
    }

    return {
        fields: fields as StrategizedLoaderData["fields"],
        selectedFieldIds: fields.map((field) => field.b_id),
        canReselect: false,
        appIds: fertilizerApplications.map((app) => app.p_app_id),
        exampleFertilizerApplication: exampleFertilizerApplication,
        fertilizerApplication: fertilizerApplication,
    }
}

export async function loader({ request, params }: Route.LoaderArgs) {
    try {
        // Get the session
        const session = await getSession(request)

        const url = new URL(request.url)

        // Get timeframe from calendar store
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

        const {
            fields,
            selectedFieldIds,
            canReselect,
            appIds,
            exampleFertilizerApplication,
            fertilizerApplication,
        } = await loadByStrategy(session.principal_id, params, url.searchParams)

        const fieldOptions = fields.map((field) => {
            if (!field?.b_id || !field?.b_name) {
                throw new Error("Invalid field data structure")
            }
            return {
                b_id: field.b_id,
                b_name: field.b_name,
                b_area: Math.round((field.b_area ?? 0) * 10) / 10,
                cultivations: field.cultivations ?? [], // Pass cultivations for each field
            }
        })

        // Get available fertilizers for the farm
        const fertilizers = await getFertilizers(
            fdm,
            session.principal_id,
            params.b_id_farm,
        )
        const fertilizerParameterDescription =
            getFertilizerParametersDescription()
        const applicationMethods = fertilizerParameterDescription.find(
            (x: { parameter: string }) =>
                x.parameter === "p_app_method_options",
        )
        const applicationMethodOptionsRaw = applicationMethods?.options
        if (!applicationMethodOptionsRaw)
            throw new Error("Parameter metadata missing")
        // Map fertilizers to options for the combobox
        const fertilizerOptions: FertilizerOption[] = fertilizers.map(
            (fertilizer) => {
                const applicationMethodOptions = fertilizer.p_app_method_options
                    ?.map((opt: string) => {
                        const meta = applicationMethodOptionsRaw.find(
                            (x) => x.value === opt,
                        )
                        return meta
                            ? { value: opt, label: meta.label }
                            : undefined
                    })
                    .filter(
                        (option): option is { value: string; label: string } =>
                            option !== undefined,
                    )
                return {
                    value: fertilizer.p_id,
                    label: fertilizer.p_name_nl ?? "Onbekend",
                    applicationMethodOptions: applicationMethodOptions,
                }
            },
        )

        const catalogueCultivations = await getCultivationsFromCatalogue(
            fdm,
            session.principal_id,
            params.b_id_farm,
        )
        const cultivationIds =
            url.searchParams
                .get("cultivationIds")
                ?.split(",")
                .filter(Boolean) ?? []
        const cultivationNames = cultivationIds
            .map(
                (b_lu_catalogue) =>
                    catalogueCultivations.find(
                        (c) => c.b_lu_catalogue === b_lu_catalogue,
                    )?.b_lu_name,
            )
            .filter((v) => v)
            .sort()

        // Return user information from loader
        return {
            b_id_farm: params.b_id_farm,
            farmOptions: farmOptions,
            fieldAmount: selectedFieldIds.length,
            fertilizerOptions: fertilizerOptions,
            calendar: calendar,
            selectedFieldIds: selectedFieldIds,
            fieldOptions: fieldOptions.map((field) => ({
                b_id: field.b_id,
                b_name: field.b_name,
                b_area: field.b_area,
                cultivations: field.cultivations,
            })), // All fields for selection
            cultivationNames: cultivationNames,
            cultivationIds: cultivationIds,
            canReselect: canReselect,
            exampleFertilizerApplication: exampleFertilizerApplication,
            fertilizerApplication: fertilizerApplication
                ? {
                      ...fertilizerApplication,
                      p_app_ids: appIds,
                  }
                : undefined,
            create: url.searchParams.has("create"),
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function FarmRotationFertilizerAddIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const navigation = useNavigation()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const [open, setOpen] = useState(false)
    const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>(
        loaderData.selectedFieldIds,
    )

    useEffect(() => {
        setSelectedFieldIds(loaderData.selectedFieldIds)
    }, [loaderData.selectedFieldIds])

    const isSubmitting = navigation.state === "submitting"

    const handleSelectionChange = () => {
        const newSearchParams = new URLSearchParams(searchParams)
        newSearchParams.set("fieldIds", selectedFieldIds.join(","))
        newSearchParams.set(
            "cultivationIds",
            loaderData.cultivationIds.join(","),
        )
        setSearchParams(newSearchParams, { preventScrollReset: true })
        setOpen(false)
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
        selectedFieldIds.includes(field.b_id),
    )

    function handleSelectionDialogOpenChange(open: boolean) {
        if (!open) {
            handleSelectionChange()
        }
        setOpen(open)
    }

    return (
        <SidebarInset>
            <Header
                action={{
                    to: loaderData.create
                        ? `/farm/create/${loaderData.b_id_farm}/${loaderData.calendar}/rotation`
                        : `/farm/${loaderData.b_id_farm}/${loaderData.calendar}/rotation`,
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
                    Bemesting toevoegen
                </BreadcrumbItem>
            </Header>
            <main>
                <FarmTitle
                    title={`Bemesting toevoegen aan ${loaderData.cultivationNames.join(", ")}`}
                    description="Kies 1 of meerdere percelen om een bemesting toe te voegen"
                />
                <div className="relative">
                    {isSubmitting && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                            <div className="flex items-center text-sm text-muted-foreground">
                                <Spinner className="mr-2" />
                                <span>Bemesting wordt toegevoegd...</span>
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
                                        De bemesting wordt toegepast op de
                                        volgende percelen.
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
                                                <NavLink
                                                    to={`/farm/${loaderData.b_id_farm}/${loaderData.calendar}/rotation`}
                                                >
                                                    Naar bouwplanoverzicht
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
                                                    de bemesting.
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
                                                <div>
                                                    <Accordion
                                                        type="single"
                                                        collapsible
                                                        className="space-y-2"
                                                    >
                                                        <AccordionItem value="item-1">
                                                            <AccordionTrigger>
                                                                <span className="text-sm font-semibold">
                                                                    Percelen
                                                                    zonder{" "}
                                                                    {loaderData
                                                                        .cultivationNames
                                                                        .length ===
                                                                    1
                                                                        ? loaderData
                                                                              .cultivationNames[0]
                                                                        : "deze gewassen"}
                                                                </span>
                                                            </AccordionTrigger>
                                                            <AccordionContent>
                                                                <div className="max-h-[30vh] space-y-2 overflow-y-auto rounded-md border p-2">
                                                                    {loaderData.fieldOptions
                                                                        .filter(
                                                                            (
                                                                                field,
                                                                            ) =>
                                                                                !field.cultivations.some(
                                                                                    (
                                                                                        c,
                                                                                    ) =>
                                                                                        loaderData.cultivationIds.includes(
                                                                                            c,
                                                                                        ),
                                                                                ),
                                                                        )
                                                                        .map(
                                                                            (
                                                                                field,
                                                                            ) => (
                                                                                <div
                                                                                    key={
                                                                                        field.b_id
                                                                                    }
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
                                                                            ),
                                                                        )}
                                                                </div>
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    </Accordion>
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
                                    <CardTitle>Bemesting toevoegen</CardTitle>
                                    <CardDescription>
                                        {loaderData.fieldAmount === 0
                                            ? "Selecteer eerst een of meerdere percelen."
                                            : loaderData.fieldAmount === 1
                                              ? "Voeg een nieuwe bemestingstoepassing toe aan het geselecteerde perceel."
                                              : `Voeg een nieuwe bemestingstoepassing toe aan de ${loaderData.fieldAmount} geselecteerde percelen.`}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loaderData.fieldAmount > 0 ? (
                                        <FertilizerApplicationForm
                                            options={
                                                loaderData.fertilizerOptions
                                            }
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
                                            navigation={navigation}
                                            b_id_farm={loaderData.b_id_farm}
                                            b_id_or_b_lu_catalogue={
                                                searchParams.get(
                                                    "cultivationIds",
                                                ) || "cultivationIds"
                                            }
                                            fertilizerApplication={
                                                loaderData.fertilizerApplication
                                            }
                                            exampleFertilizerApplication={
                                                loaderData.exampleFertilizerApplication
                                            }
                                            schema={
                                                loaderData.exampleFertilizerApplication
                                                    ? FormSchemaPartialModify
                                                    : FormSchemaModify
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
            </main>
        </SidebarInset>
    )
}

export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const { b_id_farm, calendar = "all" } = params

        const session = await getSession(request)
        const url = new URL(request.url)

        const returnUrlParam = url.searchParams.get("returnUrl")
        const returnUrl =
            returnUrlParam && isOfOrigin(returnUrlParam, url.origin)
                ? returnUrlParam
                : url.searchParams.has("create")
                  ? `/farm/create/${b_id_farm}/${calendar}/rotation`
                  : `/farm/${b_id_farm}/${calendar}/rotation`

        if (url.searchParams.has("appIds")) {
            const validatedData = await extractFormValuesFromRequest(
                request,
                FormSchemaPartialModify,
            )

            const p_app_ids = validatedData.p_app_id.split(",").filter(Boolean)
            await fdm.transaction((tx) =>
                Promise.all(
                    p_app_ids.map(async (p_app_id) => {
                        const original = await getFertilizerApplication(
                            tx,
                            session.principal_id,
                            p_app_id,
                        )

                        if (!original) {
                            throw new Error(
                                `Application ${p_app_id} not found.`,
                            )
                        }

                        return updateFertilizerApplication(
                            tx,
                            session.principal_id,
                            p_app_id,
                            validatedData.p_id ?? original.p_id,
                            validatedData.p_app_amount,
                            validatedData.p_app_method,
                            validatedData.p_app_date,
                        )
                    }),
                ),
            )

            return redirectWithSuccess(returnUrl, {
                message: `${p_app_ids.length} ${p_app_ids.length === 1 ? "bemesting is" : "bemestingen zijn"} succesvol bijgewerkt.`,
            })
        }

        const validatedData = await extractFormValuesFromRequest(
            request,
            FormSchema,
        )

        const fieldIds =
            url.searchParams.get("fieldIds")?.split(",").filter(Boolean) ?? []

        if (!fieldIds || fieldIds.length === 0) {
            return dataWithError(null, "Selecteer eerst een perceel.")
        }

        await fdm.transaction((tx) =>
            Promise.all(
                fieldIds.map((fieldId) =>
                    addFertilizerApplication(
                        tx,
                        session.principal_id,
                        fieldId,
                        validatedData.p_id,
                        validatedData.p_app_amount,
                        validatedData.p_app_method,
                        validatedData.p_app_date,
                    ),
                ),
            ),
        )

        return redirectWithSuccess(returnUrl, {
            message: `Bemesting succesvol toegevoegd aan ${fieldIds.length} ${fieldIds.length === 1 ? "perceel" : "percelen"}.`,
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
