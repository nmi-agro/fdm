import { CircleCheck, CircleX, Loader2 } from "lucide-react"
import { Suspense, use } from "react"
import { NavLink } from "react-router"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import type { FarmDynaResult } from "~/integrations/mineralization.server"

interface DynaFieldListProps {
    fields: { b_id: string; b_name: string | null }[]
    promises: Promise<FarmDynaResult>[]
    b_id_farm: string
    calendar: string
}

export function DynaFieldList({
    fields,
    promises,
    b_id_farm,
    calendar,
}: DynaFieldListProps) {
    // Map promises to their b_id for easier lookup
    // Since we know the promises array matches the non-buffer fields order from the loader
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Perceel</TableHead>
                    <TableHead className="text-right">N Aanbod (kg/ha)</TableHead>
                    <TableHead className="text-right">N Opname (kg/ha)</TableHead>
                    <TableHead className="text-right">Uitspoeling (kg/ha)</TableHead>
                    <TableHead className="text-center w-[80px]">Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {fields.map((field, i) => (
                    <DynaTableRow
                        key={field.b_id}
                        field={field}
                        promise={promises[i]}
                        b_id_farm={b_id_farm}
                        calendar={calendar}
                    />
                ))}
            </TableBody>
        </Table>
    )
}

function DynaTableRow({
    field,
    promise,
    b_id_farm,
    calendar,
}: {
    field: { b_id: string; b_name: string | null }
    promise: Promise<FarmDynaResult>
    b_id_farm: string
    calendar: string
}) {
    return (
        <TableRow>
            <TableCell>
                <NavLink
                    to={`/farm/${b_id_farm}/${calendar}/mineralization/${field.b_id}/dyna`}
                    className="hover:underline font-medium"
                >
                    {field.b_name}
                </NavLink>
            </TableCell>
            <Suspense fallback={<DynaCellsSkeleton />}>
                <DynaCells promise={promise} />
            </Suspense>
        </TableRow>
    )
}

function DynaCells({ promise }: { promise: Promise<FarmDynaResult> }) {
    const { result, error } = use(promise)

    const lastPoint = result?.calculationDyna?.[result.calculationDyna.length - 1]
    const nAvailability = lastPoint?.b_nw ?? 0
    const nUptake = lastPoint?.b_n_uptake ?? 0
    const leaching = lastPoint?.b_no3_leach ?? 0

    return (
        <>
            <TableCell className="text-right font-mono">
                {error ? "—" : nAvailability.toFixed(1)}
            </TableCell>
            <TableCell className="text-right font-mono">
                {error ? "—" : nUptake.toFixed(1)}
            </TableCell>
            <TableCell className="text-right font-mono text-amber-600 dark:text-amber-400">
                {error ? "—" : leaching.toFixed(1)}
            </TableCell>
            <TableCell className="text-center">
                {error ? (
                    <CircleX
                        className="h-4 w-4 text-destructive mx-auto"
                        title={error}
                    />
                ) : (
                    <CircleCheck className="h-4 w-4 text-green-500 mx-auto" />
                )}
            </TableCell>
        </>
    )
}

function DynaCellsSkeleton() {
    return (
        <>
            <TableCell className="text-right">
                <Loader2 className="h-3 w-3 text-muted-foreground animate-spin ml-auto" />
            </TableCell>
            <TableCell className="text-right">
                <Loader2 className="h-3 w-3 text-muted-foreground animate-spin ml-auto" />
            </TableCell>
            <TableCell className="text-right">
                <Loader2 className="h-3 w-3 text-muted-foreground animate-spin ml-auto" />
            </TableCell>
            <TableCell className="text-center">
                <Loader2 className="h-3 w-3 text-muted-foreground animate-spin mx-auto" />
            </TableCell>
        </>
    )
}
