import type { SoilParameterDescription } from "@nmi-agro/fdm-core"
import { SoilAnalysis } from "@nmi-agro/fdm-core"
import { formatDate } from "date-fns/format"
import { nl } from "date-fns/locale"
import { ChevronDown, Download, Eye, FileText } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { PdfViewerDialogContent } from "~/components/blocks/soil/pdf-viewer-dialog"
import { Button } from "~/components/ui/button"
import { Dialog } from "~/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

/**
 * Removes diacritics and any character that isn't alphanumeric, replacing
 * runs of them with a single underscore, so the result is safe to use as a
 * filename across Windows/macOS/Android/iOS file systems.
 */
function sanitizeForFilename(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

/**
 * Builds a farmer-recognizable download filename, e.g.
 * "Perceel_Noord_2024-03-12_Eurofins.pdf", combining the field name, the
 * sampling date and the lab/source name — without special characters so it
 * stores cleanly on any device.
 */
export function getSoilAnalysisDownloadName(
  analysis: {
    a_source?: SoilAnalysis["a_source"]
    b_sampling_date: SoilAnalysis["b_sampling_date"]
  },
  fieldName: string,
  soilParameterDescription: SoilParameterDescription,
): string {
  const sourceParam = soilParameterDescription.find((x) => x.parameter === "a_source")
  const sourceOption = sourceParam?.options?.find((x) => x.value === analysis.a_source)
  const sourceLabel = sourceOption?.label || analysis.a_source || ""
  const dateLabel = analysis.b_sampling_date
    ? formatDate(analysis.b_sampling_date, "yyyy-MM-dd")
    : ""

  const parts = [fieldName, dateLabel, sourceLabel]
    .map(sanitizeForFilename)
    .filter((part) => part.length > 0)

  return `${parts.length > 0 ? parts.join("_") : "bodemanalyse"}.pdf`
}

/**
 * Human-readable title for a soil analysis, e.g. "Eurofins - 12 mrt. 2024",
 * used as the PDF viewer dialog title instead of the raw filename.
 */
export function getSoilAnalysisTitle(
  analysis: {
    a_source?: SoilAnalysis["a_source"]
    b_sampling_date: SoilAnalysis["b_sampling_date"]
  },
  soilParameterDescription: SoilParameterDescription,
): string {
  const sourceParam = soilParameterDescription.find((x) => x.parameter === "a_source")
  const sourceOption = sourceParam?.options?.find((x) => x.value === analysis.a_source)
  const sourceLabel = sourceOption?.label || analysis.a_source || "Onbekende bron"
  const dateLabel = analysis.b_sampling_date
    ? formatDate(analysis.b_sampling_date, "PP", { locale: nl })
    : "Datum onbekend"
  return `${sourceLabel} - ${dateLabel}`
}

export function SoilAnalysisDownloadDropdown({
  soilAnalyses,
  soilParameterDescription,
  fieldName,
}: {
  soilAnalyses: SoilAnalysis[]
  soilParameterDescription: SoilParameterDescription
  fieldName: string
}) {
  const soilAnalysesToDownload = soilAnalyses
    .filter((analysis) => analysis.a_file_path)
    .sort((a, b) =>
      !a.b_sampling_date && b.b_sampling_date
        ? 1
        : a.b_sampling_date && !b.b_sampling_date
          ? -1
          : a.b_sampling_date && b.b_sampling_date
            ? b.b_sampling_date.getTime() - a.b_sampling_date.getTime()
            : 0,
    )

  const [viewingAnalysis, setViewingAnalysis] = useState<SoilAnalysis | null>(null)

  if (soilAnalysesToDownload.length === 0) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            Analyses downloaden <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {soilAnalysesToDownload.map((analysis) => {
            const sourceParam = soilParameterDescription.find((x) => x.parameter === "a_source")
            const sourceOption = sourceParam?.options?.find((x) => x.value === analysis.a_source)
            const sourceLabel = sourceOption?.label || analysis.a_source || "Onbekend"
            return (
              <DropdownMenuItem
                key={analysis.a_id}
                className="flex items-center justify-between gap-2"
                onSelect={(e) => e.preventDefault()}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {sourceLabel} -{" "}
                    <span className="text-muted-foreground">
                      {analysis.b_sampling_date
                        ? formatDate(analysis.b_sampling_date, "PP", { locale: nl })
                        : "Datum onbekend"}
                    </span>
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setViewingAnalysis(analysis)}
                    title="Bekijk PDF"
                    aria-label="Bekijk PDF"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                    <a
                      href={`/api/soil-analysis/download/${analysis.a_id}.pdf`}
                      download={getSoilAnalysisDownloadName(
                        analysis,
                        fieldName,
                        soilParameterDescription,
                      )}
                      title="PDF downloaden"
                      aria-label="PDF downloaden"
                      onClick={() => toast("PDF wordt gedownload")}
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </Button>
                </div>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={viewingAnalysis !== null}
        onOpenChange={(open) => {
          if (!open) setViewingAnalysis(null)
        }}
      >
        {viewingAnalysis && (
          <PdfViewerDialogContent
            a_id={viewingAnalysis.a_id}
            filename={getSoilAnalysisDownloadName(
              viewingAnalysis,
              fieldName,
              soilParameterDescription,
            )}
            title={getSoilAnalysisTitle(viewingAnalysis, soilParameterDescription)}
          />
        )}
      </Dialog>
    </>
  )
}
