import {
    addDerogation,
    checkPermission,
    listDerogations,
    removeDerogation,
} from "@nmi-agro/fdm-core"
import {
    type ActionFunctionArgs,
    type LoaderFunctionArgs,
    useFetcher,
    useLoaderData,
} from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Switch } from "~/components/ui/switch"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import { getSession } from "~/lib/auth.server"
import { getCalendarSelection } from "~/lib/calendar"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm!
        const session = await getSession(request)
        const derogations = await listDerogations(
            fdm,
            session.principal_id,
            b_id_farm,
        )
        const farmWritePermission = await checkPermission(
            fdm,
            "farm",
            "write",
            b_id_farm,
            session.principal_id,
            new URL(request.url).pathname,
            false,
        )
        return { b_id_farm, derogations, farmWritePermission }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm!
        const session = await getSession(request)
        const formData = await request.formData()
        const year = Number(formData.get("year"))
        const currentlyHasDerogation = formData.get("hasDerogation") === "true"
        if (currentlyHasDerogation) {
            // User is turning OFF the switch, so remove derogation
            const derogations = await listDerogations(
                fdm,
                session.principal_id,
                b_id_farm,
            )
            const derogation = derogations.find(
                (d) => d.b_derogation_year === year,
            )
            if (derogation) {
                await removeDerogation(
                    fdm,
                    session.principal_id,
                    derogation.b_id_derogation,
                )
                return dataWithSuccess({}, `Derogatie voor ${year} verwijderd.`)
            }
        } else {
            // User is turning ON the switch, so add derogation
            if (year >= 2026) {
                return dataWithError(
                    {},
                    "Derogatie is niet meer beschikbaar vanaf 2026.",
                )
            }
            await addDerogation(fdm, session.principal_id, b_id_farm, year)
            return dataWithSuccess({}, `Derogatie voor ${year} toegevoegd.`)
        }
        return dataWithError(
            {},
            `Het is niet gelukt derogatie voor ${year} aan te passen.`,
        )
    } catch (error) {
        throw handleActionError(error)
    }
}

export default function DerogationSettings() {
    const { derogations, farmWritePermission } = useLoaderData<typeof loader>()
    const fetcher = useFetcher<typeof action>()

    const years = getCalendarSelection()
        .map((year) => Number(year))
        .filter((year) => year >= 2006 && year <= 2025)

    return (
        <div className="flex justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Derogatie</CardTitle>
                    <CardDescription>
                        {farmWritePermission
                            ? "Schakel derogatie in voor de jaren waarvoor dit bedrijf in aanmerking komt."
                            : "Hieronder staan de jaren waarin dit bedrijf derogatie heeft."}{" "}
                        Dit heeft invloed op de berekening van je
                        gebruiksruimte.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table className="w-fit">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Jaar</TableHead>
                                <TableHead>Derogatie</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {years.map((year) => {
                                const hasDerogation = derogations.some(
                                    (d) => d.b_derogation_year === year,
                                )
                                return (
                                    <TableRow key={year}>
                                        <TableCell>{year}</TableCell>
                                        <TableCell>
                                            {farmWritePermission ? (
                                                <fetcher.Form method="post">
                                                    <Switch
                                                        checked={hasDerogation}
                                                        onCheckedChange={() => {
                                                            fetcher.submit(
                                                                {
                                                                    year: String(
                                                                        year,
                                                                    ),
                                                                    hasDerogation:
                                                                        String(
                                                                            hasDerogation,
                                                                        ),
                                                                },
                                                                {
                                                                    method: "post",
                                                                },
                                                            )
                                                        }}
                                                    />
                                                </fetcher.Form>
                                            ) : (
                                                <Switch
                                                    checked={hasDerogation}
                                                />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
