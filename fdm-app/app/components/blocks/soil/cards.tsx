import type {
    CurrentSoilData,
    SoilParameterDescription,
} from "@nmi-agro/fdm-core"
import { format } from "date-fns/format"
import { nl } from "date-fns/locale/nl"
import {
    Calendar,
    ExternalLink,
    Microscope,
    Pencil,
    Sparkles,
    User,
} from "lucide-react"
import { NavLink } from "react-router"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

const SOIL_GROUPS = [
    {
        title: "Basis",
        parameters: ["b_soiltype_agr", "a_som_loi", "a_ph_cc", "b_gwl_class"],
    },
    {
        title: "Nutriënten",
        parameters: [
            "a_n_rt",
            "a_p_cc",
            "a_p_al",
            "a_p_wa",
            "a_k_cc",
            "a_s_rt",
            "a_mg_cc",
            "a_zn_cc",
            "a_cu_cc",
        ],
    },
    {
        title: "Textuur",
        parameters: ["a_clay_mi", "a_silt_mi", "a_sand_mi", "a_density_sa"],
    },
    {
        title: "N-mineraal",
        parameters: ["a_nmin_cc", "a_nh4_cc", "a_no3_cc"],
    },
    {
        title: "Bezetting",
        parameters: [
            "a_cec_co",
            "a_ca_co",
            "a_ca_co_po",
            "a_k_co",
            "a_k_co_po",
            "a_mg_co",
            "a_mg_co_po",
        ],
    },
    {
        title: "Overig",
        parameters: [
            "a_p_rt",
            "a_p_ox",
            "a_fe_ox",
            "a_al_ox",
            "a_p_sg",
            "a_caco3_if",
            "a_cn_fr",
            "a_com_fr",
            "a_n_pmn",
        ],
    },
]

function SoilDataCard({
    title,
    description,
    value,
    label,
    unit,
    type,
    link,
    date,
    source,
    sourceLabel,
    canModify,
}: {
    title: string
    description: string
    value: number | string | null
    label: string | undefined
    unit: string
    type: "numeric" | "enum"
    link: string
    date: Date | null
    source: string | null
    sourceLabel: string
    canModify: boolean
}) {
    const EditIcon = canModify ? Pencil : ExternalLink
    return (
        <Card className="flex flex-col h-full transition-colors hover:bg-accent/5">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 space-x-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <CardTitle className="text-sm font-semibold leading-tight truncate cursor-help decoration-dotted underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-muted-foreground/60 transition-colors">
                                    {title}
                                </CardTitle>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[250px]">
                                {description}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                {source !== "nl-other-nmi" ? (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <NavLink to={link} className="h-4 w-4 shrink-0">
                                    <EditIcon className="text-xs text-muted-foreground h-full w-full opacity-50 hover:opacity-100 transition-opacity" />
                                </NavLink>
                            </TooltipTrigger>
                            <TooltipContent>
                                {canModify ? "Bewerken" : "Bekijken"}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : null}
            </CardHeader>
            <CardContent className="mt-auto pt-0 space-y-3">
                <div className="flex items-baseline space-x-1.5">
                    {value === null ? (
                        "Onbekend"
                    ) : type === "enum" ? (
                        <div className="text-xl font-bold leading-tight">
                            {label && type === "enum" ? label : value}
                        </div>
                    ) : (
                        <>
                            <div className="text-2xl font-bold tracking-tight">
                                {typeof value === "number"
                                    ? Math.round(value * 10) / 10
                                    : value}
                            </div>
                            <div className="text-[10px] font-medium text-muted-foreground">
                                {unit}
                            </div>
                        </>
                    )}
                </div>

                <div className="flex flex-col space-y-1.5 pt-1 border-t border-border/40">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    className={cn(
                                        "flex items-center space-x-1.5 text-[10px] text-muted-foreground",
                                        !source ? "invisible" : "",
                                    )}
                                >
                                    {source === "nl-other-nmi" ? (
                                        <Sparkles className="h-3 w-3 shrink-0" />
                                    ) : source === "other" || !source ? (
                                        <User className="h-3 w-3 shrink-0" />
                                    ) : (
                                        <Microscope className="h-3 w-3 shrink-0 text-primary/60" />
                                    )}
                                    <span className="truncate max-w-full">
                                        {sourceLabel}
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                {source === "nl-other-nmi"
                                    ? `Geschat met ${sourceLabel}`
                                    : source === "other" || !source
                                      ? "Onbekende bron"
                                      : `Gemeten door ${sourceLabel}`}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {!(!date || source === "nl-other-nmi") && (
                        <div className="flex items-center space-x-1.5 text-[10px] text-muted-foreground">
                            <Calendar className="h-3 w-3 shrink-0 opacity-60" />
                            <span>{format(date, "P", { locale: nl })}</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

export function SoilDataCards({
    currentSoilData,
    soilParameterDescription,
    canModifyAllSoilAnalyses = false,
    canModifySoilAnalysis = {},
}: {
    currentSoilData: CurrentSoilData
    soilParameterDescription: SoilParameterDescription
    canModifyAllSoilAnalyses?: boolean
    canModifySoilAnalysis?: Record<string, boolean>
}) {
    const cards = constructSoilDataCards(
        currentSoilData,
        soilParameterDescription,
    )

    return (
        <div className="space-y-10">
            {SOIL_GROUPS.map((group) => {
                const groupCards = cards
                    .filter((card) => group.parameters.includes(card.parameter))
                    .sort(
                        (a, b) =>
                            group.parameters.indexOf(a.parameter) -
                            group.parameters.indexOf(b.parameter),
                    )

                if (groupCards.length === 0) return null

                return (
                    <div key={group.title} className="space-y-4">
                        <div className="flex items-center gap-4">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.1em] whitespace-nowrap">
                                {group.title}
                            </h4>
                            <Separator className="flex-1 opacity-40" />
                        </div>
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                            {groupCards.map((card) => {
                                const sourceParam =
                                    soilParameterDescription.find(
                                        (x) => x.parameter === "a_source",
                                    )
                                const sourceOption = sourceParam?.options?.find(
                                    (x) => x.value === card.source,
                                )
                                const sourceLabel =
                                    sourceOption?.label ||
                                    card.source ||
                                    "Onbekend"

                                return (
                                    <SoilDataCard
                                        key={card.parameter}
                                        title={card.title}
                                        description={card.description}
                                        value={card.value}
                                        label={card.label}
                                        unit={card.unit}
                                        type={card.type}
                                        link={card.link}
                                        date={card.date}
                                        source={card.source}
                                        sourceLabel={sourceLabel}
                                        canModify={
                                            canModifyAllSoilAnalyses ||
                                            canModifySoilAnalysis[card.a_id]
                                        }
                                    />
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function constructSoilDataCards(
    currentSoilData: CurrentSoilData,
    soilParameterDescription: SoilParameterDescription,
) {
    // Construct the soil data cards
    const cardValues = currentSoilData.map((item) => {
        const description = soilParameterDescription.find(
            (x: { parameter: string }) => {
                return x.parameter === item.parameter
            },
        )

        if (!description) {
            console.warn(
                `No description found for parameter: ${item.parameter}`,
            )
            return null
        }

        if (description.type !== "numeric" && description.type !== "enum") {
            return null
        }

        let label: string | undefined
        if (description.type === "enum") {
            label = description.options?.find(
                (option: { value: string }) => option.value === item.value,
            )?.label
        }

        return {
            parameter: item.parameter,
            title: description.name,
            description: description.description,
            value: item.value,
            label: label,
            unit: description.unit,
            type: description.type,
            a_id: item.a_id,
            link: `./analysis/${item.a_id}`,
            date: item.b_sampling_date,
            source: item.a_source,
        }
    })
    return cardValues.filter((x) => x !== null)
}
