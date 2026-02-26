import {
    addFertilizerApplication,
    type FertilizerApplication,
    getFarms,
    getFertilizerApplication,
    getFertilizerParametersDescription,
    getFertilizers,
    getFields,
    updateFertilizerApplication,
} from "@nmi-agro/fdm-core"
import { Info } from "lucide-react"
import { useState } from "react"
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
import { FertilizerApplicationForm } from "~/components/blocks/fertilizer-applications/form"
import {
    FormSchema,
    FormSchemaPartialModify,
} from "~/components/blocks/fertilizer-applications/formschema"
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
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { parseAppIds } from "../lib/fertilizer-application-helpers"
import { isOfOrigin } from "../lib/url-utils"

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

        const url = new URL(request.url)

        // Get appIds from search params
        const applicationRefs = parseAppIds(
            url.searchParams.get("appIds") ?? "",
        )
        if (url.searchParams.has("appIds") && applicationRefs.length === 0) {
            throw data("invalid: appIds", {
                status: 400,
                statusText: "invalid: appIds",
            })
        }

        // Get fieldIds either from appIds or from search params
        const fieldIds =
            applicationRefs.length > 0
                ? [...new Set(applicationRefs.map((ref) => ref.b_id))]
                : (url.searchParams
                      .get("fieldIds")
                      ?.split(",")
                      .filter(Boolean) ?? [])

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

        // Get the fields to be selected
        const fields = await getFields(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )
        const selectedFields = fields.filter(
            (field) => field.b_id && fieldIds.includes(field.b_id),
        )

        const fieldOptions = fields.map((field) => {
            if (!field?.b_id || !field?.b_name) {
                throw new Error("Invalid field data structure")
            }
            return {
                b_id: field.b_id,
                b_name: field.b_name,
                b_area: Math.round(field.b_area * 10) / 10,
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
            (x) => x.parameter === "p_app_method_options",
        )
        if (!applicationMethods) throw new Error("Parameter metadata missing")
        // Map fertilizers to options for the combobox
        const fertilizerOptions = fertilizers.map((fertilizer) => {
            const applicationMethodOptions = fertilizer.p_app_method_options
                .map((opt) => {
                    const meta = applicationMethods.options.find(
                        (x) => x.value === opt,
                    )
                    return meta ? { value: opt, label: meta.label } : undefined
                })
                .filter(
                    (option): option is { value: string; label: string } =>
                        option !== undefined,
                )
            return {
                value: fertilizer.p_id,
                label: fertilizer.p_name_nl,
                applicationMethodOptions: applicationMethodOptions,
            }
        })

        // Get the necessary date to render the modify fertilizer form
        let loaderExampleFertilizerApplication:
            | Partial<z.infer<typeof FormSchemaPartialModify>>
            | undefined
        let fertilizerApplication:
            | Partial<z.infer<typeof FormSchemaPartialModify>>
            | undefined
        if (applicationRefs.length > 0) {
            const fertilizerApplications = await Promise.all(
                applicationRefs.map(async ({ p_app_id }) => {
                    const app = await getFertilizerApplication(
                        fdm,
                        session.principal_id,
                        p_app_id,
                    )

                    if (!app) {
                        throw new Error(`Application ${p_app_id} not found`)
                    }

                    return app
                }),
            )

            const exampleFertilizerApplication: Partial<FertilizerApplication> =
                {
                    ...fertilizerApplications[0],
                }

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
                    // If the value is missing for this application, clear the value on the initial form data
                    if (
                        exampleFertilizerApplication[key] === null ||
                        typeof exampleFertilizerApplication[key] ===
                            "undefined" ||
                        app[key] === null ||
                        typeof app[key] === "undefined"
                    ) {
                        delete fertilizerApplication[key]
                        continue
                    }

                    if (keyTypes[key] === "number") {
                        // If the value is too different from the initial app, consider them to be different
                        // The outcome of this actually depends on the ordering of the applications, but it is fine
                        // The previous route is supposed to sort the applications, so the outcome should be stable at least
                        const a = app[key] as number
                        const b = exampleFertilizerApplication[key] as number
                        if (a !== b && Math.abs(a - b) > Math.abs(b) / 100) {
                            delete fertilizerApplication[key]
                        }
                    } else if (
                        keyTypes[key] === "date" &&
                        (
                            exampleFertilizerApplication[key] as Date
                        ).getTime() !== (app[key] as Date).getTime()
                    ) {
                        // If it is not the same date they are different
                        delete fertilizerApplication[key]
                    } else if (exampleFertilizerApplication[key] !== app[key]) {
                        // Any other type of value is compared using !==
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

            loaderExampleFertilizerApplication = exampleFertilizerApplication
        }

        const loaderFertilizerApplication = fertilizerApplication
            ? {
                  ...fertilizerApplication,
                  p_app_ids: applicationRefs.map((ref) => ref.p_app_id),
              }
            : undefined

        // Return user information from loader
        return {
            b_id_farm: b_id_farm,
            farmOptions: farmOptions,
            fieldAmount: selectedFields.length,
            fertilizerOptions: fertilizerOptions,
            calendar: calendar,
            selectedFields: selectedFields.map((field) => ({
                b_id: field.b_id,
                b_name: field.b_name,
                b_area: Math.round(field.b_area * 10) / 10,
            })),
            fieldOptions: fieldOptions,
            fertilizerApplication: loaderFertilizerApplication,
            exampleFertilizerApplication: loaderExampleFertilizerApplication,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function FarmFieldFertilizerAddIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const navigation = useNavigation()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const [open, setOpen] = useState(false)
    const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>(
        loaderData.selectedFields.map((f) => f.b_id!),
    )

    const isSubmitting = navigation.state === "submitting"

    const handleSelectionChange = () => {
        const newSearchParams = new URLSearchParams(searchParams)
        newSearchParams.set("fieldIds", selectedFieldIds.join(","))
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

    const isModification = !!loaderData.fertilizerApplication?.p_app_ids
    const canReselect = !isModification

    return (
        <SidebarInset>
            <Header
                action={{
                    to: `/farm/${loaderData.b_id_farm}/${loaderData.calendar}/field`,
                    label: "Terug naar percelen",
                    disabled: false,
                }}
            >
                <HeaderFarm
                    b_id_farm={loaderData.b_id_farm}
                    farmOptions={loaderData.farmOptions}
                />
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem className="hidden md:block">
                    Percelen
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem className="hidden md:block">
                    {isModification
                        ? "Bemesting wijzigen"
                        : "Bemesting toevoegen"}
                </BreadcrumbItem>
            </Header>
            <main>
                <FarmTitle
                    title={
                        isModification
                            ? "Bemesting wijzigen"
                            : "Bemesting toevoegen"
                    }
                    description={
                        isModification
                            ? "Bemesting wijzigen op 1 of meerdere percelen."
                            : "Kies 1 of meerdere percelen om een bemesting toe te voegen"
                    }
                />
                <div className="relative">
                    {isSubmitting && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                            <div className="flex items-center text-sm text-muted-foreground">
                                <Spinner className="mr-2" />
                                <span>
                                    {isModification
                                        ? "Bemesting wordt gewijzigd..."
                                        : "Bemesting wordt toegevoegd..."}
                                </span>
                            </div>
                        </div>
                    )}
                    <FarmContent>
                        <div className="flex flex-col xl:flex-row gap-6 pb-10">
                            <Card className="w-full xl:w-64 h-fit shrink-0">
                                <CardHeader>
                                    <CardTitle>
                                        Geselecteerde percelen
                                    </CardTitle>
                                    <CardDescription>
                                        {`De bemesting wordt ${isModification ? "gewijzigd" : "toegepast"} op de volgende percelen.`}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loaderData.selectedFields.length > 0 ? (
                                        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                                            {loaderData.selectedFields.map(
                                                (field) => (
                                                    <div
                                                        key={field.b_id}
                                                        className="flex items-center justify-between rounded-md border p-3 gap-2"
                                                    >
                                                        <p className="text-sm font-medium truncate min-w-0">
                                                            {field.b_name}
                                                        </p>
                                                        <Badge
                                                            variant="secondary"
                                                            className="shrink-0"
                                                        >
                                                            {field.b_area} ha
                                                        </Badge>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex h-full min-h-[24rem] flex-col items-center justify-center rounded-md border border-dashed text-center">
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
                                                    to={`/farm/${loaderData.b_id_farm}/${loaderData.calendar}/field`}
                                                >
                                                    Naar percelenoverzicht
                                                </NavLink>
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter>
                                    <Dialog open={open} onOpenChange={setOpen}>
                                        {canReselect && (
                                            <DialogTrigger asChild>
                                                <Button
                                                    variant="secondary"
                                                    className="w-full"
                                                >
                                                    Wijzig selectie
                                                </Button>
                                            </DialogTrigger>
                                        )}
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
                                                <div className="max-h-[60vh] space-y-2 overflow-y-auto rounded-md border p-2">
                                                    {loaderData.fieldOptions.map(
                                                        (field) => (
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
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button
                                                    type="button"
                                                    onClick={
                                                        handleSelectionChange
                                                    }
                                                >
                                                    Selectie bijwerken
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </CardFooter>
                            </Card>
                            <Card className="flex-1">
                                <CardHeader>
                                    <CardTitle>
                                        {isModification
                                            ? "Bemesting wijzigen"
                                            : "Bemesting toevoegen"}
                                    </CardTitle>
                                    <CardDescription>
                                        {loaderData.fieldAmount === 0
                                            ? "Selecteer eerst een of meerdere percelen."
                                            : isModification
                                              ? loaderData.fieldAmount === 1
                                                  ? "Wijzig de bemesting van het geselecteerde perceel."
                                                  : `Wijzig de bemesting van de ${loaderData.fieldAmount} geselecteerde percelen.`
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
                                            action={`${location.pathname}${location.search}`}
                                            navigation={navigation}
                                            b_id_farm={loaderData.b_id_farm}
                                            b_id_or_b_lu_catalogue={
                                                searchParams.get("fieldIds") ||
                                                ""
                                            }
                                            fertilizerApplication={
                                                loaderData.fertilizerApplication
                                            }
                                            exampleFertilizerApplication={
                                                loaderData.exampleFertilizerApplication
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
        if (!b_id_farm) {
            throw new Error("Farm ID is missing")
        }

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
                            validatedData.p_app_amount ?? original.p_app_amount,
                            validatedData.p_app_method ?? original.p_app_method,
                            validatedData.p_app_date ?? original.p_app_date,
                        )
                    }),
                ),
            )

            return redirectWithSuccess(returnUrl, {
                message: `${p_app_ids.length} ${p_app_ids.length === 1 ? "bemesting is" : "bemestingen zijn"} succesvol bijgewerkt.`,
            })
        }

        const fieldIds = [
            ...new Set(
                url.searchParams.get("fieldIds")?.split(",").filter(Boolean) ??
                    [],
            ),
        ]
        if (!fieldIds || fieldIds.length === 0) {
            return dataWithError(null, "Selecteer eerst een perceel.")
        }

        const validatedData = await extractFormValuesFromRequest(
            request,
            FormSchema,
        )

        fdm.transaction((tx) =>
            Promise.all(
                fieldIds.map((b_id) =>
                    addFertilizerApplication(
                        tx,
                        session.principal_id,
                        b_id,
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
