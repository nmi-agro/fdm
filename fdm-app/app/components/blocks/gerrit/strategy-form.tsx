import { Bot, ChevronDown } from "lucide-react"
import { useEffect, useState } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import { RemixFormProvider } from "remix-hook-form"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
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
  p_type_rvo?: string | null
}

interface StrategyFormProps {
  form: UseFormReturn<GerritFormValues>
  isGenerating: boolean
  isRateLimited?: boolean
  additionalContextValue: string | undefined
  calendar: string
  fertilizerOptions?: FertilizerOption[]
}

export function StrategyForm({
  form,
  isGenerating,
  isRateLimited = false,
  additionalContextValue,
  calendar,
  fertilizerOptions = [],
}: StrategyFormProps) {
  const additionalContextLength = additionalContextValue?.length ?? 0
  const showDerogation = Number.parseInt(calendar, 10) < 2026
  const showRenure = Number.parseInt(calendar, 10) >= 2026
  const [fertOpen, setFertOpen] = useState(false)
  const [fertSearch, setFertSearch] = useState("")

  // All available IDs; default = all selected
  const allIds = fertilizerOptions.map((f) => f.p_id_catalogue)
  const currentSelected = (form.watch("selectedFertilizerIds") as string[] | undefined) ?? allIds
  const selectedSet = new Set(currentSelected)

  const groupedByType = fertilizerOptions.reduce<Record<string, FertilizerOption[]>>((acc, f) => {
    const key = f.p_type ?? "mineral"
    if (!acc[key]) acc[key] = []
    acc[key].push(f)
    return acc
  }, {})

  const toggleFertilizer = (id: string, checked: boolean) => {
    const next = checked ? [...selectedSet, id] : [...selectedSet].filter((x) => x !== id)
    // If all selected, store undefined (= use all, no restriction)
    form.setValue(
      "selectedFertilizerIds" as any,
      next.length === allIds.length ? (allIds as any) : (next as any),
      { shouldDirty: true },
    )
  }

  const toggleGroup = (type: string, selectAll: boolean, visibleIds?: string[]) => {
    const allGroupIds = (groupedByType[type] ?? []).map((f) => f.p_id_catalogue)
    const groupIds = visibleIds ? allGroupIds.filter((id) => visibleIds.includes(id)) : allGroupIds
    const next = selectAll
      ? [...new Set([...selectedSet, ...groupIds])]
      : [...selectedSet].filter((id) => !groupIds.includes(id))
    form.setValue("selectedFertilizerIds" as any, next as any, {
      shouldDirty: true,
    })
  }

  const selectedCount = selectedSet.size
  const totalCount = allIds.length
  const isRestricted = selectedCount < totalCount
  const fertError = (form.formState.errors as any)?.selectedFertilizerIds?.message as
    | string
    | undefined

  // Auto-open picker when there's a validation error on fertilizers
  useEffect(() => {
    if (fertError) setFertOpen(true)
  }, [fertError])

  const includeRenure = form.watch("includeRenure")

  useEffect(() => {
    if (!showRenure) return
    const renureCodes = ["130", "131", "132", "133", "134"]
    if (includeRenure === false) {
      const currentSelected = (form.getValues("selectedFertilizerIds") as string[] | undefined) ?? allIds
      const filtered = currentSelected.filter((id) => {
        const fert = fertilizerOptions.find((f) => f.p_id_catalogue === id)
        return !fert?.p_type_rvo || !renureCodes.includes(fert.p_type_rvo)
      })
      if (filtered.length !== currentSelected.length) {
        form.setValue("selectedFertilizerIds" as any, filtered as any, { shouldDirty: true })
      }
    }
  }, [includeRenure, showRenure, form, allIds, fertilizerOptions])

  return (
    <Card className="sticky top-6 h-fit">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <Bot className="text-primary h-6 w-6" />
            Bedrijfsstrategie & voorkeuren
          </CardTitle>
        </div>
        <CardDescription>
          Stel de kaders in waarbinnen Gerrit het optimale bemestingsplan berekent.
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
                "includeRenure",
              ]
                .filter((name) => {
                  if (name === "isDerogation") return showDerogation
                  if (name === "includeRenure") return showRenure
                  return true
                })
                .map((name) => (
                  <div key={name} className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label htmlFor={name} className="text-base">
                        {STRATEGY_LABELS[name]}
                      </Label>
                      <p className="text-muted-foreground text-sm leading-snug">
                        {name === "isOrganic" && "Geen gebruik van kunstmest."}
                        {name === "fillManureSpace" &&
                          "Volledig opvullen van de gebruiksruimte voor dierlijke mest."}
                        {name === "reduceAmmoniaEmissions" &&
                          "Gebruik emissiearme meststoffen en technieken."}
                        {name === "keepNitrogenBalanceBelowTarget" &&
                          "Stikstofoverschot beperken tot onder de doelwaarde."}
                        {name === "workOnRotationLevel" &&
                          "Percelen met hetzelfde gewas krijgen dezelfde bemesting."}
                        {name === "isDerogation" &&
                          "Geen gebruik van fosfaathoudende minerale meststoffen."}
                        {name === "includeRenure" &&
                          "Renure-producten overwegen in het bemestingsplan."}
                      </p>
                    </div>
                    <Controller
                      name={name as keyof GerritFormValues}
                      control={form.control}
                      render={({ field }) => (
                        <>
                          <Switch
                            id={name}
                            checked={field.value as boolean}
                            onCheckedChange={field.onChange}
                            className="mt-1"
                            disabled={isGenerating}
                          />
                          <input type="hidden" name={name} value={field.value ? "true" : "false"} />
                        </>
                      )}
                    />
                  </div>
                ))}
            </div>
            {/* Fertilizer picker */}
            {fertilizerOptions.length > 0 && (
              <div className="border-t pt-2">
                <Collapsible open={fertOpen} onOpenChange={setFertOpen}>
                  <CollapsibleTrigger
                    className="flex w-full items-center justify-between py-2 text-left"
                    disabled={isGenerating}
                  >
                    <div className="space-y-0.5">
                      <p className="text-base font-medium">Meststoffenselectie</p>
                      {fertError ? (
                        <p className="text-sm text-red-500">{fertError}</p>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          {isRestricted
                            ? `${selectedCount} van ${totalCount} meststoffen geselecteerd`
                            : "Alle meststoffen geselecteerd"}
                        </p>
                      )}
                    </div>
                    <ChevronDown
                      className={cn(
                        "text-muted-foreground ml-2 h-4 w-4 shrink-0 transition-transform",
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
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Zoeken…"
                        value={fertSearch}
                        onChange={(e) => setFertSearch(e.target.value)}
                        disabled={isGenerating}
                        className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring h-8 flex-1 rounded-md border px-3 text-sm focus:ring-1 focus:outline-none disabled:opacity-50"
                      />
                      <button
                        type="button"
                        disabled={isGenerating}
                        className="text-primary shrink-0 text-xs hover:underline disabled:opacity-50"
                        onClick={() => {
                          if (selectedCount === totalCount) {
                            // Deselect all
                            form.setValue("selectedFertilizerIds" as any, [] as any, {
                              shouldDirty: true,
                            })
                          } else {
                            form.setValue("selectedFertilizerIds" as any, allIds as any, {
                              shouldDirty: true,
                            })
                          }
                        }}
                      >
                        {selectedCount === totalCount ? "Geen" : "Alle"}
                      </button>
                    </div>
                    {/* Scrollable list — grouped, each group collapsible */}
                    <div className="bg-muted/20 max-h-56 space-y-1 overflow-y-auto rounded-md border px-2 py-2">
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
                            <div className="bg-background sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t border-b px-1 py-1">
                              <span className="text-muted-foreground min-w-0 truncate text-xs font-semibold">
                                {TYPE_LABELS[type] ?? type}{" "}
                                <span className="text-muted-foreground/70 font-normal">
                                  ({selectedInGroup}/{filtered.length})
                                </span>
                              </span>
                              <button
                                type="button"
                                disabled={isGenerating}
                                className="text-primary shrink-0 text-xs hover:underline disabled:opacity-50"
                                onClick={() =>
                                  toggleGroup(
                                    type,
                                    !allGroupSelected,
                                    filtered.map((f) => f.p_id_catalogue),
                                  )
                                }
                              >
                                {allGroupSelected ? "Geen" : "Alle"}
                              </button>
                            </div>
                            <div className="mt-1 mb-2 space-y-0.5">
                              {filtered.map((f) => (
                                <div
                                  key={f.p_id_catalogue}
                                  className="hover:bg-muted/60 flex items-center gap-2 rounded px-1 py-0.5"
                                >
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
                                    className="cursor-pointer text-sm leading-tight font-normal"
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
              <div className="flex items-end justify-between">
                <Label htmlFor="additionalContext" className="text-base">
                  Aanvullende opmerkingen of wensen
                </Label>
                <span
                  className={`text-xs ${additionalContextLength > 1000 ? "font-medium text-red-500" : "text-muted-foreground"}`}
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
                  {form.formState.errors.additionalContext.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full py-6 text-lg"
              disabled={isGenerating || isRateLimited}
            >
              {isGenerating ? (
                <>
                  <Spinner className="mr-3 h-5 w-5" />
                  Gerrit berekent het plan...
                </>
              ) : isRateLimited ? (
                "Dagelijks limiet bereikt"
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
