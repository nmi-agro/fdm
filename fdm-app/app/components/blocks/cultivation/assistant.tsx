import { cn } from "cn"
import { format } from "date-fns"
import { ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"
import { NavLink, useFetcher } from "react-router"
import type { CultivationSuggestionResult } from "~/lib/cultivation-suggestion.server"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { CultivationSuggestionStatusBanner } from "./suggestion"

/** A field without a main cultivation, with its BRP-based cultivation suggestion. */
export type FieldCultivationSuggestion = {
  b_id: string
  b_name: string
  result: CultivationSuggestionResult
}

/**
 * The "Teeltassistent" on the farm dashboard: tells how many fields have no main cultivation in
 * the year and lets the user review and accept the BRP-based suggestions for them in one step.
 *
 * The suggestions come from the NMI API and may arrive after the page has rendered. While
 * `fields` is `undefined`, the assistant shows the number of fields and that the suggestions
 * are being loaded.
 */
export function CultivationAssistant({
  b_id_farm,
  cultivationYear,
  fieldsMissingCultivation,
  fields,
  canWrite,
}: {
  b_id_farm: string
  cultivationYear: string
  /** Number of fields without a main cultivation in the year. */
  fieldsMissingCultivation: number
  /** The suggestion per field, or `undefined` while they are being loaded. */
  fields: FieldCultivationSuggestion[] | undefined
  canWrite: boolean
}) {
  const fetcher = useFetcher()
  const [showMissingCultivationDetails, setShowMissingCultivationDetails] = useState(false)
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)

  const isAcceptingAll = fetcher.state !== "idle"
  const suggestedFields = useMemo(
    () => (fields ?? []).filter((field) => field.result.status === "suggested"),
    [fields],
  )
  const suggestedFieldsCount = suggestedFields.length

  // Pruned against the current suggestedFields during render, instead of via an effect, so a
  // field that drops out of the list (e.g. after a revalidation) can't linger as "selected".
  const [rawSelectedFieldIds, setSelectedFieldIds] = useState<string[]>([])
  const selectedFieldIds = rawSelectedFieldIds.filter((id) =>
    suggestedFields.some((f) => f.b_id === id),
  )

  const toggleFieldSelection = (b_id: string) => {
    setSelectedFieldIds((prev) =>
      prev.includes(b_id) ? prev.filter((id) => id !== b_id) : [...prev, b_id],
    )
  }

  const toggleAllFields = () => {
    if (selectedFieldIds.length === suggestedFields.length) {
      setSelectedFieldIds([])
    } else {
      setSelectedFieldIds(suggestedFields.map((f) => f.b_id))
    }
  }

  const handleOpenReviewDialog = () => {
    setSelectedFieldIds(suggestedFields.map((f) => f.b_id))
    setIsReviewDialogOpen(true)
  }

  const handleOpenReviewForSingleField = (b_id: string) => {
    setSelectedFieldIds([b_id])
    setIsReviewDialogOpen(true)
  }

  return (
    <>
      <div className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 transition-all dark:border-amber-500/20 dark:bg-amber-500/10">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 shrink-0 rounded-md bg-amber-500/15 p-1.5 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
              Teeltassistent
            </p>
            <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/90">
              {fieldsMissingCultivation}{" "}
              {fieldsMissingCultivation === 1 ? "perceel heeft" : "percelen hebben"} nog geen
              hoofdteelt voor dit jaar.
            </p>
          </div>
        </div>

        {fields === undefined ? (
          <div
            role="status"
            className="flex items-center gap-1.5 border-t border-amber-500/15 pt-2 text-xs text-amber-800/90 dark:text-amber-200/90"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>BRP-voorstellen ophalen...</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/15 pt-1">
            {suggestedFieldsCount > 0 && canWrite ? (
              <Button
                type="button"
                size="sm"
                onClick={handleOpenReviewDialog}
                disabled={isAcceptingAll}
                className="h-8 cursor-pointer gap-1.5 bg-amber-600 text-xs font-medium text-white shadow-xs transition-all hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
              >
                Controleer & accepteer ({suggestedFieldsCount})
              </Button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={() => setShowMissingCultivationDetails((prev) => !prev)}
              className="ml-auto flex cursor-pointer items-center gap-1 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100"
            >
              {showMissingCultivationDetails ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span key="hide">Verberg details</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span key="show">Details per perceel</span>
                </>
              )}
            </button>
          </div>
        )}

        {fields !== undefined && showMissingCultivationDetails && (
          <div className="max-h-80 space-y-2.5 overflow-y-auto border-t border-amber-500/20 pt-3">
            {fields.map((field) => (
              <div key={field.b_id} className="space-y-1">
                <CultivationSuggestionStatusBanner
                  b_id_farm={b_id_farm}
                  calendar={cultivationYear}
                  b_id={field.b_id}
                  b_name={field.b_name}
                  result={field.result}
                  onAccept={canWrite ? () => handleOpenReviewForSingleField(field.b_id) : undefined}
                  canWrite={canWrite}
                />
                {field.result.status !== "suggested" && (
                  <NavLink
                    to={`${cultivationYear}/field/${field.b_id}/cultivation`}
                    className="block text-xs text-amber-800/80 underline underline-offset-2 hover:text-amber-950 dark:text-amber-300/80 dark:hover:text-amber-100"
                  >
                    {field.b_name}: hoofdteelt handmatig toevoegen →
                  </NavLink>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-amber-500/15 p-2 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="text-left">
                <DialogTitle>Teeltassistent: BRP-voorstellen controleren</DialogTitle>
                <DialogDescription className="mt-1 text-xs">
                  Controleer de BRP-schattingen voor {suggestedFields.length}{" "}
                  {suggestedFields.length === 1 ? "perceel" : "percelen"}. Vink percelen aan of uit
                  voordat je ze in 1 stap toevoegt.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="text-muted-foreground flex items-center justify-between border-b pb-2 text-xs">
              <span className="font-medium">
                {selectedFieldIds.length} van {suggestedFields.length} percelen geselecteerd
              </span>
              <button
                type="button"
                onClick={toggleAllFields}
                className="text-primary cursor-pointer text-xs font-medium hover:underline"
              >
                <span key={selectedFieldIds.length === suggestedFields.length ? "none" : "all"}>
                  {selectedFieldIds.length === suggestedFields.length
                    ? "Alles deselecteren"
                    : "Alles selecteren"}
                </span>
              </button>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {suggestedFields.map((field) => {
                const isChecked = selectedFieldIds.includes(field.b_id)
                const suggestion =
                  field.result.status === "suggested" ? field.result.suggestion : undefined

                if (!suggestion) return null

                return (
                  <div
                    key={field.b_id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isChecked}
                    onClick={() => toggleFieldSelection(field.b_id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        toggleFieldSelection(field.b_id)
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      isChecked
                        ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10"
                        : "border-border bg-muted/20 opacity-60 hover:opacity-100",
                    )}
                  >
                    <Checkbox
                      checked={isChecked}
                      tabIndex={-1}
                      className="pointer-events-none mt-0.5"
                    />
                    <div className="min-w-0 flex-1 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-foreground font-semibold">{field.b_name}</p>
                        <Badge variant="secondary" className="py-0 text-[10px] font-normal">
                          BRP-schatting
                        </Badge>
                      </div>
                      <p className="text-muted-foreground font-medium">
                        Voorgesteld gewas:{" "}
                        <span className="text-foreground font-semibold">
                          {suggestion.b_lu_name}
                        </span>
                      </p>
                      <div className="text-muted-foreground flex items-center gap-3 text-[11px]">
                        <span>
                          Start:{" "}
                          <span className="text-foreground font-medium">
                            {format(new Date(suggestion.b_lu_start), "dd-MM-yyyy")}
                          </span>
                        </span>
                        {suggestion.b_lu_end && (
                          <span>
                            Einde:{" "}
                            <span className="text-foreground font-medium">
                              {format(new Date(suggestion.b_lu_end), "dd-MM-yyyy")}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReviewDialogOpen(false)}
              disabled={isAcceptingAll}
            >
              Annuleren
            </Button>
            <fetcher.Form
              method="post"
              onSubmit={() => {
                setTimeout(() => setIsReviewDialogOpen(false), 200)
              }}
            >
              <input type="hidden" name="intent" value="accept_all_suggestions" />
              <input type="hidden" name="calendar" value={cultivationYear} />
              {selectedFieldIds.map((b_id) => (
                <input key={b_id} type="hidden" name="selected_b_id" value={b_id} />
              ))}
              <Button
                type="submit"
                disabled={selectedFieldIds.length === 0 || isAcceptingAll}
                className="cursor-pointer gap-1.5 bg-amber-600 font-medium text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
              >
                {isAcceptingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Toevoegen...</span>
                  </>
                ) : (
                  <span key={selectedFieldIds.length}>
                    {`Bevestigen en toevoegen (${selectedFieldIds.length})`}
                  </span>
                )}
              </Button>
            </fetcher.Form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
