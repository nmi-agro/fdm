import { Download } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ImageCropperApp } from "~/components/custom/image-cropper"
import { Button } from "~/components/ui/button"
import { DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { Spinner } from "~/components/ui/spinner"
import { ALLOWED_IMAGE_MIME_TYPES } from "~/lib/upload-utils"
import { cn } from "~/lib/utils"
import { AttachmentGridItem } from "./attachment-grid"

/**
 * Dialog content that shows the given URL in different ways based on the
 * MIME type returned from the server. If the fetching of the URL fails or
 * the returned file cannot be displayed, the user just sees a download
 * button.
 *
 * It must be used within a shadcn `Dialog` component, possibly paired with
 * a `DialogTrigger`, which can make use of `ViewPdfButton`.
 */
export function AttachmentViewerDialogContent({
  attachment,
}: {
  attachment: Pick<AttachmentGridItem, "url" | "name" | "type">
}) {
  type Status =
    | { status: "loading" }
    | { status: "not_found" }
    | { status: "error" }
    | {
        status: "ok"
        fileName: string
        mimeType: string
        url: string
        imageWidth: number
        imageHeight: number
      }
  const [status, setStatus] = useState<Status>({ status: "loading" })

  // Fetch the file, determine its MIME type, and create an objectUrl
  useEffect(() => {
    const abortController = new AbortController()
    let objectUrl: string | null = null
    async function fetchFile() {
      if (abortController.signal.aborted) {
        return
      }

      // Let the browser do its thing for blob URLs since enabling them to JS is dangerous
      if (attachment.url.startsWith("blob:")) {
        let imageWidth = 0
        let imageHeight = 0

        // For images, read the image width and height properly
        if (ALLOWED_IMAGE_MIME_TYPES.includes(attachment.type)) {
          await new Promise<void>((resolve) => {
            const image = new Image()
            image.onload = () => {
              imageWidth = image.width
              imageHeight = image.height
              resolve()
            }
            image.onerror = () => {
              resolve()
            }
            image.src = attachment.url
          })
        }

        if (!abortController.signal.aborted) {
          setStatus({
            status: "ok",
            fileName: attachment.name,
            mimeType: attachment.type,
            url: attachment.url,
            imageWidth: imageWidth,
            imageHeight: imageHeight,
          })
        }

        return
      }

      setStatus({ status: "loading" })
      try {
        const response = await fetch(attachment.url)
        if (response.ok) {
          const blob = await response.blob()
          const file = new File([blob], attachment.name, { type: attachment.type })
          const url = URL.createObjectURL(file)
          objectUrl = url
          let imageWidth = 0
          let imageHeight = 0

          // For images, read the image width and height properly
          if (ALLOWED_IMAGE_MIME_TYPES.includes(attachment.type)) {
            await new Promise<void>((resolve) => {
              const image = new Image()
              image.onload = () => {
                imageWidth = image.width
                imageHeight = image.height
                resolve()
              }
              image.onerror = () => {
                resolve()
              }
              image.src = url
            })
          }

          if (!abortController.signal.aborted) {
            setStatus({
              status: "ok",
              fileName: attachment.name,
              mimeType: attachment.type,
              url: url,
              imageWidth: imageWidth,
              imageHeight: imageHeight,
            })
          }
        } else if (response.status === 404) {
          if (!abortController.signal.aborted) {
            setStatus({ status: "not_found" })
          }
        } else {
          if (!abortController.signal.aborted) {
            console.error(response)
            setStatus({ status: "error" })
          }
        }
      } catch (err) {
        if (abortController.signal.aborted) {
          console.error(err)
          setStatus({ status: "error" })
        }
      }
    }

    fetchFile()

    return () => {
      abortController.abort()
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [attachment])

  const objectUrl = status.status === "ok" ? status.url : null

  return (
    <DialogContent className="flex h-[85vh] max-h-160 w-full max-w-4xl flex-col sm:max-h-[85vh]">
      <DialogHeader className="flex-row items-center justify-between space-y-0 pr-8">
        <DialogTitle className="truncate">{attachment.name}</DialogTitle>
        <Button variant="ghost" size="sm" asChild onClick={() => toast("PDF wordt gedownload")}>
          <a
            href={objectUrl ?? attachment.url}
            download={attachment.name}
            rel="noopener noreferrer"
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Downloaden
          </a>
        </Button>
      </DialogHeader>
      <div className="relative h-full min-h-0 w-full flex-1">
        {status.status === "loading" ? (
          <div className="bg-background absolute inset-0 flex items-center justify-center gap-2 rounded-md border">
            <Spinner />
            <span className="text-muted-foreground text-sm">Bestand wordt geladen…</span>
          </div>
        ) : status.status === "ok" ? (
          status.mimeType === "application/pdf" ? (
            <iframe
              src={status.url}
              title={attachment.name}
              className={cn("h-full w-full rounded-md border transition-opacity")}
              onError={(err) => {
                console.error(err)
                setStatus({ status: "error" })
              }}
            />
          ) : ALLOWED_IMAGE_MIME_TYPES.includes(status.mimeType) ? (
            <ImageViewerApp
              src={status.url}
              imageWidth={status.imageWidth}
              imageHeight={status.imageHeight}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-md border text-center">
              <p className="text-muted-foreground text-sm">Er is geen voorbeeld beschikbaar.</p>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={objectUrl ?? attachment.url}
                  download={attachment.name}
                  rel="noopener noreferrer"
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  Downloaden in plaats daarvan
                </a>
              </Button>
            </div>
          )
        ) : status.status === "not_found" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-md border text-center">
            <p className="text-muted-foreground text-sm">
              Het PDF-bestand kunt niet gevonden zijn.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a
                href={objectUrl ?? attachment.url}
                download={attachment.name}
                rel="noopener noreferrer"
              >
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Downloaden in plaats daarvan
              </a>
            </Button>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-md border text-center">
            <p className="text-muted-foreground text-sm">
              Het PDF-bestand kon niet worden geladen.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a
                href={objectUrl ?? attachment.url}
                download={attachment.name}
                rel="noopener noreferrer"
              >
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Downloaden in plaats daarvan
              </a>
            </Button>
          </div>
        )}
      </div>
    </DialogContent>
  )
}

function ImageViewerApp(imageData: { src: string; imageWidth: number; imageHeight: number }) {
  const [cropFramePosition, setCropFramePosition] = useState({ x: 0, y: 0, scale: 1 })
  return (
    <ImageCropperApp
      frameShape="rectangle"
      frameRelativeSize={1.0}
      imageData={imageData}
      aspectRatio={
        imageData.imageWidth > 0 && imageData.imageHeight > 0
          ? imageData.imageWidth / imageData.imageHeight
          : 1
      }
      appAspectRatio={2}
      onClear={() => {}}
      framePosition={cropFramePosition}
      onFramePositionChange={setCropFramePosition}
    />
  )
}
