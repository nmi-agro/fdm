import { CircleX } from "lucide-react"
import { NavLink } from "react-router"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import type { NSupplyResult } from "~/integrations/mineralization.server"

interface FieldListProps {
    results: NSupplyResult[]
    b_id_farm: string
    calendar: string
}

function getCurrentDoy(): number {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    return (
        Math.ceil(
            (now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1
    )
}

export function FieldList({ results, b_id_farm, calendar }: FieldListProps) {
    const sorted = [...results].sort((a, b) => b.totalAnnualN - a.totalAnnualN)
    const currentDoy = getCurrentDoy()

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Perceel</TableHead>
                    <TableHead className="text-right">
                        N Levering (kg N/ha)
                    </TableHead>
                    <TableHead className="text-right">% vandaag</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sorted.map((result) => (
                    <TableRow key={result.b_id}>
                        <TableCell>
                            <NavLink
                                to={`/farm/${b_id_farm}/${calendar}/mineralization/${result.b_id}`}
                                className="hover:underline font-medium"
                            >
                                {result.b_name}
                            </NavLink>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                            {result.error
                                ? "—"
                                : Math.round(result.totalAnnualN)}
                        </TableCell>
                        <TableCell className="text-right">
                            <NMineralizedToday
                                result={result}
                                currentDoy={currentDoy}
                            />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

function NMineralizedToday({
    result,
    currentDoy,
}: {
    result: NSupplyResult
    currentDoy: number
}) {
    if (result.error) {
        return (
            <span title={result.error}>
                <CircleX className="h-4 w-4 text-muted-foreground inline" />
            </span>
        )
    }
    if (result.data.length === 0 || result.totalAnnualN === 0) {
        return <span className="text-muted-foreground text-xs">—</span>
    }

    const todayPoint = result.data.reduce((prev, curr) =>
        Math.abs(curr.doy - currentDoy) < Math.abs(prev.doy - currentDoy)
            ? curr
            : prev,
    )
    const pct = Math.round(
        (todayPoint.d_n_supply_actual / result.totalAnnualN) * 100,
    )

    return (
        <span
            className="font-mono text-sm"
            title={`${todayPoint.d_n_supply_actual.toFixed(1)} kg N/ha vandaag`}
        >
            {pct}%
        </span>
    )
}
