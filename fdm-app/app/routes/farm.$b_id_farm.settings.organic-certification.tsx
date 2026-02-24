import { zodResolver } from "@hookform/resolvers/zod"
import {
    addOrganicCertification,
    checkPermission,
    listOrganicCertifications,
    removeOrganicCertification,
} from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { ScrollText, Trash2 } from "lucide-react"
import { useId } from "react"
import {
    type ActionFunctionArgs,
    Form,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
    useNavigation,
} from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { dataWithSuccess } from "remix-toast"
import type { z } from "zod"
import { formSchema } from "~/components/blocks/organic-certification/schema"
import { DatePicker } from "~/components/custom/date-picker"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/ui/dialog"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "~/components/ui/empty"
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { cn } from "~/lib/utils"

export const meta: MetaFunction = () => {
    return [
        {
            title: `Bio-certificaat - Instellingen - Bedrijf | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Bekijk of voeg een bio-certificaat voor dit bedrijf toe.",
        },
    ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        if (b_id_farm === undefined) {
            throw new Error("missing: b_id_farm")
        }

        const session = await getSession(request)
        const organicCertifications = await listOrganicCertifications(
            fdm,
            session.principal_id,
            b_id_farm,
        )

        // For now we expect that a farm can have only 1 certification
        const organicCertification = organicCertifications[0]

        const farmWritePermission = await checkPermission(
            fdm,
            "farm",
            "write",
            b_id_farm,
            session.principal_id,
            new URL(request.url).pathname,
            false,
        )

        return { b_id_farm, organicCertification, farmWritePermission }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        if (b_id_farm === undefined) {
            throw new Error("missing: b_id_farm")
        }
        const session = await getSession(request)

        if (request.method === "POST") {
            const formValues = await extractFormValuesFromRequest(
                request,
                formSchema,
            )

            const b_organic_traces = formValues.b_organic_traces
            const b_organic_skal = formValues.b_organic_skal
            const b_organic_issued = formValues.b_organic_issued
            const b_organic_expires = formValues.b_organic_expires

            await addOrganicCertification(
                fdm,
                session.principal_id,
                b_id_farm,
                b_organic_traces,
                b_organic_skal,
                b_organic_issued,
                b_organic_expires,
            )

            return dataWithSuccess("organic certification added", {
                message: "Bio-certificaat is toegevoegd! 🎉",
            })
        }
        if (request.method === "DELETE") {
            const formData = await request.formData()
            const b_id_organic = formData.get("b_id_organic")

            if (typeof b_id_organic !== "string") {
                throw new Error("missing: b_id_organic")
            }
            await removeOrganicCertification(
                fdm,
                session.principal_id,
                b_id_organic,
            )
            return dataWithSuccess("organic certification deleted", {
                message: "Bio-certificaat is verwijderd",
            })
        }
        throw new Error("invalid method")
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function OrganicCertificationSettings() {
    const { organicCertification, farmWritePermission } =
        useLoaderData<typeof loader>()
    const navigation = useNavigation()

    const isDeleting =
        navigation.state === "submitting" && navigation.formMethod === "DELETE"

    const form = useRemixForm<z.infer<typeof formSchema>>({
        mode: "onTouched",
        resolver: zodResolver(formSchema),
        defaultValues: {
            b_organic_traces: "",
            b_organic_skal: "",
            b_organic_issued: undefined, // DatePicker handles undefined for initial state
            b_organic_expires: undefined,
        },
    })

    const formId = useId()

    return (
        <div className="max-w-2xl mx-auto">
            {organicCertification ? (
                <Card>
                    <CardHeader>
                        <div className="flex items-center space-x-2">
                            <ScrollText className="h-6 w-6 text-muted-foreground" />
                            <CardTitle>Bio-certificaat</CardTitle>
                        </div>
                        <CardDescription>
                            Details van het bio-certificaat voor dit bedrijf.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <div className="flex flex-col">
                            <span className="text-muted-foreground text-sm">
                                TRACES-nummer
                            </span>
                            <span className="font-medium">
                                {organicCertification.b_organic_traces ? (
                                    <a
                                        href={`https://webgate.ec.europa.eu/tracesnt/directory/publication/organic-operator/${organicCertification.b_organic_traces}.pdf`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline"
                                    >
                                        {organicCertification.b_organic_traces}
                                    </a>
                                ) : (
                                    "Onbekend"
                                )}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-muted-foreground text-sm">
                                SKAL-nummer
                            </span>
                            <span className="font-medium">
                                {organicCertification.b_organic_skal ||
                                    "Onbekend"}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-muted-foreground text-sm">
                                Geldig van:
                            </span>
                            <span className="font-medium">
                                {format(
                                    new Date(
                                        organicCertification.b_organic_issued,
                                    ),
                                    "PP",
                                    { locale: nl },
                                )}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-muted-foreground text-sm">
                                Verloopt op:
                            </span>
                            <span className="font-medium">
                                {organicCertification.b_organic_expires
                                    ? format(
                                          new Date(
                                              organicCertification.b_organic_expires,
                                          ),
                                          "PP",
                                          { locale: nl },
                                      )
                                    : "Onbekend"}
                            </span>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Verwijderen
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Weet u het zeker?</DialogTitle>
                                    <DialogDescription>
                                        Deze actie kan niet ongedaan worden
                                        gemaakt. Dit zal het bio-certificaat
                                        permanent verwijderen.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">
                                            Annuleren
                                        </Button>
                                    </DialogClose>
                                    <Form method="delete">
                                        <input
                                            type="hidden"
                                            name="b_id_organic"
                                            value={
                                                organicCertification.b_id_organic
                                            }
                                        />
                                        <Button
                                            type="submit"
                                            variant="destructive"
                                            disabled={isDeleting}
                                        >
                                            {isDeleting ? (
                                                <div className="flex items-center space-x-2">
                                                    <Spinner />
                                                    <span>Verwijderen...</span>
                                                </div>
                                            ) : (
                                                "Verwijderen"
                                            )}
                                        </Button>
                                    </Form>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardFooter>
                </Card>
            ) : (
                <Dialog>
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <ScrollText />
                            </EmptyMedia>
                            <EmptyTitle>
                                Dit bedrijf heeft geen bio-certificaat
                            </EmptyTitle>
                            <EmptyDescription>
                                {farmWritePermission
                                    ? "Als dit bedrijf wel een bio-certificaat heeft, kunt u deze toevoegen."
                                    : "U heeft geen toestemming om een bio-certificaat voor dit bedrijf toe te voegen."}
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <DialogTrigger asChild>
                                <Button
                                    className={cn(
                                        !farmWritePermission ? "invisible" : "",
                                    )}
                                >
                                    Voeg toe
                                </Button>
                            </DialogTrigger>
                        </EmptyContent>
                    </Empty>
                    <DialogContent>
                        <RemixFormProvider {...form}>
                            <Form
                                onSubmit={form.handleSubmit}
                                method="POST"
                                id={formId}
                            >
                                <fieldset
                                    disabled={form.formState.isSubmitting}
                                    className="space-y-4"
                                >
                                    <DialogHeader>
                                        <DialogTitle>
                                            Voeg een bio-certificaat toe
                                        </DialogTitle>
                                        <DialogDescription>
                                            Vul de gegevens van het
                                            bio-certificaat in.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DatePicker
                                        form={form}
                                        name="b_organic_issued"
                                        label="Startdatum"
                                        description="De datum waarop het certificaat is ingegaan."
                                    />
                                    <DatePicker
                                        form={form}
                                        name="b_organic_expires"
                                        label="Einddatum"
                                        description="De datum waarop het certificaat verloopt."
                                    />
                                    <FormField
                                        name="b_organic_traces"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    TRACES-nummer
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormDescription>
                                                    Het volledige documentnummer
                                                    volgens de EU
                                                    Traces-database.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        name="b_organic_skal"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    SKAL-nummer
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormDescription>
                                                    Het SKAL-nummer van de
                                                    certificering.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                            >
                                                Sluiten
                                            </Button>
                                        </DialogClose>
                                        <Button type="submit" variant="default">
                                            {form.formState.isSubmitting ? (
                                                <div className="flex items-center space-x-2">
                                                    <Spinner />
                                                    <span>Toevoegen</span>
                                                </div>
                                            ) : (
                                                "Toevoegen"
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </fieldset>
                            </Form>
                        </RemixFormProvider>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}
