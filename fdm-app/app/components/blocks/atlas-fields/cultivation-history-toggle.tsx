import { GitBranch, List, Copy } from "lucide-react"
import { useParams } from "react-router"
import { useAtlasCultivationHistoryStore } from "~/store/atlas-cultivation-history"
import { toast } from "sonner"
import type { AdvancedCultivationHistory } from "~/components/blocks/atlas-fields/cultivation-history-advanced"
import { AdvancedCultivationFlow } from "~/components/blocks/atlas-fields/cultivation-history-advanced"
import {
    CultivationHistoryCard,
    CultivationHistoryTimeline,
} from "~/components/blocks/atlas-fields/cultivation-history"
import type { CultivationHistory } from "~/components/blocks/atlas-fields/cultivation-history"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"

export function CultivationHistoryToggle({
    cultivationHistory,
    advancedCultivationHistory,
}: {
    cultivationHistory: CultivationHistory[]
    advancedCultivationHistory: AdvancedCultivationHistory | null
}) {
    const view = useAtlasCultivationHistoryStore((s) => s.cultivationView)
    const setView = useAtlasCultivationHistoryStore((s) => s.setCultivationView)
    const currentYear = cultivationHistory
        .flatMap((c) => c.year)
        .reduce((max, year) => Math.max(max, year), 0)

    // No advanced data available – fall back to simple card
    if (!advancedCultivationHistory) {
        return (
            <CultivationHistoryCard cultivationHistory={cultivationHistory} />
        )
    }

    const handleCopy = () => {
        if (view === "simple") {
            const header = "jaar\tgewascode\tgewas\tis_rustgewas"
            const rows = cultivationHistory.map(
                (c) =>
                    `${c.year}\t${c.b_lu_catalogue.replace(/^nl_/, "")}\t${c.b_lu_name ?? ""}\t${c.b_lu_rest_oravib ? "Ja" : "Nee"}`,
            )
            navigator.clipboard.writeText([header, ...rows].join("\n")).then(
                () => toast.success("Gewashistorie gekopieerd naar klembord"),
                () => toast.error("Kopiëren naar klembord mislukt"),
            )
        } else {
            const header =
                "jaar\tb_lu_brp\tgewas\toverlap_ha\toverlap_pct_geselecteerd\toverlap_pct_historisch"
            const rows = advancedCultivationHistory.history.flatMap((yr) =>
                yr.fields.map(
                    (f) =>
                        `${yr.year}\t${f.b_lu_brp}\t${f.b_lu_name}\t${f.b_area_overlap.toFixed(4)}\t${Math.round(f.overlap_pct_of_selected * 100)}\t${Math.round(f.overlap_pct_of_historical * 100)}`,
                ),
            )
            navigator.clipboard.writeText([header, ...rows].join("\n")).then(
                () =>
                    toast.success(
                        "Uitgebreide gewashistorie gekopieerd naar klembord",
                    ),
                () => toast.error("Kopiëren naar klembord mislukt"),
            )
        }
    }

    return (
        <Card className="col-span-1 lg:row-span-2 overflow-hidden">
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl font-bold">
                        Gewashistorie
                    </CardTitle>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={handleCopy}
                                    aria-label="Kopieer naar klembord"
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Kopieer naar klembord</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <CardDescription className="mt-1">
                    {view === "simple"
                        ? "Gewassen zoals geregistreerd in de BRP."
                        : "Uitgebreide gewashistorie zoals in de BRP."}
                </CardDescription>
                <div className="pt-2">
                    <Tabs
                        value={view}
                        onValueChange={(v) =>
                            setView(v as "simple" | "advanced")
                        }
                    >
                        <TabsList>
                            <TabsTrigger value="simple">
                                <List className="h-3.5 w-3.5 mr-1.5" />
                                Eenvoudig
                            </TabsTrigger>
                            <TabsTrigger value="advanced">
                                <GitBranch className="h-3.5 w-3.5 mr-1.5" />
                                Uitgebreid
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </CardHeader>

            <Separator className="opacity-50" />

            <CardContent className="pt-6 text-sm">
                {view === "simple" ? (
                    <CultivationHistoryTimeline
                        cultivationHistory={cultivationHistory}
                    />
                ) : (
                    <AdvancedCultivationFlow
                        data={advancedCultivationHistory}
                        currentYear={currentYear}
                    />
                )}
            </CardContent>
        </Card>
    )
}
