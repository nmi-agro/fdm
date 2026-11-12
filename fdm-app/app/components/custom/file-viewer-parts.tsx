import { Download } from "lucide-react"
import { toast } from "sonner"
import { buttonVariants } from "~/components/ui/button"
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
      <a
        href={downloadUrl}
        download={filename}
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        data-slot="button"
        onClick={() => toast(downloadingMessage)}
      >
        <Download className="mr-2 h-4 w-4" aria-hidden="true" />
        Downloaden
      </a>
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
      <a
        href={downloadUrl}
        download={filename}
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "outline", size: "sm" })}
        data-slot="button"
      >
        <Download className="mr-2 h-4 w-4" aria-hidden="true" />
        {downloadLabel}
      </a>
    </div>
  )
}
