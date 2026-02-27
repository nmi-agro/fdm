import type { FertilizerApplication } from "@nmi-agro/fdm-core"
import type { CellContext, ColumnDef } from "@tanstack/react-table"
import { endOfDay, format } from "date-fns"
import { nl } from "date-fns/locale"
import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { NavLink, useFetcher, useParams } from "react-router"
import { cn } from "@/app/lib/utils"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"

export type ApplicationExtended = FertilizerApplication & {
    b_id: string
    b_name: string
    p_app_method_name: string | null | undefined
    canModify: boolean
}

export interface FertAppRecordItem {
    id: string
    applications: ApplicationExtended[]
}

/**
 * Stringifies a single date if the given range is all the same dates,
 * otherwise stringifies the earliest and the latest date with a dash in between.
 *
 * @param dates array of dates. Nulls and undefined items are not allowed.
 * @returns the formatted string.
 */
function formatDateRange(dates: Date[]) {
    if (dates.length === 0) return ""
    const firstDate = dates[0]
    const lastDate = dates[dates.length - 1]
    return createDateKey(firstDate) === createDateKey(lastDate)
        ? `${format(firstDate, "PP", { locale: nl })}`
        : `${format(firstDate, "PP", { locale: nl })} - ${format(lastDate, "PP", { locale: nl })}`
}

/**
 * Stringifies a single number with an unit if the given range is all the same numbers or very close down to roughly 2 decimal places,
 * otherwise stringifies the least and the greatest numbers with a dash in between and the unit at the end.
 *
 * @param numbers array of numbers. Nulls and undefined items are not allowed.
 * @returns the formatted string.
 */
function formatNumberRange(numbers: number[], unit = "") {
    if (numbers.length === 0) return ""
    const firstNumber = numbers[0]
    const lastNumber = numbers[numbers.length - 1]
    return firstNumber === lastNumber ||
        Math.abs(lastNumber - firstNumber) < Math.abs(firstNumber) / 100
        ? `${firstNumber} ${unit}`
        : `${firstNumber} - ${lastNumber} ${unit}`
}

/**
 * Returns a date string that doesn't contain the time.
 *
 * The app interface doesn't really show the time in the day for dates, so we ignore the time this way */
export function createDateKey(date: Date) {
    return format(endOfDay(date), "yyyy-MM-dd")
}

export const columns: ColumnDef<FertAppRecordItem>[] = [
    {
        id: "p_app_date",
        header: "Datum",
        cell: ({ row }) =>
            formatDateRange(
                row.original.applications.map((app) => app.p_app_date),
            ),
    },
    {
        id: "applications.length",
        accessorKey: "applications.length",
        header: "Aantal bemestingen",
    },
    {
        id: "b_name",
        header: "Perceel",
        cell: ({ row }) => {
            const fieldNames = Object.entries(
                Object.fromEntries(
                    row.original.applications.map((app) => [
                        app.b_id,
                        app.b_name,
                    ]),
                ),
            ).sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
            if (fieldNames.length <= 1) {
                return fieldNames[0]?.[1] ?? ""
            }
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="-ms-4">
                            <span className="text-muted-foreground">
                                {fieldNames.length} percelen
                            </span>
                            <ChevronDown className="ml-1 size-3" />
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
            )
        },
    },
    {
        id: "p_app_method",
        header: "Toedieningsmethode",
        cell: ({ row }) =>
            [
                ...new Set(
                    row.original.applications
                        .map(
                            (application) =>
                                application.p_app_method_name ??
                                application.p_app_method,
                        )
                        .filter((methodName) => methodName !== null),
                ),
            ]
                .sort()
                .join(", "),
    },
    {
        id: "p_app_amount",
        header: "Hoeveelheid",
        cell: ({ row }) =>
            formatNumberRange(
                row.original.applications
                    .map((application) => application.p_app_amount)
                    .filter((amount) => amount !== null)
                    .sort((a, b) => a - b),
                "kg / ha",
            ),
    },
    {
        id: "modify",
        header: "",
        cell: (ctx) =>
            ctx.row.original.applications.some((app) => app.canModify) && (
                <ModifyCell {...ctx} />
            ),
    },
]

/**
 * Renders buttons that let the user edit or remove the applications found in the row record.
 *
 * The edit button will navigate to the add/update fertilizer page with the necessary search params.
 *
 * The delete button will show a confirmation dialog before deleting the fertilizer application(s).
 *
 * @param param0 all of the React Table cell context
 * @returns a React node that can be set as the cell contents
 */
function ModifyCell({ row, table }: CellContext<FertAppRecordItem, unknown>) {
    const params = useParams()
    const fetcher = useFetcher()
    const returnUrl = (table.options.meta as { returnUrl: string }).returnUrl
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const modifiableApps = row.original.applications.filter(
        (app) => app.canModify,
    )
    const modifiableAppIds = modifiableApps
        .map((app) => `${app.b_id}:${app.p_app_id}`)
        .join(",")

    return (
        <div className="flex items-center justify-end gap-2">
            <Spinner
                className={cn(
                    "h-4 w-4",
                    fetcher.state !== "submitting" && "invisible",
                )}
            />
            <Button asChild>
                <NavLink
                    to={`/farm/${params.b_id_farm}/${params.calendar}/field/fertilizer?appIds=${encodeURIComponent(modifiableAppIds)}&returnUrl=${encodeURIComponent(returnUrl)}`}
                >
                    Wijzigen
                </NavLink>
            </Button>
            <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={fetcher.state === "submitting"}
            >
                Verwijderen
            </Button>
            <AlertDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {modifiableApps.length === 1
                                ? "Bemesting verwijderen?"
                                : `${modifiableApps.length} bemestingen verwijderen?`}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {modifiableApps.length === 1
                                ? "Weet je zeker dat je deze bemesting wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
                                : `Weet je zeker dat je deze ${modifiableApps.length} bemestingen wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                const formData = new FormData()
                                formData.set("appIds", modifiableAppIds)
                                formData.set("intent", "remove_application")
                                fetcher.submit(formData, { method: "POST" })
                            }}
                        >
                            Verwijderen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
