import { LucideImage } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useFetcher } from "react-router"
import { Dropzone } from "~/components/custom/dropzone"
import { ImageCropperApp, type ImageData } from "~/components/custom/image-cropper"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

export const MAX_SIZE_BYTES = 5 * 1024 * 1024

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
])

export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
}

export default function ProfilePictureManager({
  currentPicture,
  currentAlt,
  initials,
}: { initials: string } & (
  | { currentPicture: string; currentAlt: string }
  | { currentPicture?: null | undefined; currentAlt?: unknown }
)) {
  const uploadFetcher = useFetcher()
  const deleteFetcher = useFetcher()
  const maxFileSize = MAX_SIZE_BYTES
  const appAspectRatio = 3 / 2

  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [files, setFiles] = useState<File[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Take the input file, first convert it into a data URL, then read its width and height using an Image object, making up two asynchronous passes.
  useEffect(() => {
    let active = true
    if (files.length > 0) {
      const fileReader = new FileReader()
      fileReader.addEventListener("load", () => {
        if (!active) return
        if (typeof fileReader.result !== "string") return
        const dataUrl = fileReader.result
        const img = new Image()
        img.src = dataUrl
        img.addEventListener("load", () => {
          if (!active) return
          setIsLoading(false)
          setImageData({ src: dataUrl, imageWidth: img.width, imageHeight: img.height })
        })
      })
      fileReader.readAsDataURL(files[0])
    } else {
      setImageData(null)
    }
    return () => {
      active = false
      setIsLoading(false)
    }
  }, [files])

  const isUploading = uploadFetcher.state !== "idle"
  const isDeleting = deleteFetcher.state !== "idle"

  return (
    <uploadFetcher.Form method="post" encType="multipart/form-data" className="space-y-4">
      <input type="hidden" name="intent" value="update_profile_picture" />
      <div className={cn("relative", imageData && "hidden")}>
        <Dropzone
          ref={fileInputRef}
          name="file"
          accept={Object.values(MIME_TO_EXT).map((ext) => `.${ext}`)}
          maxSize={maxFileSize}
          multiple={false}
          required={true}
          value={files}
          className="relative h-auto"
          style={{ aspectRatio: appAspectRatio }}
          onFilesChange={setFiles}
        >
          {isLoading ? (
            <Spinner className="text-muted-foreground absolute top-1/2 left-1/2 mb-2 h-8 w-8 -translate-1/2" />
          ) : currentPicture && currentAlt ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <span className="text-muted-foreground text-sm">Huidige profielfoto.</span>
              <Avatar className="aspect-square w-auto grow">
                <AvatarImage src={currentPicture} alt={currentAlt} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </div>
          ) : (
            <>
              <LucideImage className="text-muted-foreground mb-2 h-8 w-8" />
              <div className="text-muted-foreground mt-1 text-xs">
                {maxFileSize
                  ? `Kies een afbeelding tot ${
                      maxFileSize > 1024 * 1024
                        ? `${maxFileSize / 1024 / 1024}MB`
                        : maxFileSize > 1024
                          ? `${maxFileSize / 1024}KB`
                          : `${maxFileSize}B`
                    }`
                  : "Hier een beeld toevoegen"}
              </div>
            </>
          )}
        </Dropzone>
      </div>
      {imageData && (
        <ImageCropperApp
          aspectRatio={1}
          appAspectRatio={appAspectRatio}
          frameRelativeSize={0.6}
          imageData={imageData}
          onClear={() => setFiles([])}
        />
      )}
      <div className="flex flex-row items-center justify-end gap-2">
        {imageData ? (
          <>
            <Button variant="outline" type="button" onClick={() => setFiles([])}>
              {currentPicture ? "Annuleren" : "Kies een andere afbeelding"}
            </Button>
            <Button type="submit" disabled={isUploading}>
              Opslaan
              {isUploading ? <Spinner /> : undefined}
            </Button>
          </>
        ) : currentPicture ? (
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  Verwijderen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
                <AlertDialogDescription>
                  Deze actie kan niet ongedaan worden gemaakt.
                </AlertDialogDescription>
              </AlertDialogContent>
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <Button type="button" variant="outline">
                    Annuleren
                  </Button>
                </AlertDialogCancel>
                <AlertDialogCancel asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      const formData = new FormData()
                      formData.append("intent", "delete_profile_picture")
                      deleteFetcher.submit(formData, { method: "post" })
                    }}
                  >
                    Verwijderen
                  </Button>
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialog>
            <Button type="button" variant="outline" asChild>
              <label htmlFor={fileInputRef.current?.id ?? ""}>Kies één nieuwe</label>
            </Button>
          </>
        ) : (
          <Button type="submit" disabled>
            Opslaan
          </Button>
        )}
      </div>
    </uploadFetcher.Form>
  )
}
