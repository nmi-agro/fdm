import { zodResolver } from "@hookform/resolvers/zod"
import {
    addDerogation,
    addFarm,
    addFertilizer,
    addOrganicCertification,
    enableCultivationCatalogue,
    enableFertilizerCatalogue,
    getFertilizersFromCatalogue,
    setGrazingIntention,
} from "@nmi-agro/fdm-core"
import { useEffect } from "react"
import { Controller, type Resolver } from "react-hook-form"
import type {
    ActionFunctionArgs,
    LoaderFunctionArgs,
    MetaFunction,
} from "react-router"
import { Form, useLoaderData } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { redirectWithSuccess } from "remix-toast"
import { z } from "zod"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarmCreate } from "~/components/blocks/header/create-farm"
import { DatePicker } from "~/components/custom/date-picker-v2"
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
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { SidebarInset } from "~/components/ui/sidebar"
import { Spinner } from "~/components/ui/spinner"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { getCalendarSelection } from "../lib/calendar"

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `Bedrijf toevoegen | ${clientConfig.name}` },
        {
            name: "description",
            content: "Voeg een nieuw bedrijf toe.",
        },
    ]
}

const FormSchema = z
    .object({
        b_name_farm: z
            .string({
                error: (issue) =>
                    issue.input === undefined
                        ? "Naam van bedrijf is verplicht"
                        : undefined,
            })
            .trim()
            .min(3, {
                error: "Naam van bedrijf moet minimaal 3 karakters bevatten",
            }),
        year: z.coerce.number({
            error: (issue) =>
                issue.input === undefined
                    ? "Jaar is verplicht"
                    : "Jaar moet een getal zijn",
        }),
        b_businessid_farm: z
            .string()
            .trim()
            .regex(/^\d{8}$/, "KvK-nummer moet uit 8 cijfers bestaan")
            .optional()
            .or(z.string().trim().length(0)),
        has_derogation: z.coerce.boolean().default(false),
        derogation_start_year: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .min(2006, {
                    error: "Startjaar moet minimaal 2006 zijn",
                })
                .max(2025, {
                    error: "Startjaar mag maximaal 2025 zijn",
                })
                .optional(),
        ),
        grazing_intention: z.coerce.boolean().default(false),
        organic_certification: z.coerce.boolean().default(false),
        organic_skal: z.string().trim().optional(),
        organic_traces: z.string().trim().optional(),
        organic_issued: z.coerce.date().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.organic_certification) {
            if (data.organic_skal && !/^\d{6}$/.test(data.organic_skal)) {
                ctx.addIssue({
                    code: "custom",
                    message: "Ongeldig SKAL-nummer",
                    path: ["organic_skal"],
                })
            }
            if (
                data.organic_traces &&
                !/^NL-BIO-\d{2}\.\d{3}-\d{7}\.\d{4}\.\d{3}$/.test(
                    data.organic_traces,
                )
            ) {
                ctx.addIssue({
                    code: "custom",
                    message: "Ongeldig TRACES-nummer",
                    path: ["organic_traces"],
                })
            }
        }
    })

type FormValues = z.infer<typeof FormSchema>

// Loader
export async function loader() {
    const yearSelection = getCalendarSelection()

    return {
        year: new Date().getFullYear(),
        yearSelection: yearSelection,
    }
}

/**
 * Default component for the Add Farm page.
 * Renders the farm form and passes the validation schema to the Farm component.
 * @returns The JSX element representing the add farm page.
 */
export default function AddFarmPage() {
    const { year, yearSelection } = useLoaderData<typeof loader>()

    const form = useRemixForm<FormValues>({
        mode: "onTouched",
        resolver: zodResolver(FormSchema) as Resolver<FormValues>,
        defaultValues: {
            b_name_farm: "",
            year: year,
            b_businessid_farm: "",
            has_derogation: false,
            derogation_start_year: 2025,
            grazing_intention: false,
            organic_certification: false,
            organic_skal: "",
            organic_traces: "",
        },
    })

    const selectedYear = form.watch("year")
    const organicCertified = form.watch("organic_certification")
    const isDerogationPossible = Number(selectedYear) < 2026

    // Set default organic issued date when certification is checked
    // biome-ignore lint/correctness/useExhaustiveDependencies: form.setValue and form.getValues are stable
    useEffect(() => {
        if (organicCertified && !form.getValues("organic_issued")) {
            form.setValue(
                "organic_issued",
                new Date(Number(selectedYear), 0, 1),
            )
        } else if (!organicCertified) {
            form.setValue("organic_issued", undefined)
        }
    }, [organicCertified, selectedYear])

    // Reset derogation when year >= 2026
    // biome-ignore lint/correctness/useExhaustiveDependencies: form.setValue is stable
    useEffect(() => {
        if (Number(selectedYear) >= 2026) {
            form.setValue("has_derogation", false)
        }
    }, [selectedYear])

    return (
        <SidebarInset>
            <Header action={undefined}>
                <HeaderFarmCreate b_name_farm={undefined} />
            </Header>
            <main className="flex-1 overflow-y-auto bg-muted/20">
                <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-4 lg:grid-cols-3 lg:p-8">
                    {/* Left Column: Form */}
                    <div className="lg:col-span-2">
                        <Card className="w-full">
                            <RemixFormProvider {...form}>
                                <Form
                                    id="formFarm"
                                    onSubmit={form.handleSubmit}
                                    method="POST"
                                >
                                    <fieldset
                                        disabled={form.formState.isSubmitting}
                                    >
                                        <CardHeader>
                                            <CardTitle>
                                                Bedrijf toevoegen
                                            </CardTitle>
                                            <CardDescription>
                                                Voer de basisgegevens van je
                                                bedrijf in.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            {/* General Information */}
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="sm:col-span-2">
                                                    <Controller
                                                        control={form.control}
                                                        name="b_name_farm"
                                                        render={({
                                                            field,
                                                            fieldState,
                                                        }) => (
                                                            <Field
                                                                data-invalid={
                                                                    fieldState.invalid
                                                                }
                                                            >
                                                                <FieldLabel>
                                                                    Bedrijfsnaam
                                                                </FieldLabel>
                                                                <Input
                                                                    placeholder="Bv. Jansen V.O.F."
                                                                    aria-required="true"
                                                                    {...field}
                                                                />
                                                                {fieldState.invalid && (
                                                                    <FieldError
                                                                        errors={[
                                                                            fieldState.error,
                                                                        ]}
                                                                    />
                                                                )}
                                                            </Field>
                                                        )}
                                                    />
                                                </div>

                                                <Controller
                                                    control={form.control}
                                                    name="year"
                                                    render={({
                                                        field,
                                                        fieldState,
                                                    }) => (
                                                        <Field
                                                            data-invalid={
                                                                fieldState.invalid
                                                            }
                                                        >
                                                            <FieldLabel>
                                                                Kalenderjaar
                                                            </FieldLabel>
                                                            <Select
                                                                onValueChange={
                                                                    field.onChange
                                                                }
                                                                defaultValue={field.value.toString()}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Selecteer een jaar" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {yearSelection.map(
                                                                        (
                                                                            yearOption: string,
                                                                        ) => (
                                                                            <SelectItem
                                                                                key={
                                                                                    yearOption
                                                                                }
                                                                                value={
                                                                                    yearOption
                                                                                }
                                                                            >
                                                                                {
                                                                                    yearOption
                                                                                }
                                                                            </SelectItem>
                                                                        ),
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                            <FieldDescription>
                                                                Startjaar voor
                                                                invoer.
                                                            </FieldDescription>
                                                            {fieldState.invalid && (
                                                                <FieldError
                                                                    errors={[
                                                                        fieldState.error,
                                                                    ]}
                                                                />
                                                            )}
                                                        </Field>
                                                    )}
                                                />

                                                <Controller
                                                    control={form.control}
                                                    name="b_businessid_farm"
                                                    render={({
                                                        field,
                                                        fieldState,
                                                    }) => (
                                                        <Field
                                                            data-invalid={
                                                                fieldState.invalid
                                                            }
                                                        >
                                                            <FieldLabel>
                                                                KvK-nummer
                                                            </FieldLabel>
                                                            <Input
                                                                placeholder="12345678"
                                                                {...field}
                                                            />
                                                            {fieldState.invalid && (
                                                                <FieldError
                                                                    errors={[
                                                                        fieldState.error,
                                                                    ]}
                                                                />
                                                            )}
                                                        </Field>
                                                    )}
                                                />
                                            </div>

                                            <div className="space-y-6">
                                                <div className="border-t pt-4">
                                                    <h3 className="font-medium mb-4 text-base">
                                                        Instellingen
                                                    </h3>
                                                    <div className="grid gap-4 sm:grid-cols-2">
                                                        {/* Derogation Section */}
                                                        {isDerogationPossible && (
                                                            <div className="rounded-lg border p-4 sm:col-span-2">
                                                                <div className="space-y-4">
                                                                    <Controller
                                                                        control={
                                                                            form.control
                                                                        }
                                                                        name="has_derogation"
                                                                        render={({
                                                                            field,
                                                                            fieldState,
                                                                        }) => (
                                                                            <Field
                                                                                orientation="horizontal"
                                                                                className="justify-between items-center"
                                                                                data-invalid={
                                                                                    fieldState.invalid
                                                                                }
                                                                            >
                                                                                <FieldLabel className="text-base font-normal">
                                                                                    Heeft
                                                                                    dit
                                                                                    bedrijf
                                                                                    derogatie?
                                                                                </FieldLabel>
                                                                                <Checkbox
                                                                                    checked={
                                                                                        field.value
                                                                                    }
                                                                                    onCheckedChange={
                                                                                        field.onChange
                                                                                    }
                                                                                />
                                                                            </Field>
                                                                        )}
                                                                    />
                                                                    {form.watch(
                                                                        "has_derogation",
                                                                    ) && (
                                                                        <Controller
                                                                            control={
                                                                                form.control
                                                                            }
                                                                            name="derogation_start_year"
                                                                            render={({
                                                                                field,
                                                                                fieldState,
                                                                            }) => (
                                                                                <Field
                                                                                    data-invalid={
                                                                                        fieldState.invalid
                                                                                    }
                                                                                >
                                                                                    <FieldLabel>
                                                                                        Startjaar
                                                                                    </FieldLabel>
                                                                                    <Select
                                                                                        onValueChange={
                                                                                            field.onChange
                                                                                        }
                                                                                        defaultValue={String(
                                                                                            field.value,
                                                                                        )}
                                                                                    >
                                                                                        <SelectTrigger>
                                                                                            <SelectValue placeholder="Selecteer een jaar" />
                                                                                        </SelectTrigger>
                                                                                        <SelectContent>
                                                                                            {Array.from(
                                                                                                {
                                                                                                    length:
                                                                                                        2025 -
                                                                                                        2006 +
                                                                                                        1,
                                                                                                },
                                                                                                (
                                                                                                    _,
                                                                                                    i,
                                                                                                ) =>
                                                                                                    2006 +
                                                                                                    i,
                                                                                            ).map(
                                                                                                (
                                                                                                    year,
                                                                                                ) => (
                                                                                                    <SelectItem
                                                                                                        key={
                                                                                                            year
                                                                                                        }
                                                                                                        value={String(
                                                                                                            year,
                                                                                                        )}
                                                                                                    >
                                                                                                        {
                                                                                                            year
                                                                                                        }
                                                                                                    </SelectItem>
                                                                                                ),
                                                                                            )}
                                                                                        </SelectContent>
                                                                                    </Select>
                                                                                    {fieldState.invalid && (
                                                                                        <FieldError
                                                                                            errors={[
                                                                                                fieldState.error,
                                                                                            ]}
                                                                                        />
                                                                                    )}
                                                                                </Field>
                                                                            )}
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Grazing Section */}
                                                        <div className="rounded-lg border p-4 sm:col-span-2">
                                                            <Controller
                                                                control={
                                                                    form.control
                                                                }
                                                                name="grazing_intention"
                                                                render={({
                                                                    field,
                                                                    fieldState,
                                                                }) => (
                                                                    <Field
                                                                        orientation="horizontal"
                                                                        className="justify-between items-center"
                                                                        data-invalid={
                                                                            fieldState.invalid
                                                                        }
                                                                    >
                                                                        <FieldLabel className="text-base font-normal">
                                                                            Is
                                                                            er
                                                                            een
                                                                            voornemen
                                                                            tot
                                                                            weiden?
                                                                        </FieldLabel>
                                                                        <Checkbox
                                                                            checked={
                                                                                field.value
                                                                            }
                                                                            onCheckedChange={
                                                                                field.onChange
                                                                            }
                                                                        />
                                                                    </Field>
                                                                )}
                                                            />
                                                        </div>

                                                        {/* Organic Section */}
                                                        <div className="rounded-lg border p-4 sm:col-span-2">
                                                            <div className="space-y-4">
                                                                <Controller
                                                                    control={
                                                                        form.control
                                                                    }
                                                                    name="organic_certification"
                                                                    render={({
                                                                        field,
                                                                        fieldState,
                                                                    }) => (
                                                                        <Field
                                                                            orientation="horizontal"
                                                                            className="justify-between items-center"
                                                                            data-invalid={
                                                                                fieldState.invalid
                                                                            }
                                                                        >
                                                                            <FieldLabel className="text-base font-normal">
                                                                                Is
                                                                                het
                                                                                bedrijf
                                                                                biologisch
                                                                                gecertificeerd?
                                                                            </FieldLabel>
                                                                            <Checkbox
                                                                                checked={
                                                                                    field.value
                                                                                }
                                                                                onCheckedChange={
                                                                                    field.onChange
                                                                                }
                                                                            />
                                                                        </Field>
                                                                    )}
                                                                />
                                                                {organicCertified && (
                                                                    <div className="space-y-4 pt-2">
                                                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                                            <Controller
                                                                                control={
                                                                                    form.control
                                                                                }
                                                                                name="organic_skal"
                                                                                render={({
                                                                                    field,
                                                                                    fieldState,
                                                                                }) => (
                                                                                    <Field
                                                                                        data-invalid={
                                                                                            fieldState.invalid
                                                                                        }
                                                                                    >
                                                                                        <FieldLabel>
                                                                                            SKAL-nummer
                                                                                        </FieldLabel>
                                                                                        <Input
                                                                                            placeholder="012345"
                                                                                            {...field}
                                                                                        />
                                                                                        <FieldDescription>
                                                                                            Optioneel
                                                                                        </FieldDescription>
                                                                                        {fieldState.invalid && (
                                                                                            <FieldError
                                                                                                errors={[
                                                                                                    fieldState.error,
                                                                                                ]}
                                                                                            />
                                                                                        )}
                                                                                    </Field>
                                                                                )}
                                                                            />
                                                                            <Controller
                                                                                control={
                                                                                    form.control
                                                                                }
                                                                                name="organic_traces"
                                                                                render={({
                                                                                    field,
                                                                                    fieldState,
                                                                                }) => (
                                                                                    <Field
                                                                                        data-invalid={
                                                                                            fieldState.invalid
                                                                                        }
                                                                                    >
                                                                                        <FieldLabel>
                                                                                            TRACES-nummer
                                                                                        </FieldLabel>
                                                                                        <Input
                                                                                            placeholder="NL-BIO-01..."
                                                                                            {...field}
                                                                                        />
                                                                                        <FieldDescription>
                                                                                            Optioneel
                                                                                        </FieldDescription>
                                                                                        {fieldState.invalid && (
                                                                                            <FieldError
                                                                                                errors={[
                                                                                                    fieldState.error,
                                                                                                ]}
                                                                                            />
                                                                                        )}
                                                                                    </Field>
                                                                                )}
                                                                            />
                                                                        </div>
                                                                        <Controller
                                                                            control={
                                                                                form.control
                                                                            }
                                                                            name="organic_issued"
                                                                            render={({
                                                                                field,
                                                                                fieldState,
                                                                            }) => (
                                                                                <DatePicker
                                                                                    label="Certificaat geldig vanaf"
                                                                                    defaultValue={
                                                                                        new Date(
                                                                                            Number(
                                                                                                selectedYear,
                                                                                            ),
                                                                                            0,
                                                                                            1,
                                                                                        )
                                                                                    }
                                                                                    field={
                                                                                        field
                                                                                    }
                                                                                    fieldState={
                                                                                        fieldState
                                                                                    }
                                                                                />
                                                                            )}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="flex justify-between">
                                            <Button
                                                variant="outline"
                                                type="button"
                                                onClick={() =>
                                                    window.history.back()
                                                }
                                            >
                                                Terug
                                            </Button>
                                            <Button type="submit">
                                                {form.formState.isSubmitting ? (
                                                    <div className="flex items-center space-x-2">
                                                        <Spinner />
                                                        <span>Opslaan...</span>
                                                    </div>
                                                ) : (
                                                    "Volgende"
                                                )}
                                            </Button>
                                        </CardFooter>
                                    </fieldset>
                                </Form>
                            </RemixFormProvider>
                        </Card>
                    </div>

                    {/* Right Column: Help & Info */}
                    <div className="space-y-6">
                        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                            <div className="flex flex-col space-y-1.5 p-6">
                                <h3 className="font-semibold leading-none tracking-tight">
                                    Maak een nieuw bedrijf aan.
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Welkom! Je kan nu een nieuw bedrijf
                                    aanmaken. In dit stappenplan leggen we uit
                                    welke data je kan invullen, zodat we je
                                    bedrijf goed hebben ingesteld voor de
                                    rekenregels.
                                </p>
                            </div>
                            <div className="p-6 pt-0 text-sm space-y-4">
                                <ol className="list-decimal pl-4 space-y-3 text-muted-foreground">
                                    <li>
                                        <strong className="text-foreground">
                                            Bedrijfsgegevens (Nu):
                                        </strong>{" "}
                                        Vul hier je bedrijfsgegevens in. Dit
                                        helpt bijvoorbeeld bij het bepalen van
                                        de gebruiksruimte.
                                        <p className="text-xs text-muted-foreground italic pt-1">
                                            Tip: Vul alvast het KvK-nummer zodat
                                            we binnenkort eenvoudig gegevens
                                            kunnen importeren.
                                        </p>
                                    </li>
                                    <li>
                                        <strong className="text-foreground">
                                            Percelen toevoegen:
                                        </strong>{" "}
                                        In de volgende stap kun je
                                        RVO-shapefiles importeren of percelen
                                        selecteren op een kaart.
                                    </li>
                                    <li>
                                        <strong className="text-foreground">
                                            Perceelseigenschappen:
                                        </strong>{" "}
                                        Check het hoofdgewas van de percelen,
                                        markeer bufferstroken en bekijk de
                                        geschatte bodemeigenschappen.
                                        <p className="text-xs text-muted-foreground italic pt-1">
                                            Tip: Je kunt de pdf's van je
                                            bodemanalyses uploaden om direct je
                                            gemeten bodemeigenschappen te
                                            gebruiken.
                                        </p>
                                    </li>
                                    <li>
                                        <strong className="text-foreground">
                                            Bouwplan:
                                        </strong>{" "}
                                        Hier kun je op gewasniveau de
                                        bemestingen, oogsten en andere gegevens
                                        van je gewassen invullen.
                                        <p className="text-xs text-muted-foreground italic pt-1">
                                            Tip: Je kunt ook de gewassen
                                            uitklappen in de tabel als je op
                                            perceelsniveau gegevens wilt
                                            invullen.
                                        </p>
                                    </li>
                                    <li>
                                        <strong className="text-foreground">
                                            Toegang:
                                        </strong>{" "}
                                        Hier heb je de keuze om eventueel
                                        toegang tot je bedrijf te delen met je
                                        adviseur.
                                    </li>
                                </ol>

                                <div className="space-y-2 pt-2 border-t">
                                    <h4 className="font-medium text-foreground">
                                        Kan ik ook later gegevens invullen?
                                    </h4>
                                    <p className="text-muted-foreground">
                                        Ja, je kunt ook je gegevens na het
                                        doorlopen van het stappenplan invullen
                                        of aanpassen. Met het stappenplan staat
                                        het alleen makkelijk op een rijtje om
                                        een nieuw bedrijf aan te maken.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </SidebarInset>
    )
}

/**
 * Handles the submission of the add farm form by creating a new farm and attaching default fertilizers.
 *
 * This function retrieves the user session from the request, extracts and validates form data using a predefined schema,
 * and creates a new farm with the provided name. It then fetches available fertilizers from a catalogue and associates them
 * with the newly created farm. On success, it returns a redirect response to the farm's atlas page with a confirmation message.
 *
 * @param request - The incoming request containing form data and session details.
 * @returns A redirect response to the newly created farm's atlas page.
 * @throws {Error} Throws an error if the form processing, farm creation, or fertilizer attachment fails.
 */
export async function action({ request }: ActionFunctionArgs) {
    try {
        // Get the session
        const session = await getSession(request)

        const formValues = await extractFormValuesFromRequest(
            request,
            FormSchema,
        )
        const {
            b_name_farm,
            year,
            b_businessid_farm,
            has_derogation,
            derogation_start_year,
            grazing_intention,
            organic_certification,
            organic_skal,
            organic_traces,
            organic_issued,
        } = formValues

        const b_id_farm = await addFarm(
            fdm,
            session.principal_id,
            b_name_farm,
            b_businessid_farm || null,
            null,
            null,
        )

        const isDerogationAllowed = year < 2026
        const effectiveHasDerogation = isDerogationAllowed && has_derogation
        const effectiveDerogationStartYear = isDerogationAllowed
            ? derogation_start_year
            : undefined

        const setupPromises: Promise<unknown>[] = []

        if (effectiveHasDerogation && effectiveDerogationStartYear) {
            const years = Array.from(
                { length: 2025 - effectiveDerogationStartYear + 1 },
                (_, i) => effectiveDerogationStartYear + i,
            )
            setupPromises.push(
                ...years.map((y) =>
                    addDerogation(fdm, session.principal_id, b_id_farm, y),
                ),
            )
        }

        if (grazing_intention) {
            setupPromises.push(
                setGrazingIntention(
                    fdm,
                    session.principal_id,
                    b_id_farm,
                    year,
                    true,
                ),
            )
        }

        if (organic_certification) {
            setupPromises.push(
                addOrganicCertification(
                    fdm,
                    session.principal_id,
                    b_id_farm,
                    organic_traces || null,
                    organic_skal || null,
                    organic_issued ?? null,
                    null,
                ),
            )
        }

        setupPromises.push(
            enableFertilizerCatalogue(
                fdm,
                session.principal_id,
                b_id_farm,
                "baat",
            ),
            enableFertilizerCatalogue(
                fdm,
                session.principal_id,
                b_id_farm,
                b_id_farm,
            ),
            enableCultivationCatalogue(
                fdm,
                session.principal_id,
                b_id_farm,
                "brp",
            ),
        )

        await Promise.all(setupPromises)

        const fertilizers = await getFertilizersFromCatalogue(
            fdm,
            session.principal_id,
            b_id_farm,
        )
        await Promise.all(
            fertilizers.map((fertilizer) =>
                addFertilizer(
                    fdm,
                    session.principal_id,
                    fertilizer.p_id_catalogue,
                    b_id_farm,
                    null,
                    null,
                ),
            ),
        )

        return redirectWithSuccess(`./${b_id_farm}/${year}`, {
            message: "Bedrijf is toegevoegd! 🎉 Selecteer nu de importmethode.",
        })
    } catch (error) {
        throw handleActionError(error)
    }
}
