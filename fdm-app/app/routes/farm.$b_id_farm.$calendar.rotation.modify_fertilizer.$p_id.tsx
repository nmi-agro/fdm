import {
    checkPermission,
    getFertilizer,
    getFertilizerApplications,
    getFertilizerParametersDescription,
    removeFertilizerApplication,
} from "@svenvw/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { useMemo } from "react"
import {
    data,
    Form,
    NavLink,
    useLoaderData,
    useNavigate,
    useParams,
} from "react-router"
import { dataWithSuccess } from "remix-toast"
import z from "zod"
import { Button } from "~/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "~/components/ui/empty"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/farm.$b_id_farm.$calendar.rotation.modify_fertilizer.$p_id"

interface FertilizerInfo {
    p_id: string
    p_name_nl: string | null
}

export async function loader({ params, request }: Route.LoaderArgs) {
    try {
        const session = await getSession(request)

        const url = new URL(request.url)

        const fieldIds = url.searchParams
            .get("fieldIds")
            ?.split(",")
            .filter((b_id) => b_id.length > 0)
        if (!fieldIds || fieldIds.length === 0) {
            throw data("missing: fieldIds", 400)
        }

        const originalFertilizer = await getFertilizer(fdm, params.p_id)
        const fertilizer: FertilizerInfo = {
            p_id: originalFertilizer.p_id,
            p_name_nl: originalFertilizer.p_name_nl,
        }

        const allApplicationsPerField = await Promise.all(
            fieldIds.map((b_id) =>
                getFertilizerApplications(fdm, session.principal_id, b_id).then(
                    (apps) => apps.map((app) => ({ ...app, b_id: b_id })),
                ),
            ),
        )

        const applicationsPerField = allApplicationsPerField.map(
            (allApplications) =>
                allApplications
                    .filter((app) => app.p_id === params.p_id)
                    .sort(
                        (app1, app2) =>
                            app1.p_app_date.getTime() -
                            app2.p_app_date.getTime(),
                    ),
        )

        const fertilizerParameterDescription =
            getFertilizerParametersDescription()
        const applicationMethods = fertilizerParameterDescription.find(
            (x: { parameter: string }) =>
                x.parameter === "p_app_method_options",
        )
        if (!applicationMethods) throw new Error("Parameter metadata missing")

        const applicationsExtended = await Promise.all(
            applicationsPerField.map((applications) =>
                Promise.all(
                    applications.map(async (application) => {
                        const canModify = await checkPermission(
                            fdm,
                            "fertilizer_application",
                            "write",
                            application.p_app_id,
                            session.principal_id,
                            "RotationTableFertilizerApplicationListDialog",
                            false,
                        )
                        return {
                            ...application,
                            canModify: canModify,
                            p_app_method_name: applicationMethods.options?.find(
                                (option) =>
                                    option.value === application.p_app_method,
                            )?.label,
                        }
                    }),
                ),
            ),
        )

        const returnUrl = `${url.pathname}${url.search}`

        return {
            fertilizer: fertilizer,
            fertilizerApplications: applicationsExtended,
            returnUrl: returnUrl,
        }
    } catch (e) {
        throw handleLoaderError(e)
    }
}

type ApplicationExtended = Awaited<
    ReturnType<typeof loader>
>["fertilizerApplications"][number][number]
interface FertAppRecordItem {
    id: string
    dates: Date[]
    applications: ApplicationExtended[]
}

type FertAppRecord = Record<string, FertAppRecordItem>

function mapByOrder(
    record: FertAppRecord,
    applications: ApplicationExtended[],
) {
    applications.forEach((application, i) => {
        if (!application.p_app_date) return
        const key = i
        record[key] ??= {
            id: `${application.p_id}_${key}`,
            dates: [],
            applications: [],
        }
        record[key].applications.push(application)
        record[key].dates.push(application.p_app_date)
    })
}

function groupAndOrderFertApps(applicationsPerField: ApplicationExtended[][]) {
    const record: FertAppRecord = {}
    for (const group of applicationsPerField) {
        mapByOrder(record, group)
    }

    const entries = Object.entries(record).map(
        ([idx, reduced]) =>
            [Number.parseFloat(idx), reduced] as [number, typeof reduced],
    )
    entries.sort((a, b) => a[0] - b[0])
    // Harvests with no date get filtered out in the mapping function
    entries.forEach((ent) => {
        ent[1].applications.sort(
            (a, b) =>
                (a.p_app_date as Date).getTime() -
                (b.p_app_date as Date).getTime(),
        )
        ent[1].dates.sort((a, b) => a.getTime() - b.getTime())
    })
    return entries.map((ent) => ent[1])
}

function formatDateRange(dates: Date[]) {
    if (dates.length === 0) return ""
    const firstDate = dates[0]
    const lastDate = dates[dates.length - 1]
    return firstDate.getTime() === lastDate.getTime()
        ? `${format(firstDate, "PP", { locale: nl })}`
        : `${format(firstDate, "PP", { locale: nl })} - ${format(lastDate, "PP", { locale: nl })}`
}

function formatNumberRange(numbers: number[], unit = "") {
    if (numbers.length === 0) return ""
    const firstNumber = numbers[0]
    const lastNumber = numbers[numbers.length - 1]
    return lastNumber - firstNumber < firstNumber / 100
        ? `${firstNumber} ${unit}`
        : `${firstNumber} - ${lastNumber} ${unit}`
}

function FertilizerApplicationRow({
    record,
    returnUrl,
    includeModifyCellWhenReadonly,
}: {
    record: FertAppRecordItem
    returnUrl: string
    includeModifyCellWhenReadonly: boolean
}) {
    const params = useParams()

    const {
        dates,
        applicationMethods,
        applicationAmount,
        modifiableApps,
        modifiableAppIds,
    } = useMemo(() => {
        const dates = formatDateRange(record.dates)
        const applicationMethods = [
            ...new Set(
                record.applications
                    .map(
                        (application) =>
                            application.p_app_method_name ??
                            application.p_app_method,
                    )
                    .filter((date) => date !== null),
            ),
        ]
            .sort()
            .join(", ")
        const applicationAmount = formatNumberRange(
            record.applications
                .map((application) => application.p_app_amount)
                .filter((amount) => amount !== null)
                .sort(),
            "kg / ha",
        )
        const modifiableApps = record.applications.filter(
            (app) => app.canModify,
        )
        const modifiableAppIds = modifiableApps
            .map((app) => encodeURIComponent(`${app.b_id}:${app.p_app_id}`))
            .join(",")

        return {
            dates,
            applicationMethods,
            applicationAmount,
            modifiableApps,
            modifiableAppIds,
        }
    }, [record])

    return (
        <TableRow>
            <TableCell>{dates}</TableCell>
            <TableCell>{applicationMethods}</TableCell>
            <TableCell>{applicationAmount}</TableCell>
            {modifiableApps.length > 0 ? (
                <TableCell className="flex flex-row justify-end gap-2">
                    <Button asChild>
                        <NavLink
                            to={`/farm/${params.b_id_farm}/${params.calendar}/rotation/fertilizer?appIds=${modifiableAppIds}&returnUrl=${encodeURIComponent(returnUrl)}`}
                        >
                            Bijwerken
                        </NavLink>
                    </Button>
                    <Form>
                        <input
                            name="appIds"
                            type="hidden"
                            value={modifiableAppIds}
                        />
                        <Button
                            name="intent"
                            variant="destructive"
                            value="remove_application"
                        >
                            Verwijderen
                        </Button>
                    </Form>
                </TableCell>
            ) : (
                includeModifyCellWhenReadonly && <TableCell />
            )}
        </TableRow>
    )
}

export default function FertilizerApplicationListDialog() {
    const { fertilizer, fertilizerApplications, returnUrl } =
        useLoaderData<typeof loader>()

    const navigate = useNavigate()

    const canModifyAnything = useMemo(
        () =>
            fertilizerApplications.some((apps) =>
                apps.some((app) => app.canModify),
            ),
        [fertilizerApplications],
    )

    const records = groupAndOrderFertApps(fertilizerApplications)

    return (
        <Dialog open={true} onOpenChange={() => navigate("..")}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{fertilizer.p_name_nl}</DialogTitle>
                    <DialogDescription>
                        Bekijk en beheer de bemestingen met deze meststof.
                    </DialogDescription>
                </DialogHeader>
                {records.length > 0 ? (
                    <Table>
                        <TableHeader className="sticky">
                            <TableRow>
                                <TableHead>Datum</TableHead>
                                <TableHead>Toedieningsmethode</TableHead>
                                <TableHead>Hoeveelheid</TableHead>
                                {canModifyAnything && <TableHead />}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {records.map((record) => (
                                <FertilizerApplicationRow
                                    key={record.id}
                                    record={record}
                                    includeModifyCellWhenReadonly={
                                        canModifyAnything
                                    }
                                    returnUrl={returnUrl}
                                />
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <Empty>
                        <EmptyHeader>
                            <EmptyTitle>Geen bemestingen gevonden</EmptyTitle>
                            <EmptyDescription>
                                Het lijkt erop dat deze meststof niet langer op
                                dit perceel/deze percelen en gewassen wordt
                                toegepast.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" type="button">
                            Sluiten
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const FormSchema = z.discriminatedUnion("intent", [
    z.object({
        intent: z.literal("remove_application"),
        appIds: z
            .string()
            .transform((str) => str.split(","))
            .refine((ids) => ids.length > 0, { error: "missing: p_app_id" }),
    }),
])

export async function action({ request }: Route.ActionArgs) {
    try {
        const session = await getSession(request)

        const formData = await extractFormValuesFromRequest(request, FormSchema)

        if (formData.intent === "remove_application") {
            await fdm.transaction((tx) =>
                Promise.all(
                    formData.appIds.map((p_app_id) =>
                        removeFertilizerApplication(
                            tx,
                            session.principal_id,
                            p_app_id,
                        ),
                    ),
                ),
            )
            return dataWithSuccess(
                null,
                formData.appIds.length === 1
                    ? "Bemesting is verwijderd!"
                    : "Bemestingen zijn verwijderd!",
            )
        }

        throw Error(`invalid intent: ${formData.intent}`)
    } catch (e) {
        throw handleActionError(e)
    }
}
