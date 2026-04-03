import { CircleAlert, CircleX } from "lucide-react"
import { NavLink } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import type {
    DataCompleteness,
    NSupplyMethod,
} from "~/integrations/mineralisatie.server"

const PARAM_LABELS: Record<string, string> = {
    a_som_loi: "Organische stof (LOI)",
    a_clay_mi: "Kleigehalte",
    a_silt_mi: "Siltgehalte",
    a_sand_mi: "Zandgehalte",
    a_c_of: "Organisch koolstof (OF)",
    a_cn_fr: "C/N-verhouding",
    a_n_rt: "Totaal stikstof",
    a_n_pmn: "PMN (mineraliseerbaar N)",
    b_soiltype_agr: "Bodemtype",
    a_depth_lower: "Bemonsteringsdiepte",
}

const PARAM_UNITS: Record<string, string> = {
    a_som_loi: "%",
    a_clay_mi: "%",
    a_silt_mi: "%",
    a_sand_mi: "%",
    a_c_of: "g C/kg",
    a_cn_fr: "—",
    a_n_rt: "mg N/kg",
    a_n_pmn: "mg N/kg",
    b_soiltype_agr: "",
    a_depth_lower: "cm",
}

const METHOD_LABELS: Record<NSupplyMethod, string> = {
    minip: "MINIP",
    pmn: "PMN",
    century: "Century",
}

const NMI_SOURCE = "nl-other-nmi"

function isNmiEstimate(source: string | undefined): boolean {
    return source === NMI_SOURCE
}

interface DataCompletenessProps {
    completeness: DataCompleteness
    method: NSupplyMethod
    b_id_farm: string
    b_id: string
    calendar: string
}

export function DataCompletenessCard({
    completeness,
    method,
    b_id_farm,
    b_id,
    calendar,
}: DataCompletenessProps) {
    const { available, missing, estimated, score } = completeness

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Bodemgegevens</CardTitle>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge
                                    variant={
                                        score >= 80
                                            ? "default"
                                            : score >= 60
                                              ? "secondary"
                                              : "destructive"
                                    }
                                    className="cursor-help"
                                >
                                    {score}%
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent
                                side="left"
                                className="max-w-[220px]"
                            >
                                Aandeel vereiste parameters gemeten via
                                labanalyse. NMI BodemSchat-schattingen tellen
                                niet mee.
                                {missing.length > 0 && (
                                    <span>
                                        {" "}
                                        {missing.length} parameter
                                        {missing.length > 1 ? "s" : ""} ontbrek
                                        {missing.length > 1 ? "en" : "t"}.
                                    </span>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <CardDescription>
                    Beschikbare parameters voor {METHOD_LABELS[method]}-methode
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <ul className="space-y-2">
                    {available.map((item) => {
                        const isEstimate = isNmiEstimate(item.source)
                        const unit = PARAM_UNITS[item.param] ?? ""
                        return (
                            <li
                                key={item.param}
                                className="flex items-start gap-2 text-sm"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-muted-foreground">
                                            {PARAM_LABELS[item.param] ??
                                                item.param}
                                        </span>
                                        {isEstimate && (
                                            <Badge
                                                variant="secondary"
                                                className="text-[10px] px-1 py-0 h-4"
                                            >
                                                NMI BodemSchat
                                            </Badge>
                                        )}
                                    </div>
                                    {!isEstimate && item.date && (
                                        <span className="text-[10px] text-muted-foreground">
                                            {new Date(
                                                item.date,
                                            ).toLocaleDateString("nl-NL")}
                                        </span>
                                    )}
                                </div>
                                <span className="font-mono text-xs shrink-0">
                                    {typeof item.value === "number"
                                        ? item.value.toFixed(2)
                                        : item.value}
                                    {unit && unit !== "—" ? ` ${unit}` : ""}
                                </span>
                            </li>
                        )
                    })}
                    {missing.map((param) => (
                        <li
                            key={param}
                            className="flex items-center gap-2 text-sm"
                        >
                            <CircleX className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="flex-1 font-medium">
                                {PARAM_LABELS[param] ?? param}
                            </span>
                            <Badge
                                variant="destructive"
                                className="text-[10px] px-1 py-0 h-4"
                            >
                                Ontbreekt
                            </Badge>
                        </li>
                    ))}
                    {estimated.map((param) => (
                        <li
                            key={param}
                            className="flex items-center gap-2 text-sm"
                        >
                            <CircleAlert className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="flex-1 text-muted-foreground">
                                {PARAM_LABELS[param] ?? param}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                                Geschat
                            </span>
                        </li>
                    ))}
                </ul>

                {missing.length > 0 && (
                    <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-2">
                            Voeg een bodemanalyse toe voor een nauwkeurigere
                            berekening.
                        </p>
                        <Button asChild size="sm" variant="outline">
                            <NavLink
                                to={`/farm/${b_id_farm}/${calendar}/field/${b_id}/soil`}
                            >
                                Bodemanalyse toevoegen
                            </NavLink>
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
