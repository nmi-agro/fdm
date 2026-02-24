import {
    checkPermission,
    getFertilizer,
    getFertilizerApplications,
    getFertilizerParametersDescription,
    getField,
    removeFertilizerApplication,
} from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { useMemo, useState } from "react"
import {
    data,
    Form,
    NavLink,
    useLoaderData,
    useNavigate,
    useNavigation,
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "~/components/ui/empty"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { cn } from "~/lib/utils"
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
            fieldIds.map(async (b_id) => {
                const field = await getField(fdm, session.principal_id, b_id)
                return getFertilizerApplications(
                    fdm,
                    session.principal_id,
                    b_id,
                ).then((apps) =>
                    apps.map((app) => ({
                        ...app,
                        b_id: b_id,
                        b_name: field.b_name,
                    })),
                )
            }),
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
            fieldIds: fieldIds,
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
    applications: ApplicationExtended[]
}

type FertAppRecord = Record<string, FertAppRecordItem>

type RowMapperFunction = (
    record: FertAppRecord,
    applications: ApplicationExtended[],
) => void
/**
 * Creates a mapper function that places applications into table rows.
 *
 * @param keyExtractor given a fertilizer application an index unique within the field's fertilizer
 * applications group, it should return a stringified number that will determine which row the
 * application goes into.
 * @returns the mapper function
 */
const createMapper =
    (
        keyExtractor: (
            application: Omit<ApplicationExtended, "p_app_date"> & {
                p_app_date: Date
            },
            i: number,
        ) => string,
    ) =>
    (record: FertAppRecord, applications: ApplicationExtended[]) => {
        applications.forEach((application, i) => {
            if (!application.p_app_date) return
            const key = keyExtractor(application, i)
            record[key] ??= {
                id: `${application.p_id}_${key}`,
                applications: [],
            }
            record[key].applications.push(application)
        })
    }

/** This mapper function maps each application as a separate entry. */
const mapEach: RowMapperFunction = (record, applications) => {
    const offset = Object.keys(record).length
    applications
        .filter((application) => application.p_app_date != null)
        .sort((a, b) => a.p_app_date.getTime() - b.p_app_date.getTime())
        .forEach((application, i) => {
            if (!application.p_app_date) return
            const key = offset + i
            record[key] = {
                id: `${application.p_id}_${key}`,
                applications: [application],
            }
        })
}

/**
 * Mapper functions that can be used to group the fertilizer applications into table rows in different ways
 */
export const mappers = {
    mapByOrder: createMapper((_application, i) => i.toString()),
    mapByDate: createMapper((application) =>
        application.p_app_date.getTime().toString(),
    ),
    mapByField: createMapper((application) => application.b_id),
    mapEach: createMapper((application) => application.p_app_id),
} as const

function compareDates(a: Date, b: Date) {
    return a.getTime() - b.getTime()
}

function compareStrings(a: string, b: string) {
    return a < b ? -1 : a > b ? 1 : 0
}

/**
 *
 * @param applicationsPerField
 * @param mapper
 * @returns
 */
function groupAndOrderFertApps(
    applicationsPerField: ApplicationExtended[][],
    mapper: RowMapperFunction,
) {
    const record: FertAppRecord = {}
    for (const group of applicationsPerField) {
        mapper(record, group)
    }

    const entries = Object.entries(record).map(
        ([idx, reduced]) =>
            [Number.parseFloat(idx), reduced] as [number, typeof reduced],
    )
    entries.sort((a, b) => a[0] - b[0])
    // Applications with no date get filtered out in the mapping function
    entries.forEach((ent) => {
        ent[1].applications.sort(
            (a, b) =>
                compareDates(a.p_app_date as Date, b.p_app_date as Date) ||
                compareStrings(a.b_name, b.b_name),
        )
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
    return firstNumber === lastNumber ||
        Math.abs(lastNumber - firstNumber) < Math.abs(firstNumber) / 100
        ? `${firstNumber} ${unit}`
        : `${firstNumber} - ${lastNumber} ${unit}`
}

function FertilizerApplicationRow({
    record,
    returnUrl,
    columnVisibility,
}: {
    record: FertAppRecordItem
    returnUrl: string
    columnVisibility: Record<"fieldName" | "count" | "modify", boolean>
}) {
    const params = useParams()
    const navigation = useNavigation()

    const {
        dates,
        fieldNames,
        applicationMethods,
        applicationAmount,
        modifiableApps,
        modifiableAppIds,
    } = useMemo(() => {
        const dates = formatDateRange(
            record.applications.map((app) => app.p_app_date),
        )
        // Gets names of distinct fields
        const fieldNames = Object.entries(
            Object.fromEntries(
                record.applications.map((app) => [app.b_id, app.b_name]),
            ),
        ).sort((a, b) => compareStrings(a[1], b[1]))
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
                .sort((a, b) => a - b),
            "kg / ha",
        )
        const modifiableApps = record.applications.filter(
            (app) => app.canModify,
        )
        const modifiableAppIds = modifiableApps
            .map((app) => `${app.b_id}:${app.p_app_id}`)
            .join(",")

        return {
            dates,
            fieldNames,
            applicationMethods,
            applicationAmount,
            modifiableApps,
            modifiableAppIds,
        }
    }, [record])

    return (
        <TableRow>
            <TableCell>{dates}</TableCell>
            {columnVisibility.count && (
                <TableCell>{record.applications.length}</TableCell>
            )}
            {columnVisibility.fieldName && (
                <TableCell>
                    {record.applications.length > 1 ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="-ms-4">
                                    <p className="text-muted-foreground">
                                        {fieldNames.length === 1
                                            ? "(1 perceel)"
                                            : `(${fieldNames.length} percelen)`}
                                    </p>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <ScrollArea
                                    className={
                                        fieldNames.length >= 8
                                            ? "h-72 overflow-y-auto w-48"
                                            : "w-48"
                                    }
                                >
                                    <div className="grid grid-cols-1 gap-2">
                                        {fieldNames.map(([b_id, b_name]) => (
                                            <DropdownMenuItem key={b_id}>
                                                {b_name}
                                            </DropdownMenuItem>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        fieldNames[0][1]
                    )}
                </TableCell>
            )}
            <TableCell>{applicationMethods}</TableCell>
            <TableCell>{applicationAmount}</TableCell>
            {columnVisibility.modify &&
                (modifiableApps.length > 0 ? (
                    <TableCell className="flex flex-row justify-end items-center gap-2">
                        <Spinner
                            className={cn(
                                "h-4 w-4",
                                navigation.state !== "submitting" &&
                                    "invisible",
                            )}
                        />
                        <Button asChild>
                            <NavLink
                                to={`/farm/${params.b_id_farm}/${params.calendar}/rotation/fertilizer?appIds=${encodeURIComponent(modifiableAppIds)}&returnUrl=${encodeURIComponent(returnUrl)}`}
                            >
                                Bijwerken
                            </NavLink>
                        </Button>
                        <Form method="POST">
                            <input
                                name="appIds"
                                type="hidden"
                                value={modifiableAppIds}
                            />
                            <Button
                                name="intent"
                                variant="destructive"
                                value="remove_application"
                                disabled={navigation.state === "submitting"}
                            >
                                Verwijderen
                            </Button>
                        </Form>
                    </TableCell>
                ) : (
                    <TableCell />
                ))}
        </TableRow>
    )
}

export default function FertilizerApplicationListDialog() {
    const { fieldIds, fertilizer, fertilizerApplications, returnUrl } =
        useLoaderData<typeof loader>()

    const navigate = useNavigate()

    const [rowMapper, setRowMapper] =
        useState<keyof typeof mappers>("mapByDate")

    const numFertilizerApplications = fertilizerApplications
        .map((apps) => apps.length)
        .reduce((a, b) => a + b)

    const shouldShowGroupingSelector =
        fieldIds.length > 1 && numFertilizerApplications > 1

    const rowMapperToUse = shouldShowGroupingSelector ? rowMapper : "mapEach"

    const records = useMemo(
        () =>
            groupAndOrderFertApps(
                fertilizerApplications,
                mappers[rowMapperToUse],
            ),
        [fertilizerApplications, rowMapperToUse],
    )

    const columnVisibility = useMemo(
        () => ({
            fieldName: fieldIds.length > 1,
            count: records.some((app) => app.applications.length > 1),
            modify: fertilizerApplications.some((apps) =>
                apps.some((app) => app.canModify),
            ),
        }),
        [fieldIds, fertilizerApplications, records],
    )

    return (
        <Dialog open={true} onOpenChange={() => navigate("..")}>
            <DialogContent className="max-w-4xl transition-transform duration-1000">
                <DialogHeader>
                    <DialogTitle>
                        {fertilizer.p_name_nl}{" "}
                        {fieldIds.length === 1 &&
                            ` op ${records[0].applications[0].b_name}`}
                    </DialogTitle>
                    <DialogDescription>
                        Bekijk en beheer de bemestingen met deze meststof.
                    </DialogDescription>
                </DialogHeader>
                {records.length > 0 ? (
                    <>
                        {shouldShowGroupingSelector && (
                            <div className="flex flex-row items-center gap-2">
                                <p className="text-sm text-muted-foreground">
                                    Groeperen op{" "}
                                </p>
                                <Tabs
                                    value={rowMapper}
                                    onValueChange={(value) => {
                                        if (value in mappers)
                                            setRowMapper(
                                                value as keyof typeof mappers,
                                            )
                                    }}
                                >
                                    <TabsList>
                                        <TabsTrigger value="mapByDate">
                                            Datum
                                        </TabsTrigger>
                                        <TabsTrigger value="mapByOrder">
                                            Volgorde
                                        </TabsTrigger>
                                        <TabsTrigger value="mapEach">
                                            Niet groeperen
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                        )}
                        <Table>
                            <TableHeader className="sticky">
                                <TableRow>
                                    <TableHead>Datum</TableHead>
                                    {columnVisibility.count && (
                                        <TableHead>
                                            Aantal Bemestingen
                                        </TableHead>
                                    )}
                                    {columnVisibility.fieldName && (
                                        <TableHead>Percelen</TableHead>
                                    )}
                                    <TableHead>Toedieningsmethode</TableHead>
                                    <TableHead>Hoeveelheid</TableHead>
                                    {columnVisibility.modify && <TableHead />}
                                </TableRow>
                            </TableHeader>
                            <TableBody className="text-muted-foreground">
                                {records.map((record) => (
                                    <FertilizerApplicationRow
                                        key={record.id}
                                        record={record}
                                        columnVisibility={columnVisibility}
                                        returnUrl={returnUrl}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </>
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

function parseAppIds(value: string) {
    return value
        .split(",")
        .map((pairStr) => pairStr.split(":"))
        .filter(
            (pair) =>
                pair.length === 2 && pair[0].length > 0 && pair[1].length > 0,
        )
        .map(([b_id, p_app_id]) => ({ b_id, p_app_id }))
}

const FormSchema = z.discriminatedUnion("intent", [
    z.object({
        intent: z.literal("remove_application"),
        appIds: z
            .string()
            .transform(parseAppIds)
            .refine((ids) => ids.length > 0, {
                error: "missing: appIds",
            }),
    }),
])

export async function action({ request }: Route.ActionArgs) {
    try {
        const session = await getSession(request)

        const formData = await extractFormValuesFromRequest(request, FormSchema)

        if (formData.intent === "remove_application") {
            await fdm.transaction((tx) =>
                Promise.all(
                    formData.appIds.map(({ p_app_id }) =>
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
