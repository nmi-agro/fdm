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
    leaching: number
}

export function DynaBalanceCard({ nitrogenBalance, leaching }: DynaBalanceCardProps) {
    // Mineralisatie = b_nw - b_n_greenmanure - (artificial + organic fertilizer) - preceeding
    const mineralisatie =
        nitrogenBalance.b_nw -
        nitrogenBalance.b_n_greenmanure -
        nitrogenBalance.b_n_fertilizer_artificial -
        nitrogenBalance.b_n_fertilizer_organic -
        nitrogenBalance.b_n_fertilizer_preceeding

    // Total balance = b_nw - b_n_uptake - leaching
    const totalBalance = nitrogenBalance.b_nw - nitrogenBalance.b_n_uptake - leaching

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Werkzame N-balans</CardTitle>
                <CardDescription>
                    Stikstof uit mineralisatie en toevoegingen (kg N/ha/jaar)
                </CardDescription>
            </CardHeader>
            <CardContent>
                <dl className="space-y-2 text-sm">
                    {/* Mineralisatie (bodem) */}
                    <div className="flex justify-between">
                        <dt className="text-muted-foreground">
                            Bodem mineralisatie
                        </dt>
                        <dd className="font-medium tabular-nums">
                            {Math.round(mineralisatie)} kg N/ha
                        </dd>
                    </div>

                    {/* Artificial fertilizer */}
                    <div className="flex justify-between">
                        <dt className="text-muted-foreground">
                            Kunstmest
                        </dt>
                        <dd className="font-medium tabular-nums">
                            +{Math.round(nitrogenBalance.b_n_fertilizer_artificial)} kg N/ha
                        </dd>
                    </div>

                    {/* Organic fertilizer */}
                    <div className="flex justify-between">
                        <dt className="text-muted-foreground">
                            Organische mest
                        </dt>
                        <dd className="font-medium tabular-nums">
                            +{Math.round(nitrogenBalance.b_n_fertilizer_organic)} kg N/ha
                        </dd>
                    </div>

                    {/* Preceding crop */}
                    <div className="flex justify-between">
                        <dt className="text-muted-foreground">
                            Voorvrucht
                        </dt>
                        <dd className="font-medium tabular-nums">
                            +{Math.round(nitrogenBalance.b_n_fertilizer_preceeding)} kg N/ha
                        </dd>
                    </div>

                    {/* Green manure */}
                    <div className="flex justify-between">
                        <dt className="text-muted-foreground">
                            Groenbemesting
                        </dt>
                        <dd className="font-medium tabular-nums">
                            +{Math.round(nitrogenBalance.b_n_greenmanure)} kg N/ha
                        </dd>
                    </div>

                    <Separator className="my-1" />

                    {/* Total N aanbod */}
                    <div className="flex justify-between">
                        <dt className="font-semibold">Totaal aanbod</dt>
                        <dd className="font-semibold tabular-nums">
                            {Math.round(nitrogenBalance.b_nw)} kg N/ha
                        </dd>
                    </div>

                    {/* Uptake */}
                    <div className="flex justify-between">
                        <dt className="font-semibold">N-opname gewas</dt>
                        <dd className="font-semibold tabular-nums">
                            -{Math.round(nitrogenBalance.b_n_uptake)} kg N/ha
                        </dd>
                    </div>

                    {/* Leaching */}
                    <div className="flex justify-between">
                        <dt className="font-semibold text-amber-600 dark:text-amber-400">
                            N-NO₃ uitspoeling
                        </dt>
                        <dd className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                            -{Math.round(leaching)} kg N/ha
                        </dd>
                    </div>

                    <Separator className="my-1" />

                    {/* Balance (surplus/deficit) */}
                    <div className="flex justify-between">
                        <dt className="font-semibold">N-balans</dt>
                        <dd
                            className={`font-semibold tabular-nums ${
                                totalBalance > 0
                                    ? "text-orange-600"
                                    : "text-green-600"
                            }`}
                        >
                            {totalBalance > 0 ? "+" : ""}
                            {Math.round(totalBalance)} kg N/ha
                        </dd>
                    </div>
                </dl>
            </CardContent>
        </Card>
    )
}
