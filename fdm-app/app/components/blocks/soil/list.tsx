import type { SoilParameterDescription, SoilAnalysis } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import { NavLink, type useFetcher } from "react-router"
import { PdfViewerDialog } from "~/components/blocks/soil/pdf-viewer-dialog"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"
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
    <div className="space-y-4">
      <div className="grid gap-6">
        {soilAnalyses.map((analysis) => {
          const sourceOption = sourceParam?.options?.find(
            (x: { value: string }) => x.value === analysis.a_source,
          )
          const sourceLabel = sourceOption?.label || analysis.a_source || "Onbekend"

          const isDeleting =
            fetcher.state !== "idle" && fetcher.formData?.get("a_id") === analysis.a_id

          return (
            <div className="flex items-center justify-between gap-x-3" key={analysis.a_id}>
              <div>
                <p className="text-sm leading-none font-medium">
                  {analysis.a_source === "nl-other-nmi"
                    ? "Geschat met NMI BodemSchat"
                    : analysis.b_sampling_date
                      ? format(analysis.b_sampling_date, "PP", {
                          locale: nl,
                        })
                      : "Onbekende datum"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {analysis.a_source === "nl-other-nmi"
                    ? null
                    : analysis.a_source === "" || !analysis.a_source
                      ? "Onbekende bron"
                      : `Gemeten door ${sourceLabel}`}
                </p>
              </div>

              <div>
                <div className="space-x-4">
                  {analysis.a_file_path ? (
                    <PdfViewerDialog
                      a_id={analysis.a_id}
                      filename={getSoilAnalysisDownloadName(
                        analysis,
                        fieldName,
                        soilParameterDescription,
                      )}
                      title={getSoilAnalysisTitle(analysis, soilParameterDescription)}
                    />
                  ) : (
                    <span className="inline-block h-9 w-[6.5rem]" aria-hidden="true" />
                  )}
                  <Button
                    asChild
                    variant="default"
                    disabled={
                      fetcher.state === "submitting" || analysis.a_source === "nl-other-nmi"
                    }
                    className={cn(
                      "pointer-events-auto",
                      analysis.a_source === "nl-other-nmi" ? "pointer-events-none" : "",
                    )}
                  >
                    <NavLink to={`./analysis/${analysis.a_id}`}>
                      {canModifySoilAnalysis[analysis.a_id] ? "Bewerk" : "Bekijk"}
                    </NavLink>
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={fetcher.state !== "idle" || analysis.a_source === "nl-other-nmi"}
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
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
