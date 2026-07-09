import { Download, FileText } from "lucide-react"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"

/**
 * Dialog content that shows a soil analysis PDF inline (via an iframe
 * pointing at the app's own streaming download route), so users can view
 * the original document without ever leaving the application. A separate
 * download action next to the viewer saves the file to disk.
 *
 * Exported separately from `PdfViewerDialog` so callers that already
 * control their own `Dialog` open state (e.g. a dropdown menu) can render
 * just the content.
 */
export function PdfViewerDialogContent({
  a_id,
  filename,
  title,
}: {
  a_id: string
  filename: string
  title: string
}) {
  const viewUrl = `/api/soil-analysis/download/${a_id}.pdf?disposition=inline`
  const downloadUrl = `/api/soil-analysis/download/${a_id}.pdf`

  return (
    <DialogContent className="flex h-[85vh] max-w-4xl flex-col">
      <DialogHeader className="flex-row items-center justify-between space-y-0 pr-8">
        <DialogTitle className="truncate">{title}</DialogTitle>
        <Button variant="ghost" size="sm" asChild>
          <a href={downloadUrl} download={filename} rel="noopener noreferrer">
            <Download className="mr-2 h-4 w-4" />
            Download
          </a>
        </Button>
      </DialogHeader>
      <iframe src={viewUrl} title={title} className="h-full w-full flex-1 rounded-md border" />
    </DialogContent>
  )
}

/**
 * Trigger button + modal dialog that shows a soil analysis PDF inline,
 * so users can view the original document without ever leaving the
 * application.
 */
export function PdfViewerDialog({
  a_id,
  filename,
  title,
  triggerLabel = "Bekijk PDF",
  triggerVariant = "outline",
  triggerClassName,
}: {
  a_id: string
  filename: string
  title: string
  triggerLabel?: string
  triggerVariant?: React.ComponentProps<typeof Button>["variant"]
  triggerClassName?: string
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} type="button" className={triggerClassName}>
          <FileText className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <PdfViewerDialogContent a_id={a_id} filename={filename} title={title} />
    </Dialog>
  )
}
