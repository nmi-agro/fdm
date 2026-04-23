import {
    addFertilizerApplication,
    getCultivations,
    getCultivationsFromCatalogue,
    getFarms,
    getFertilizerParametersDescription,
    getFertilizers,
    getFields,
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
import { dataWithError, redirectWithSuccess } from "remix-toast"
import { z } from "zod"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import {
    FertilizerApplicationForm,
    type FertilizerOption,
} from "~/components/blocks/fertilizer-applications/form"
import { FormSchema } from "~/components/blocks/fertilizer-applications/formschema"
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
import { modifySearchParams } from "~/lib/url-utils"

export const meta: MetaFunction = () => {
    return [
        { title: `Bemesting toevoegen | ${clientConfig.name}` },
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
                    cultivations: cultivations.map((c) => c.b_lu_catalogue),
                }
            }),
        )

        // Get fieldIds from search params (if any)
        const fieldIdsFromSearchParams =
            url.searchParams.get("fieldIds")?.split(",").filter(Boolean) ?? null

        // Filter fields based on cultivationIds or fieldIdsFromSearchParams
        let selectedFields = []
        let cultivationName = ""
        let cultivationCatalogueData = []

        if (cultivationIds.length > 0) {
            cultivationCatalogueData = await getCultivationsFromCatalogue(
                fdm,
                session.principal_id,
                b_id_farm,
            )

            const targetCultivation = cultivationCatalogueData.find(
                (c: { b_lu_catalogue: string }) =>
                    c.b_lu_catalogue === cultivationIds[0],
            )

            if (targetCultivation) {
                cultivationName = targetCultivation.b_lu_name
            }

            if (fieldIdsFromSearchParams) {
                // If fieldIds are in search params, use them to determine selected fields
                selectedFields =
                    fieldIdsFromSearchParams.length > 0
                        ? allFieldsWithCultivations.filter((field) =>
                              fieldIdsFromSearchParams.includes(field.b_id!),
                          )
                        : []
            } else {
                // Otherwise, default to fields with the selected cultivation
                selectedFields = allFieldsWithCultivations.filter((field) =>
                    field.cultivations.some((c) => cultivationIds.includes(c)),
                )
            }
        } else {
            throw data("missing: cultivationIds", {
                status: 400,
                statusText: "missing: cultivationIds",
            })
        }

        const fieldOptions = allFieldsWithCultivations.map((field) => {
            if (!field?.b_id || !field?.b_name) {
                throw new Error("Invalid field data structure")
            }
            return {
                b_id: field.b_id,
                b_name: field.b_name,
                b_area: Math.round(field.b_area * 10) / 10,
                cultivations: field.cultivations, // Pass cultivations for each field
            }
        })

        // Get available fertilizers for the farm
        const fertilizers = await getFertilizers(
            fdm,
            session.principal_id,
            b_id_farm,
        )
        const fertilizerParameterDescription =
            getFertilizerParametersDescription()
        const applicationMethods = fertilizerParameterDescription.find(
            (x: { parameter: string }) =>
                x.parameter === "p_app_method_options",
        )
        if (!applicationMethods) throw new Error("Parameter metadata missing")
        // Map fertilizers to options for the combobox
        const fertilizerOptions: FertilizerOption[] = fertilizers.map(
            (fertilizer) => {
                const applicationMethodOptions = fertilizer.p_app_method_options
                    .map((opt: string) => {
                        const meta = applicationMethods.options.find(
                            (x: { value: string }) => x.value === opt,
                        )
                        return meta
                            ? { value: opt, label: meta.label }
                            : undefined
                    })
                    .filter(
                        (option: {
                            value: string
                            label: string
                        }): option is { value: string; label: string } =>
                            option !== undefined,
                    )
                return {
                    value: fertilizer.p_id,
                    label: fertilizer.p_name_nl,
                    applicationMethodOptions: applicationMethodOptions,
                    p_app_amount_unit: fertilizer.p_app_amount_unit,
                }
            },
        )

        // Return user information from loader
        return {
            b_id_farm: b_id_farm,
            farmOptions: farmOptions,
            fieldAmount: selectedFields.length,
            fertilizerOptions: fertilizerOptions,
            calendar: calendar,
            selectedFields: selectedFields.map(
                (field: {
                    b_id: string
                    b_name: string
                    b_area: number
                    cultivations: string[]
                }) => ({
                    b_id: field.b_id,
                    b_name: field.b_name,
                    b_area: Math.round(field.b_area * 10) / 10,
                    cultivations: field.cultivations,
                }),
            ),
            fieldOptions: fieldOptions.map(
                (field: {
                    b_id: string
                    b_name: string
                    b_area: number
                    cultivations: string[]
                }) => ({
                    b_id: field.b_id,
                    b_name: field.b_name,
                    b_area: field.b_area,
                    cultivations: field.cultivations,
                }),
            ), // All fields for selection
            cultivationName: cultivationName,
            cultivationIds: cultivationIds,
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
        loaderData.selectedFields.map((field) => field.b_id!),
    )

    useEffect(() => {
        setSelectedFieldIds(
            loaderData.selectedFields.map((field) => field.b_id!),
        )
    }, [loaderData.selectedFields])

    const isSubmitting =
        navigation.state !== "idle" && Boolean(navigation.formData)

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
        selectedFieldIds.includes(field.b_id!),
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
                    title={`Bemesting toevoegen aan ${loaderData.cultivationName}`}
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
                                                                    {
                                                                        loaderData.cultivationName
                                                                    }
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
                                            fertilizerApplication={undefined}
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
        if (!b_id_farm) {
            throw new Error("Farm ID is missing")
        }

        const session = await getSession(request)
        const url = new URL(request.url)
        const fieldIds =
            url.searchParams.get("fieldIds")?.split(",").filter(Boolean) ?? []

        if (!fieldIds || fieldIds.length === 0) {
            return dataWithError(null, "Selecteer eerst een perceel.")
        }

        const validatedData = await extractFormValuesFromRequest(
            request,
            FormSchema,
        )

        await Promise.all(
            fieldIds.map((fieldId) =>
                addFertilizerApplication(
                    fdm,
                    session.principal_id,
                    fieldId,
                    validatedData.p_id,
                    validatedData.p_app_amount_display,
                    validatedData.p_app_method,
                    validatedData.p_app_date,
                ),
            ),
        )

        return redirectWithSuccess(
            url.searchParams.has("create")
                ? `/farm/create/${b_id_farm}/${calendar}/rotation`
                : `/farm/${b_id_farm}/${calendar}/rotation`,
            {
                message: `Bemesting succesvol toegevoegd aan ${fieldIds.length} ${fieldIds.length === 1 ? "perceel" : "percelen"}.`,
            },
        )
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
