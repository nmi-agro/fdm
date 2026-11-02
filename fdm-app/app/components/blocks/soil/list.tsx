import type { SoilParameterDescription, SoilAnalysis } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import { Trash2 } from "lucide-react"
import { NavLink, type useFetcher } from "react-router"
import { PdfViewerDialogContent, ViewPdfButton } from "~/components/custom/pdf-viewer"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Button, buttonVariants } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"
import { Dialog, DialogTrigger } from "../../ui/dialog"
import { getSoilAnalysisDownloadName, getSoilAnalysisTitle } from "./download"

/**
 * The soil analyses of a field, newest first, with their source, the part of the field they
 * describe and the actions to view, edit or delete them. Deleting asks for confirmation first.
 */
export function SoilAnalysesList({
  soilAnalyses,
  soilParameterDescription,
  fetcher,
  canModifySoilAnalysis = {},
  fieldName,
  colorById = {},
  coverageById = {},
  highlightedIds = [],
  onHighlight,
}: {
  soilAnalyses: SoilAnalysis[]
  soilParameterDescription: SoilParameterDescription
  fetcher: ReturnType<typeof useFetcher>
  canModifySoilAnalysis?: Record<string, boolean>
  fieldName: string
  /** Map colour per analysis; analyses without a colour are not on the map. */
  colorById?: Record<string, string>
  /**
   * Share of the field (0–1) covered by the sampling zone of each analysis. Analyses that are
   * missing or `null` apply to the whole field.
   */
  coverageById?: Record<string, number | null>
  /** The analyses that are highlighted on the map. */
  highlightedIds?: string[]
  /** Called when the pointer or focus enters (`[a_id]`) or leaves (`[]`) an analysis in the list. */
  onHighlight?: (a_ids: string[]) => void
}) {
  const handleDelete = (a_id: string) => {
    if (fetcher.state !== "idle") return

    void fetcher.submit({ a_id }, { method: "DELETE" })
  }
  const sourceParam = soilParameterDescription.find(
    (x: { parameter: string }) => x.parameter === "a_source",
  )

  return (
    <ul className="space-y-2">
      {soilAnalyses.map((analysis, index) => {
        const sourceOption = sourceParam?.options?.find(
          (x: { value: string }) => x.value === analysis.a_source,
        )
        const sourceLabel = sourceOption?.label || analysis.a_source || "Onbekend"

        const isDeleting =
          fetcher.state !== "idle" && fetcher.formData?.get("a_id") === analysis.a_id
        const isEstimated = analysis.a_source === "nl-other-nmi"
        const canModify = canModifySoilAnalysis[analysis.a_id] === true

        const color = colorById[analysis.a_id]
        const coverage = coverageById[analysis.a_id] ?? null
        const dateLabel = analysis.b_sampling_date
          ? format(analysis.b_sampling_date, "PP", { locale: nl })
          : "Onbekende datum"
        const highlight = color ? () => onHighlight?.([analysis.a_id]) : undefined
        const clearHighlight = color ? () => onHighlight?.([]) : undefined

        return (
          <li
            className={cn(
              "-mx-2 space-y-3 rounded-md px-2 transition-colors",
              index > 0 && "pt-2",
              color && highlightedIds.includes(analysis.a_id) && "bg-muted/60",
            )}
            key={analysis.a_id}
            onMouseEnter={highlight}
            onMouseLeave={clearHighlight}
            onFocus={highlight}
            onBlur={clearHighlight}
          >
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm leading-none font-medium">
                {color && (
                  <span
                    className="inline-block size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                )}
                {isEstimated ? "Schatting" : dateLabel}
              </p>
              <p className="text-muted-foreground text-sm">
                {isEstimated
                  ? "Als er geen bodemanalyse beschikbaar is, wordt er een schatting gemaakt met NMI BodemSchat."
                  : analysis.a_source === "" || !analysis.a_source
                    ? "Onbekende bron"
                    : `Gemeten door ${sourceLabel}`}
              </p>
              {!isEstimated && (
                <p className="text-muted-foreground text-sm">
                  {coverage === null
                    ? "Geldt voor het hele perceel"
                    : `Geldt voor een zone van ${Math.round(coverage * 100)}% van het perceel`}
                </p>
              )}
            </div>

            {isEstimated ? null : (
              <div className="flex flex-wrap items-center gap-2">
                {analysis.a_file_path && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <ViewPdfButton variant="outline" />
                    </DialogTrigger>
                    <PdfViewerDialogContent
                      downloadUrl={`/api/soil-analysis/download/${analysis.a_id}.pdf`}
                      filename={getSoilAnalysisDownloadName(
                        analysis,
                        fieldName,
                        soilParameterDescription,
                      )}
                      title={getSoilAnalysisTitle(analysis, soilParameterDescription)}
                    />
                  </Dialog>
                )}
                <Button asChild size="sm" variant="outline">
                  <NavLink to={`./analysis/${analysis.a_id}`}>
                    {canModify ? "Bewerk" : "Bekijk"}
                  </NavLink>
                </Button>
                {canModify && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={fetcher.state !== "idle"}
                      >
                        {isDeleting ? (
                          <>
                            <Spinner />
                            Verwijderen…
                          </>
                        ) : (
                          <>
                            <Trash2 aria-hidden />
                            Verwijder
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Bodemanalyse verwijderen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          De bodemanalyse van {dateLabel}
                          {analysis.a_source ? ` (${sourceLabel})` : ""} wordt verwijderd van dit
                          perceel.
                          {analysis.a_file_path
                            ? " Het bijbehorende PDF-bestand wordt ook verwijderd."
                            : ""}{" "}
                          Dit kan niet ongedaan worden gemaakt.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                        <AlertDialogAction
                          className={buttonVariants({ variant: "destructive" })}
                          onClick={() => handleDelete(analysis.a_id)}
                        >
                          Verwijderen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
            <Separator className="my-4" />
          </li>
        )
      })}
    </ul>
  )
}
