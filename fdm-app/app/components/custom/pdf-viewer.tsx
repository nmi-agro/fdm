import { Download, Eye } from "lucide-react"
import { ComponentProps, useEffect, useState } from "react"
import { toast } from "sonner"
import { modifySearchParams } from "@/app/lib/url-utils"
import { Button } from "~/components/ui/button"
import { DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

/**
 * Dialog content that shows a PDF inline via an iframe, so users can view
 * the original document without ever leaving the application. A separate
 * download action next to the viewer saves the file to disk.
 *
 * It must be used within a shadcn `Dialog` component, possibly paired with
 * a `DialogTrigger`, which can make use of `ViewPdfButton`.
 */
export function PdfViewerDialogContent({
  filename,
  title,
  downloadUrl,
}: {
  downloadUrl: string
  filename: string
  title: string
}) {
  const viewUrl = modifySearchParams(downloadUrl, (searchParams) => {
    searchParams.set("disposition", "inline")
  })
  const [status, setStatus] = useState<"checking" | "loading" | "loaded" | "error">("checking")

  // An <iframe> doesn't fire onError for a same-origin 404/500 response —
  // the browser still successfully "loads" the error page inside it. Check
  // the URL first (aborting once we know the status) so a missing/failed
  // PDF shows our styled error panel instead of a blank or browser-native
  // error page inside the frame. HEAD is avoided since the streaming loader
  // isn't guaranteed to special-case it; a GET is aborted once headers land.
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    setStatus("checking")
    fetch(viewUrl, { signal: controller.signal })
      .then((res) => {
        if (!cancelled) setStatus(res.ok ? "loading" : "error")
        controller.abort()
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [viewUrl])

  return (
    <DialogContent className="flex h-[85vh] max-h-160 w-full max-w-4xl flex-col sm:max-h-[85vh]">
      <DialogHeader className="flex-row items-center justify-between space-y-0 pr-8">
        <DialogTitle className="truncate">{title}</DialogTitle>
        <Button variant="ghost" size="sm" asChild onClick={() => toast("PDF wordt gedownload")}>
          <a href={downloadUrl} download={filename} rel="noopener noreferrer">
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Downloaden
          </a>
        </Button>
      </DialogHeader>
      <div className="relative h-full min-h-0 w-full flex-1">
        {(status === "loading" || status === "loaded") && (
          <iframe
            src={viewUrl}
            title={title}
            className={cn(
              "h-full w-full rounded-md border transition-opacity",
              status === "loaded" ? "opacity-100" : "opacity-0",
            )}
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
          />
        )}
        {(status === "checking" || status === "loading") && (
          <div className="bg-background absolute inset-0 flex items-center justify-center gap-2 rounded-md border">
            <Spinner />
            <span className="text-muted-foreground text-sm">PDF wordt geladen…</span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-md border text-center">
            <p className="text-muted-foreground text-sm">
              Het PDF-bestand kon niet worden geladen.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href={downloadUrl} download={filename} rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                PDF downloaden in plaats daarvan
              </a>
            </Button>
          </div>
        )}
      </div>
    </DialogContent>
  )
}

/** Styled button to be used to let the user view the PDF viewer dialog.  */
export function ViewPdfButton({ ...buttonProps }: Omit<ComponentProps<typeof Button>, "children">) {
  return (
    <Button variant="outline" type="button" {...buttonProps}>
      <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
      Bekijk PDF
    </Button>
  )
}
