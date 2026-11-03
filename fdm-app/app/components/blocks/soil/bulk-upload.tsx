import type { SoilParameterDescription } from "@nmi-agro/fdm-core"
import { useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { BulkSoilAnalysisUploadForm } from "./bulk-upload-form"
import {
  type BulkField,
  type BulkRow,
  createReadFailedRow,
  createRowsFromAnalyses,
  type ExistingSoilAnalysis,
} from "./bulk-upload-model"
import { type BulkReadResult, readSoilAnalysisPdfs } from "./bulk-upload-read"
import { BulkSoilAnalysisReview } from "./bulk-upload-review"

/**
 * Adds the soil analyses of many PDF reports at once: choose and read the PDFs, check the analyses
 * and the fields they are linked to, and save them in batches. Nothing is stored before the user
 * saves.
 *
 * @param fields - The fields of the farm, with geometry for linking analyses by location.
 * @param existing - The analyses already stored for the farm, to recognise uploads of the same
 * report.
 * @param soilParameterDescription - Descriptions of all soil parameters.
 * @param disabled - Whether reading PDFs is unavailable.
 * @param destination - Where to go after everything has been saved.
 */
export function BulkSoilAnalysisUpload({
  fields,
  existing,
  soilParameterDescription,
  disabled,
  destination,
}: {
  fields: BulkField[]
  existing: ExistingSoilAnalysis[]
  soilParameterDescription: SoilParameterDescription
  disabled?: boolean
  destination: string
}) {
  const navigate = useNavigate()
  const [files, setFiles] = useState<File[]>([])
  const [rows, setRows] = useState<BulkRow[] | null>(null)

  const toRows = (result: BulkReadResult): BulkRow[] =>
    result.error || !result.analyses
      ? [
          createReadFailedRow(
            result.fileName,
            result.error ?? "Dit rapport kon niet worden uitgelezen.",
          ),
        ]
      : result.analyses.length === 0
        ? [createReadFailedRow(result.fileName, "Er staan geen analyses in dit rapport.")]
        : createRowsFromAnalyses(result.fileName, result.analyses, fields)

  const handleReadComplete = (results: BulkReadResult[]) => {
    setRows(results.flatMap(toRows))
  }

  const handleRetryRead = async (fileName: string) => {
    const file = files.find((candidate) => candidate.name === fileName)
    if (!file) return
    const results: BulkReadResult[] = []
    try {
      await readSoilAnalysisPdfs([file], (result) => results.push(result))
    } catch (error) {
      results.push({
        fileName,
        error: error instanceof Error ? error.message : "Het uitlezen is mislukt.",
      })
    }
    if (results.length === 0) {
      results.push({ fileName, error: "Er kwam geen antwoord voor dit rapport." })
    }
    const replacement = results.flatMap(toRows)
    setRows((current) =>
      current
        ? [...current.filter((row) => row.fileName !== fileName || row.saved), ...replacement]
        : current,
    )
  }

  if (!rows) {
    return (
      <BulkSoilAnalysisUploadForm
        files={files}
        onFilesChange={setFiles}
        onReadComplete={handleReadComplete}
        disabled={disabled}
      />
    )
  }

  return (
    <BulkSoilAnalysisReview
      rows={rows}
      onRowsChange={(update) => setRows((current) => (current ? update(current) : current))}
      files={new Map(files.map((file) => [file.name, file]))}
      fields={fields}
      existing={existing}
      soilParameterDescription={soilParameterDescription}
      onRetryRead={handleRetryRead}
      onBack={() => setRows(null)}
      onFinished={(savedCount) => {
        toast.success(
          savedCount === 1 ? "1 bodemanalyse opgeslagen" : `${savedCount} bodemanalyses opgeslagen`,
        )
        void navigate(destination)
      }}
    />
  )
}
