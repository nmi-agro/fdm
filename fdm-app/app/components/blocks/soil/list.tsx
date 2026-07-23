import type { SoilParameterDescription, SoilAnalysis } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import { NavLink, type useFetcher } from "react-router"
import { PdfViewerDialog } from "~/components/blocks/soil/pdf-viewer-dialog"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"
import { Separator } from "../../ui/separator"
import { getSoilAnalysisDownloadName, getSoilAnalysisTitle } from "./download"

export function SoilAnalysesList({
  soilAnalyses,
  soilParameterDescription,
  fetcher,
  canModifySoilAnalysis = {},
  fieldName,
}: {
  soilAnalyses: SoilAnalysis[]
  soilParameterDescription: SoilParameterDescription
  fetcher: ReturnType<typeof useFetcher>
  canModifySoilAnalysis?: Record<string, boolean>
  fieldName: string
}) {
  const handleDelete = (a_id: string) => {
    if (fetcher.state !== "idle") return

    void fetcher.submit({ a_id }, { method: "DELETE" })
  }
  const sourceParam = soilParameterDescription.find(
    (x: { parameter: string }) => x.parameter === "a_source",
  )

  return (
    <div className="space-y-2">
      {soilAnalyses.map((analysis, index) => {
        const sourceOption = sourceParam?.options?.find(
          (x: { value: string }) => x.value === analysis.a_source,
        )
        const sourceLabel = sourceOption?.label || analysis.a_source || "Onbekend"

        const isDeleting =
          fetcher.state !== "idle" && fetcher.formData?.get("a_id") === analysis.a_id
        const isEstimated = analysis.a_source === "nl-other-nmi"

        return (
          <div className={cn("space-y-3", index > 0 && "pt-2")} key={analysis.a_id}>
            <div>
              <p className="text-sm leading-none font-medium">
                {isEstimated
                  ? ""
                  : analysis.b_sampling_date
                    ? format(analysis.b_sampling_date, "PP", {
                        locale: nl,
                      })
                    : "Onbekende datum"}
              </p>
              <p className="text-muted-foreground text-sm">
                {isEstimated
                  ? "Als er geen bodemanalyse beschikbaar is, wordt er een schatting gemaakt met NMI BodemSchat"
                  : analysis.a_source === "" || !analysis.a_source
                    ? "Onbekende bron"
                    : `Gemeten door ${sourceLabel}`}
              </p>
            </div>

            {isEstimated ? null : (
              <div className="flex flex-wrap items-center gap-2">
                {analysis.a_file_path && (
                  <PdfViewerDialog
                    a_id={analysis.a_id}
                    filename={getSoilAnalysisDownloadName(
                      analysis,
                      fieldName,
                      soilParameterDescription,
                    )}
                    title={getSoilAnalysisTitle(analysis, soilParameterDescription)}
                    triggerVariant="outline"
                  />
                )}
                <Button
                  asChild
                  size="sm"
                  variant="default"
                  disabled={fetcher.state === "submitting"}
                >
                  <NavLink to={`./analysis/${analysis.a_id}`}>
                    {canModifySoilAnalysis[analysis.a_id] ? "Bewerk" : "Bekijk"}
                  </NavLink>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={fetcher.state !== "idle"}
                  onClick={() => {
                    handleDelete(analysis.a_id)
                  }}
                  className={cn(!canModifySoilAnalysis[analysis.a_id] ? "hidden" : "")}
                >
                  {isDeleting ? (
                    <div className="flex items-center space-x-2">
                      <Spinner />
                      <span>Verwijderen...</span>
                    </div>
                  ) : (
                    "Verwijder"
                  )}
                </Button>
              </div>
            )}
            <Separator key={`separator-${analysis.a_id}`} className="my-4" />
          </div>
        )
      })}
    </div>
  )
}
