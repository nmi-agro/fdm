import { ChevronDown } from "lucide-react"
import { Bot } from "lucide-react"
import { useEffect, useState } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import { RemixFormProvider } from "remix-hook-form"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "~/components/ui/collapsible"
import { Label } from "~/components/ui/label"
import { Spinner } from "~/components/ui/spinner"
import { Switch } from "~/components/ui/switch"
import { Textarea } from "~/components/ui/textarea"
import { cn } from "~/lib/utils"
import { type GerritFormValues, STRATEGY_LABELS } from "./schema"

const TYPE_LABELS: Record<string, string> = {
    manure: "Dierlijke mest",
    mineral: "Minerale meststoffen",
    compost: "Compost & organisch",
}

interface FertilizerOption {
    p_id_catalogue: string
    p_name_nl: string
    p_type: "manure" | "mineral" | "compost"
}

interface StrategyFormProps {
    form: UseFormReturn<GerritFormValues>
    isGenerating: boolean
    additionalContextValue: string | undefined
    calendar: string
    fertilizerOptions?: FertilizerOption[]
    onInfoClick?: () => void
}

export function StrategyForm({
    form,
    isGenerating,
    additionalContextValue,
    calendar,
    fertilizerOptions = [],
    onInfoClick,
}: StrategyFormProps) {
    const additionalContextLength = additionalContextValue?.length ?? 0
    const showDerogation = Number.parseInt(calendar, 10) < 2026
    const [fertOpen, setFertOpen] = useState(false)
    const [fertSearch, setFertSearch] = useState("")

    // All available IDs; default = all selected
    const allIds = fertilizerOptions.map((f) => f.p_id_catalogue)
    const currentSelected = (form.watch("selectedFertilizerIds") as string[] | undefined) ?? allIds
    const selectedSet = new Set(currentSelected)

    const groupedByType = fertilizerOptions.reduce<Record<string, FertilizerOption[]>>(
        (acc, f) => {
            const key = f.p_type ?? "mineral"
            if (!acc[key]) acc[key] = []
            acc[key].push(f)
            return acc
        },
        {},
    )

    const toggleFertilizer = (id: string, checked: boolean) => {
        const next = checked
            ? [...selectedSet, id]
            : [...selectedSet].filter((x) => x !== id)
        // If all selected, store undefined (= use all, no restriction)
        form.setValue(
            "selectedFertilizerIds" as any,
            next.length === allIds.length ? (allIds as any) : (next as any),
            { shouldDirty: true },
        )
    }

    const toggleGroup = (type: string, selectAll: boolean, visibleIds?: string[]) => {
        const allGroupIds = (groupedByType[type] ?? []).map((f) => f.p_id_catalogue)
        const groupIds = visibleIds
            ? allGroupIds.filter((id) => visibleIds.includes(id))
            : allGroupIds
        const next = selectAll
            ? [...new Set([...selectedSet, ...groupIds])]
            : [...selectedSet].filter((id) => !groupIds.includes(id))
        form.setValue("selectedFertilizerIds" as any, next as any, { shouldDirty: true })
    }

    const selectedCount = selectedSet.size
    const totalCount = allIds.length
    const isRestricted = selectedCount < totalCount
    const fertError = (form.formState.errors as any)?.selectedFertilizerIds?.message as string | undefined

    // Auto-open picker when there's a validation error on fertilizers
    useEffect(() => {
        if (fertError) setFertOpen(true)
    }, [fertError])

    return (
        <Card className="h-fit sticky top-6">
            <CardHeader>
                <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                        <Bot className="w-6 h-6 text-primary" />
                        Bedrijfsstrategie & voorkeuren
                    </CardTitle>
                    {onInfoClick && (
                        <button
                            type="button"
                            onClick={onInfoClick}
                            className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 hover:bg-amber-100 transition-colors shrink-0 mt-0.5"
                        >
                            Experimenteel
                        </button>
                    )}
                </div>
                <CardDescription>
                    Stel de kaders in waarbinnen Gerrit het optimale
                    bemestingsplan berekent.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <RemixFormProvider {...form}>
                    {/* form.handleSubmit from useRemixForm is (e) => … at runtime;
                        cast needed because RHF types it as UseFormHandleSubmit */}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <form onSubmit={form.handleSubmit as any} className="space-y-8">
                        <div className="space-y-6">
                            {[
                                "isOrganic",
                                "fillManureSpace",
                                "reduceAmmoniaEmissions",
                                "keepNitrogenBalanceBelowTarget",
                                "workOnRotationLevel",
                                "isDerogation",
                            ]
                                .filter(
                                    (name) =>
                                        name !== "isDerogation" ||
                                        showDerogation,
                                )
                                .map((name) => (
                                    <div
                                        key={name}
                                        className="flex items-start justify-between gap-4"
                                    >
                                        <div className="space-y-1">
                                            <Label
                                                htmlFor={name}
                                                className="text-base"
                                            >
                                                {STRATEGY_LABELS[name]}
                                            </Label>
                                            <p className="text-sm text-muted-foreground leading-snug">
                                                {name === "isOrganic" &&
                                                    "Geen gebruik van kunstmest."}
                                                {name === "fillManureSpace" &&
                                                    "Volledig opvullen van de gebruiksruimte voor dierlijke mest."}
                                                {name ===
                                                    "reduceAmmoniaEmissions" &&
                                                    "Gebruik emissiearme meststoffen en technieken."}
                                                {name ===
                                                    "keepNitrogenBalanceBelowTarget" &&
                                                    "Stikstofoverschot beperken tot onder de doelwaarde."}
                                                {name ===
                                                    "workOnRotationLevel" &&
                                                    "Percelen met hetzelfde gewas krijgen dezelfde bemesting."}
                                                {name === "isDerogation" &&
                                                    "Geen gebruik van fosfaathoudende minerale meststoffen."}
                                            </p>
                                        </div>
                                        <Controller
                                            name={
                                                name as keyof GerritFormValues
                                            }
                                            control={form.control}
                                            render={({ field }) => (
                                                <>
                                                    <Switch
                                                        id={name}
                                                        checked={
                                                            field.value as boolean
                                                        }
                                                        onCheckedChange={
                                                            field.onChange
                                                        }
                                                        className="mt-1"
                                                        disabled={isGenerating}
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name={name}
                                                        value={
                                                            field.value
                                                                ? "true"
                                                                : "false"
                                                        }
                                                    />
                                                </>
                                            )}
                                        />
                                    </div>
                                ))}
                        </div>
                        {/* Fertilizer picker */}
                        {fertilizerOptions.length > 0 && (
                            <div className="pt-2 border-t">
                                <Collapsible open={fertOpen} onOpenChange={setFertOpen}>
                                    <CollapsibleTrigger
                                        className="flex w-full items-center justify-between py-2 text-left"
                                        disabled={isGenerating}
                                    >
                                        <div className="space-y-0.5">
                                            <p className="text-base font-medium">
                                                Meststoffenselectie
                                            </p>
                                            {fertError ? (
                                                <p className="text-sm text-red-500">{fertError}</p>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">
                                                    {isRestricted
                                                        ? `${selectedCount} van ${totalCount} meststoffen geselecteerd`
                                                        : "Alle meststoffen geselecteerd"}
                                                </p>
                                            )}
                                        </div>
                                        <ChevronDown
                                            className={cn(
                                                "h-4 w-4 text-muted-foreground transition-transform shrink-0 ml-2",
                                                fertOpen && "rotate-180",
                                            )}
                                        />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-3 pt-2">
                                        {/* Hidden input carries the serialized value */}
                                        <input
                                            type="hidden"
                                            name="selectedFertilizerIds"
                                            value={JSON.stringify([...selectedSet])}
                                        />
                                        {/* Search + global toggle */}
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                placeholder="Zoeken…"
                                                value={fertSearch}
                                                onChange={(e) => setFertSearch(e.target.value)}
                                                disabled={isGenerating}
                                                className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                                            />
                                            <button
                                                type="button"
                                                disabled={isGenerating}
                                                className="text-xs text-primary hover:underline disabled:opacity-50 shrink-0"
                                                onClick={() => {
                                                    if (selectedCount === totalCount) {
                                                        // Deselect all
                                                        form.setValue("selectedFertilizerIds" as any, [] as any, { shouldDirty: true })
                                                    } else {
                                                        form.setValue("selectedFertilizerIds" as any, allIds as any, { shouldDirty: true })
                                                    }
                                                }}
                                            >
                                                {selectedCount === totalCount ? "Geen" : "Alle"}
                                            </button>
                                        </div>
                                        {/* Scrollable list — grouped, each group collapsible */}
                                        <div className="max-h-56 overflow-y-auto rounded-md border bg-muted/20 px-2 py-2 space-y-1">
                                            {Object.entries(groupedByType).map(([type, ferts]) => {
                                                const filtered = fertSearch.trim()
                                                    ? ferts.filter((f) =>
                                                          f.p_name_nl.toLowerCase().includes(fertSearch.toLowerCase()),
                                                      )
                                                    : ferts
                                                if (filtered.length === 0) return null
                                                const groupIds = filtered.map((f) => f.p_id_catalogue)
                                                const selectedInGroup = groupIds.filter((id) => selectedSet.has(id)).length
                                                const allGroupSelected = selectedInGroup === groupIds.length
                                                return (
                                                    <div key={type}>
                                                        <div className="flex items-center justify-between gap-2 px-1 py-1 sticky top-0 z-10 bg-background border-b rounded-t">
                                                            <span className="text-xs font-semibold text-muted-foreground min-w-0 truncate">
                                                                {TYPE_LABELS[type] ?? type}{" "}
                                                                <span className="font-normal text-muted-foreground/70">({selectedInGroup}/{filtered.length})</span>
                                                            </span>
                                                            <button
                                                                type="button"
                                                                disabled={isGenerating}
                                                                className="text-xs text-primary hover:underline disabled:opacity-50 shrink-0"
                                                                onClick={() => toggleGroup(type, !allGroupSelected, filtered.map((f) => f.p_id_catalogue))}
                                                            >
                                                                {allGroupSelected ? "Geen" : "Alle"}
                                                            </button>
                                                        </div>
                                                        <div className="space-y-0.5 mt-1 mb-2">
                                                            {filtered.map((f) => (
                                                                <div key={f.p_id_catalogue} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/60">
                                                                    <Checkbox
                                                                        id={`fert-${f.p_id_catalogue}`}
                                                                        checked={selectedSet.has(f.p_id_catalogue)}
                                                                        disabled={isGenerating}
                                                                        onCheckedChange={(checked) =>
                                                                            toggleFertilizer(f.p_id_catalogue, !!checked)
                                                                        }
                                                                    />
                                                                    <Label
                                                                        htmlFor={`fert-${f.p_id_catalogue}`}
                                                                        className="text-sm font-normal cursor-pointer leading-tight"
                                                                    >
                                                                        {f.p_name_nl}
                                                                    </Label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                        )}

                        <div className="space-y-3 pt-2">
                            <div className="flex justify-between items-end">
                                <Label
                                    htmlFor="additionalContext"
                                    className="text-base"
                                >
                                    Aanvullende opmerkingen of wensen
                                </Label>
                                <span
                                    className={`text-xs ${additionalContextLength > 1000 ? "text-red-500 font-medium" : "text-muted-foreground"}`}
                                >
                                    {additionalContextLength} / 1000
                                </span>
                            </div>
                            <Textarea
                                id="additionalContext"
                                placeholder="Bijv: Gebruik bij voorkeur eigen drijfmest op de huiskavel..."
                                className={`min-h-25 resize-none ${form.formState.errors.additionalContext ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                maxLength={1000}
                                {...form.register("additionalContext")}
                                disabled={isGenerating}
                            />
                            {form.formState.errors.additionalContext && (
                                <p className="text-sm text-red-500">
                                    {
                                        form.formState.errors.additionalContext
                                            .message
                                    }
                                </p>
                            )}
                        </div>
                        <Button
                            type="submit"
                            className="w-full py-6 text-lg"
                            disabled={isGenerating}
                        >
                            {isGenerating ? (
                                <>
                                    <Spinner className="mr-3 h-5 w-5" />
                                    Gerrit berekent het plan...
                                </>
                            ) : (
                                "Bemestingsplan genereren"
                            )}
                        </Button>
                    </form>
                </RemixFormProvider>
            </CardContent>
        </Card>
    )
}
