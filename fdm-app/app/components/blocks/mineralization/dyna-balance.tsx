import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import type { DynaNitrogenBalance } from "~/integrations/mineralization.server"

interface DynaBalanceCardProps {
    nitrogenBalance: DynaNitrogenBalance
}

interface BalanceRow {
    label: string
    value: number
    isTotal?: boolean
}

export function DynaBalanceCard({ nitrogenBalance }: DynaBalanceCardProps) {
    const rows: BalanceRow[] = [
        {
            label: "Kunstmest",
            value: nitrogenBalance.b_n_fertilizer_artificial,
        },
        {
            label: "Organische mest",
            value: nitrogenBalance.b_n_fertilizer_organic,
        },
        {
            label: "Groenbemester",
            value: nitrogenBalance.b_n_greenmanure,
        },
        {
            label: "Voorvrucht",
            value: nitrogenBalance.b_n_fertilizer_preceeding,
        },
    ]

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Werkzame N-balans</CardTitle>
                <CardDescription>
                    Stikstofaanbod naar bron (kg N/ha/jaar)
                </CardDescription>
            </CardHeader>
            <CardContent>
                <dl className="space-y-2 text-sm">
                    {rows.map((row) => (
                        <div key={row.label} className="flex justify-between">
                            <dt className="text-muted-foreground">
                                {row.label}
                            </dt>
                            <dd className="font-medium tabular-nums">
                                {row.value.toFixed(1)} kg N/ha
                            </dd>
                        </div>
                    ))}
                    <Separator className="my-1" />
                    <div className="flex justify-between">
                        <dt className="font-semibold">Totaal</dt>
                        <dd className="font-semibold tabular-nums">
                            {nitrogenBalance.b_nw.toFixed(1)} kg
                            N/ha
                        </dd>
                    </div>
                </dl>
            </CardContent>
        </Card>
    )
}
