import {
    checkPermission,
    getGrazingIntentions,
    setGrazingIntention,
} from "@nmi-agro/fdm-core"
import {
    type ActionFunctionArgs,
    type LoaderFunctionArgs,
    useFetcher,
    useLoaderData,
} from "react-router"
import { dataWithSuccess } from "remix-toast"
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
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw new Error("invalid: b_id_farm")
        }
        const session = await getSession(request)
        const grazingIntentions = await getGrazingIntentions(
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
        return { b_id_farm, grazingIntentions, farmWritePermission }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw new Error("invalid: b_id_farm")
        }
        const session = await getSession(request)
        const formData = await request.formData()
        const year = Number(formData.get("year"))
        const hasGrazingIntention =
            formData.get("hasGrazingIntention") === "true"
        if (Number.isNaN(year)) {
            throw new Error("invalid: year")
        }

        await setGrazingIntention(
            fdm,
            session.principal_id,
            b_id_farm,
            year,
            !hasGrazingIntention,
        )

        if (hasGrazingIntention) {
            return dataWithSuccess({}, `Beweiding voor ${year} uitgeschakeld.`)
        }
        return dataWithSuccess({}, `Beweiding voor ${year} ingeschakeld.`)
    } catch (error) {
        throw handleActionError(error)
    }
}

export default function GrazingIntentionSettings() {
    const { grazingIntentions, farmWritePermission } =
        useLoaderData<typeof loader>()
    const fetcher = useFetcher<typeof action>()

    const currentYear = new Date().getFullYear()
    const years = getCalendarSelection()
        .map(Number)
        .filter((year) => year >= 2006 && year <= currentYear + 1)

    return (
        <div className="flex justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Beweiding</CardTitle>
                    <CardDescription>
                        {farmWritePermission
                            ? "Geef hier aan of je voor een bepaald jaar hebt beweid of van plan bent te gaan beweiden."
                            : "Hieronder staan de jaren waarin beweiding gepland is of heeft plaatsgevonden."}{" "}
                        Dit heeft invloed op de berekeningen.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table className="w-fit">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Jaar</TableHead>
                                <TableHead>Beweiding</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {years.map((year) => {
                                const hasGrazingIntention =
                                    grazingIntentions.some(
                                        (g) =>
                                            g.b_grazing_intention_year ===
                                                year && g.b_grazing_intention,
                                    )
                                return (
                                    <TableRow key={year}>
                                        <TableCell>{year}</TableCell>
                                        <TableCell>
                                            {farmWritePermission ? (
                                                <fetcher.Form method="post">
                                                    <Switch
                                                        checked={
                                                            hasGrazingIntention
                                                        }
                                                        onCheckedChange={() => {
                                                            fetcher.submit(
                                                                {
                                                                    year: String(
                                                                        year,
                                                                    ),
                                                                    hasGrazingIntention:
                                                                        String(
                                                                            hasGrazingIntention,
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
                                                    checked={
                                                        hasGrazingIntention
                                                    }
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
