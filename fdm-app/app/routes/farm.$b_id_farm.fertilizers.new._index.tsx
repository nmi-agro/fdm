import { type Fertilizer, getFertilizers } from "@nmi-agro/fdm-core"
import { Pencil, Plus } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import type { LoaderFunctionArgs } from "react-router"
import { Link, useLoaderData, useNavigate, useSearchParams } from "react-router"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { getRvoMappings } from "~/components/blocks/fertilizer/utils.server"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "~/components/ui/command"
import { getSession } from "~/lib/auth.server"
import { fdm } from "~/lib/fdm.server"
import { cn } from "~/lib/utils"

export async function loader({ request, params }: LoaderFunctionArgs) {
    const { b_id_farm } = params
    if (!b_id_farm) {
        throw new Error("Farm ID is required")
    }

    const session = await getSession(request)

    const fertilizers = await getFertilizers(
        fdm,
        session.principal_id,
        b_id_farm,
    )

    const { rvoLabels } = await getRvoMappings()

    return {
        b_id_farm: b_id_farm,
        fertilizers: fertilizers,
        rvoLabels,
    }
}

/**
 * Renders the new fertilizer wizard start page.
 *
 * Provides two paths: selecting a template from the catalogue or starting with a blank form.
 */
export default function NewFertilizerIndexPage() {
    const { fertilizers, b_id_farm, rvoLabels } = useLoaderData<typeof loader>()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const [searchQuery, setSearchQuery] = useState("")

    const getSourceName = useCallback((isCustom: boolean) => {
        if (isCustom) return "Eigen meststof"
        return "Standaard"
    }, [])

    const handleSelect = (p_id: string) => {
        const returnUrl = searchParams.get("returnUrl")
        const url = returnUrl
            ? `${p_id}?returnUrl=${encodeURIComponent(returnUrl)}`
            : `${p_id}`
        navigate(url)
    }

    // Filter logic built into Command, but we prepare data here
    const preparedFertilizers = useMemo(() => {
        return fertilizers.map((f: Fertilizer) => {
            const isCustom = f.p_source === b_id_farm
            const rvoLabel = f.p_type_rvo ? rvoLabels[f.p_type_rvo] : ""
            return {
                ...f,
                isCustom,
                rvoLabel,
                sourceName: getSourceName(isCustom),
                searchString:
                    `${f.p_name_nl} ${f.p_type_rvo || ""} ${rvoLabel} ${getSourceName(isCustom)}`.toLowerCase(),
            }
        })
    }, [fertilizers, b_id_farm, rvoLabels, getSourceName])

    return (
        <div className="space-y-8">
            <FarmTitle
                title={"Meststof toevoegen"}
                description={
                    "Kies hoe u een nieuwe meststof wilt toevoegen: start met een leeg formulier of gebruik een bestaand product uit de catalogus als basis."
                }
            />
            <div className="p-4 md:p-8 pt-0 md:pt-0">
                <div className="mx-auto max-w-6xl w-full">
                    <div className="relative">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-32 items-start">
                            {/* Choice 1: Manual Creation */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                            1
                                        </div>
                                        <h2 className="text-2xl font-bold tracking-tight text-foreground">
                                            Zelf samenstellen
                                        </h2>
                                    </div>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Heeft u een specifieke analyse van een
                                        product? Start met een leeg formulier en
                                        voer alle parameters handmatig in.
                                    </p>
                                </div>

                                <Card className="flex flex-col items-center justify-center p-10 bg-muted/20 border-2 border-dashed hover:bg-muted/30 transition-colors group">
                                    <div className="h-16 w-16 rounded-full bg-background flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                                        <Plus className="h-8 w-8 text-primary" />
                                    </div>
                                    <Button
                                        asChild
                                        size="lg"
                                        className="w-full font-bold shadow-sm"
                                    >
                                        <Link
                                            to={
                                                searchParams.has("returnUrl")
                                                    ? `custom?returnUrl=${encodeURIComponent(searchParams.get("returnUrl") ?? "")}`
                                                    : "custom"
                                            }
                                        >
                                            Start leeg formulier
                                        </Link>
                                    </Button>
                                </Card>
                            </div>

                            {/* Choice 2: Select from Catalogue */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                            2
                                        </div>
                                        <h2 className="text-2xl font-bold tracking-tight text-foreground">
                                            Kies uit lijst
                                        </h2>
                                    </div>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Zoek in de standaard catalogus of uw
                                        eigen lijst om een meststof als sjabloon
                                        te gebruiken en snel te kunnen starten.
                                    </p>
                                </div>

                                <Card className="overflow-hidden border-2 shadow-sm">
                                    <Command
                                        className="border-none"
                                        shouldFilter={false}
                                    >
                                        <CommandInput
                                            aria-label="Zoek meststof in catalogus"
                                            placeholder="Zoek product of categorie..."
                                            value={searchQuery}
                                            onValueChange={setSearchQuery}
                                            className="text-base py-6"
                                        />
                                        <CommandList className="max-h-112.5 overflow-y-auto p-2 border-t">
                                            <CommandEmpty className="py-10 text-center text-sm text-muted-foreground leading-relaxed px-4">
                                                Geen meststoffen gevonden voor "
                                                {searchQuery}"<br />
                                                <span className="text-xs">
                                                    Probeer een andere zoekterm
                                                    of gebruik handmatige
                                                    invoer.
                                                </span>
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {preparedFertilizers
                                                    .filter(
                                                        (f) =>
                                                            !searchQuery ||
                                                            f.searchString.includes(
                                                                searchQuery.toLowerCase(),
                                                            ),
                                                    )
                                                    .map((fertilizer) => (
                                                        <CommandItem
                                                            key={
                                                                fertilizer.p_id
                                                            }
                                                            value={
                                                                fertilizer.p_id
                                                            }
                                                            onSelect={() =>
                                                                handleSelect(
                                                                    fertilizer.p_id,
                                                                )
                                                            }
                                                            className="flex items-center justify-between p-3 cursor-pointer rounded-md mb-1"
                                                        >
                                                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium text-base truncate text-foreground">
                                                                        {fertilizer.p_name_nl ||
                                                                            "Onbekend"}
                                                                    </span>
                                                                    {fertilizer.isCustom && (
                                                                        <Badge
                                                                            variant="secondary"
                                                                            className="px-1.5 py-0 h-4 text-[10px] font-normal bg-amber-100 text-amber-800 border-amber-200 shrink-0"
                                                                        >
                                                                            <Pencil className="h-2.5 w-2.5 mr-1" />
                                                                            Eigen
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                                    <span className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                                                                        <span>
                                                                            N:{" "}
                                                                            <strong className="text-foreground font-medium">
                                                                                {fertilizer.p_n_rt ??
                                                                                    "-"}
                                                                            </strong>
                                                                        </span>
                                                                        <span>
                                                                            •
                                                                        </span>
                                                                        <span>
                                                                            P₂O₅:{" "}
                                                                            <strong className="text-foreground font-medium">
                                                                                {fertilizer.p_p_rt ??
                                                                                    "-"}
                                                                            </strong>
                                                                        </span>
                                                                        <span>
                                                                            •
                                                                        </span>
                                                                        <span>
                                                                            K₂O:{" "}
                                                                            <strong className="text-foreground font-medium">
                                                                                {fertilizer.p_k_rt ??
                                                                                    "-"}
                                                                            </strong>
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {fertilizer.p_type_rvo && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className={cn(
                                                                        "shrink-0 ml-4 hidden sm:flex border-transparent font-medium",
                                                                        fertilizer.p_type ===
                                                                            "manure"
                                                                            ? "bg-amber-600 text-white hover:bg-amber-700"
                                                                            : fertilizer.p_type ===
                                                                                "compost"
                                                                              ? "bg-green-600 text-white hover:bg-green-700"
                                                                              : fertilizer.p_type ===
                                                                                  "mineral"
                                                                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                                                                : "bg-gray-600 text-white hover:bg-gray-700",
                                                                    )}
                                                                >
                                                                    {fertilizer.rvoLabel ||
                                                                        "Meststof"}
                                                                </Badge>
                                                            )}
                                                        </CommandItem>
                                                    ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </Card>
                            </div>

                            {/* Vertical Separator for desktop */}
                            <div className="hidden lg:flex absolute inset-y-0 left-1/2 -translate-x-1/2 items-center justify-center pointer-events-none px-4">
                                <div className="h-full w-px bg-border relative">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 py-1.5 border rounded-full text-[10px] font-bold text-muted-foreground uppercase tracking-widest shadow-sm">
                                        OF
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
