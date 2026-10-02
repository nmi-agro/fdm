import { Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "~/components/ui/button"
import { DialogHeader, DialogTitle } from "~/components/ui/dialog"

/**
 * Shared header for a file-preview dialog: a truncated title and a download
 * button/link. Used by both `PdfViewerDialogContent` and
 * `AttachmentViewerDialogContent` so the two viewers stay visually
 * consistent without needing to be merged into one component.
 */
export function FileViewerDialogHeader({
  title,
  downloadUrl,
  filename,
  downloadingMessage = "Bestand wordt gedownload",
}: {
  title: string
  downloadUrl: string
  filename: string
  downloadingMessage?: string
}) {
  return (
    <DialogHeader className="flex-row items-center justify-between space-y-0 pr-8">
      <DialogTitle className="truncate">{title}</DialogTitle>
      <Button variant="ghost" size="sm" asChild onClick={() => toast(downloadingMessage)}>
        <a href={downloadUrl} download={filename} rel="noopener noreferrer">
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Downloaden
        </a>
      </Button>
    </DialogHeader>
  )
}

/**
 * Shared fallback panel shown inside a file-preview dialog when the file
 * can't be previewed (loading error, not found, or unsupported type),
 * offering a download link instead.
 */
export function FileViewerFallbackPanel({
  message,
  downloadUrl,
  filename,
  downloadLabel = "Downloaden in plaats daarvan",
}: {
  message: string
  downloadUrl: string
  filename: string
  downloadLabel?: string
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-md border text-center">
      <p className="text-muted-foreground text-sm">{message}</p>
      <Button variant="outline" size="sm" asChild>
        <a href={downloadUrl} download={filename} rel="noopener noreferrer">
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          {downloadLabel}
        </a>
      </Button>
    </div>
  )
}
