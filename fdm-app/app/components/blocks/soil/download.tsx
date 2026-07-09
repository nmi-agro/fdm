import type { SoilParameterDescription } from "@nmi-agro/fdm-core"
import { SoilAnalysis } from "@nmi-agro/fdm-core"
import { formatDate } from "date-fns/format"
import { nl } from "date-fns/locale"
import { ChevronDown, FileText } from "lucide-react"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

export function getSoilAnalysisDownloadName(analysis: {
  a_id: SoilAnalysis["a_id"]
  a_source?: SoilAnalysis["a_source"]
  b_sampling_date: SoilAnalysis["b_sampling_date"]
}): string {
  return `soil-analysis-${analysis.a_id}-${analysis.a_source ?? ""}-${analysis.b_sampling_date?.toISOString().split("T")[0] ?? ""}.pdf`
}

export function SoilAnalysisDownloadDropdown({
  soilAnalyses,
  soilParameterDescription,
}: {
  soilAnalyses: SoilAnalysis[]
  soilParameterDescription: SoilParameterDescription
}) {
  const soilAnalysesToDownload = soilAnalyses
    .filter((analysis) => analysis.a_file_path)
    .sort((a, b) =>
      !a.b_sampling_date && b.b_sampling_date
        ? 1
        : a.b_sampling_date && !b.b_sampling_date
          ? -1
          : a.b_sampling_date && b.b_sampling_date
            ? a.b_sampling_date.getTime() - b.b_sampling_date.getTime()
            : 0,
    )

  if (soilAnalysesToDownload.length === 0) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Download analyses... <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {soilAnalysesToDownload.map((analysis) => {
          const sourceParam = soilParameterDescription.find((x) => x.parameter === "a_source")
          const sourceOption = sourceParam?.options?.find((x) => x.value === analysis.a_source)
          const sourceLabel = sourceOption?.label || analysis.a_source || "Onbekend"
          return (
            <DropdownMenuItem key={analysis.a_id} asChild>
              <a
                href={`/api/soil-analysis/download/${analysis.a_id}.pdf`}
                download={getSoilAnalysisDownloadName(analysis)}
                // className="box-border flex size-full items-center justify-between px-4 py-2 text-sm"
              >
                <FileText className="mr-2 h-4 w-4" />
                {sourceLabel} -
                <span className="text-muted-foreground">
                  {analysis.b_sampling_date
                    ? formatDate(analysis.b_sampling_date, "PP", { locale: nl })
                    : "Datum onbekend"}
                </span>
              </a>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
