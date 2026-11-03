import { AlertCircle, ChevronDown, FileText, FileUp, X } from "lucide-react"
import { useState } from "react"
import { Dropzone } from "~/components/custom/dropzone"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { Progress } from "~/components/ui/progress"
import { Spinner } from "~/components/ui/spinner"
import {
  type BulkReadResult,
  mergeUniqueFiles,
  ReadRequestError,
  readSoilAnalysisPdfs,
} from "./bulk-upload-read"
import { SoilAnalysisUploadSteps } from "./form-upload"

/** The steps of a bulk upload, shown on every step. */
export const BULK_UPLOAD_STEPS = [
  "PDF's kiezen",
  "Uitlezen",
  "Controleren en koppelen",
  "Opslaan",
] as const

/** Number of PDFs sent per request while reading. */
const READ_BATCH_SIZE = 20

/** Maximum size of one PDF. */
const MAX_FILE_SIZE = 5 * 1024 * 1024

/** Laboratories whose PDF reports can be read automatically. */
const SUPPORTED_LABS =
  "Eurofins Agro, HLB, ALNN, Altic, Dumea, Fertilab, Koch, Roba, SoilTech en Laboratorium Zeeuws-Vlaanderen"

/** Formats a file size in Dutch, for example `1,2 MB`. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let size = bytes / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  return `${size.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} ${units[unit]}`
}

/**
 * First steps of a bulk upload: choosing the PDF reports and reading them. Large selections are
 * summarised, with the full list on request; while reading, counters show how far it is.
 *
 * @param files - The chosen PDFs.
 * @param onFilesChange - Called when PDFs are added or removed.
 * @param onReadComplete - Called with the result for every PDF once all have been read.
 * @param disabled - Whether reading PDFs is unavailable.
 */
export function BulkSoilAnalysisUploadForm({
  files,
  onFilesChange,
  onReadComplete,
  disabled,
}: {
  files: File[]
  onFilesChange: (files: File[]) => void
  onReadComplete: (results: BulkReadResult[]) => void
  disabled?: boolean
}) {
  const [progress, setProgress] = useState<{ done: number; failed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isReading = progress !== null
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)

  const handleRead = async () => {
    if (files.length === 0) return
    setError(null)
    setProgress({ done: 0, failed: 0 })
    const results: BulkReadResult[] = []
    const reported = new Set<string>()
    let answeredBatches = 0
    let lastError: string | null = null
    /** Reports the PDFs without an answer as not read, so that they can be tried again. */
    const reportUnanswered = (batch: File[], message: string) => {
      for (const file of batch) {
        if (reported.has(file.name)) continue
        reported.add(file.name)
        results.push({ fileName: file.name, error: message })
      }
    }
    try {
      // Read in portions, one after the other, so that a large upload does not become one huge
      // request. A failed portion does not stop the others; only an expired session does.
      for (let start = 0; start < files.length; start += READ_BATCH_SIZE) {
        const batch = files.slice(start, start + READ_BATCH_SIZE)
        try {
          await readSoilAnalysisPdfs(batch, (result) => {
            reported.add(result.fileName)
            results.push(result)
            setProgress((current) => ({
              done: (current?.done ?? 0) + 1,
              failed: (current?.failed ?? 0) + (result.error ? 1 : 0),
            }))
          })
          answeredBatches++
        } catch (readError) {
          lastError = readError instanceof Error ? readError.message : "Het uitlezen is mislukt."
          if (readError instanceof ReadRequestError && readError.status === 401) {
            reportUnanswered(files.slice(start), lastError)
            break
          }
          reportUnanswered(batch, lastError)
        }
      }
      // PDFs without an answer are reported as not read, so none goes missing silently
      reportUnanswered(files, "Er kwam geen antwoord voor dit rapport.")
      if (answeredBatches > 0) {
        onReadComplete(results)
      } else {
        setError(lastError ?? "Het uitlezen is mislukt.")
      }
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="space-y-6">
      <SoilAnalysisUploadSteps current={isReading ? 1 : 0} steps={BULK_UPLOAD_STEPS} />

      <Dropzone
        name="soilAnalysisFiles"
        label="Kies PDF-rapporten of sleep ze hierheen"
        accept=".pdf"
        multiple
        value={files}
        onFilesChange={onFilesChange}
        mergeFiles={mergeUniqueFiles}
        allowReset={false}
        maxSize={MAX_FILE_SIZE}
        disabled={isReading || disabled}
        className="h-40"
      >
        <div className="flex flex-col items-center gap-1 px-4 text-center">
          <FileUp aria-hidden className="text-muted-foreground mb-1 size-7" />
          <p className="text-sm font-medium">
            {files.length > 0
              ? "Meer PDF's toevoegen"
              : "Kies de PDF-rapporten of sleep ze hierheen"}
          </p>
          <p className="text-muted-foreground text-xs">
            PDF, maximaal 5 MB per bestand. Een rapport mag meerdere percelen bevatten.
          </p>
        </div>
      </Dropzone>

      {files.length > 0 && (
        <Collapsible className="rounded-lg border">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <CollapsibleTrigger className="focus-visible:ring-ring/50 group flex items-center gap-2 rounded-sm text-sm font-medium focus-visible:ring-[3px] focus-visible:outline-none">
              <ChevronDown
                aria-hidden
                className="size-4 transition-transform group-data-[state=closed]:-rotate-90"
              />
              {files.length === 1 ? "1 PDF gekozen" : `${files.length} PDF's gekozen`}
              <span className="text-muted-foreground font-normal">
                ({formatFileSize(totalSize)})
              </span>
            </CollapsibleTrigger>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onFilesChange([])}
              disabled={isReading}
            >
              Alles verwijderen
            </Button>
          </div>
          <CollapsibleContent>
            <ul className="max-h-72 divide-y overflow-y-auto border-t">
              {files.map((file) => (
                <li key={file.name} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <FileText aria-hidden className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {formatFileSize(file.size)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => onFilesChange(files.filter((other) => other !== file))}
                    disabled={isReading}
                  >
                    <X aria-hidden />
                    <span className="sr-only">{file.name} verwijderen</span>
                  </Button>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      {progress && (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Spinner />
              PDF's worden uitgelezen
            </span>
            <span className="text-muted-foreground tabular-nums">
              {progress.done} van {files.length}
              {progress.failed > 0 && ` · ${progress.failed} niet gelukt`}
            </span>
          </div>
          <Progress value={(progress.done / Math.max(files.length, 1)) * 100} className="h-2" />
          <p className="text-muted-foreground text-sm">
            Je kunt de rapporten die niet lukken straks opnieuw proberen.
          </p>
        </div>
      )}
      <div aria-live="polite" className="sr-only">
        {progress ? `${progress.done} van ${files.length} uitgelezen` : ""}
      </div>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden />
          <AlertTitle>Uitlezen niet gelukt</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground space-y-1 text-sm">
          <p>Ondersteunde labs: {SUPPORTED_LABS}.</p>
          <p>Niets wordt opgeslagen voordat je de resultaten hebt gecontroleerd.</p>
        </div>
        <Button
          type="button"
          size="lg"
          onClick={() => void handleRead()}
          disabled={isReading || disabled || files.length === 0}
          className="shrink-0 max-sm:w-full pointer-coarse:h-11"
        >
          {isReading ? (
            <>
              <Spinner />
              Uitlezen…
            </>
          ) : files.length > 1 ? (
            `${files.length} PDF's uitlezen`
          ) : (
            "PDF uitlezen"
          )}
        </Button>
      </div>
    </div>
  )
}
