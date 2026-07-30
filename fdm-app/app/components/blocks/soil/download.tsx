import type { SoilParameterDescription } from "@nmi-agro/fdm-core"
import { SoilAnalysis } from "@nmi-agro/fdm-core"
import { formatDate } from "date-fns/format"
import { nl } from "date-fns/locale"

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
