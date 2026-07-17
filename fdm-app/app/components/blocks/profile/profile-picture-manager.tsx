import type { ReactNode, Ref } from "react"
import { LucideImage } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useFetcher } from "react-router"
import { Dropzone } from "~/components/custom/dropzone"
import { ImageCropperApp, type ImageData } from "~/components/custom/image-cropper"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Button, buttonVariants } from "~/components/ui/button"
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

type ProfilePictureManagerProps = { avatarFallback: ReactNode } & (
  | { currentPicture: string; currentAlt: string }
  | { currentPicture?: null | undefined; currentAlt?: any }
)

export function ProfilePictureInput({
  ref: propRef,
  files,
  onFilesChange,
  currentPicture,
  currentAlt,
  avatarFallback,
  maxFileSize,
  appAspectRatio,
  aspectRatio,
  frameRelativeSize,
  required,
}: ProfilePictureManagerProps & {
  ref?: Ref<HTMLInputElement>
  files: File[]
  onFilesChange: (files: File[]) => void
  maxFileSize: number
  appAspectRatio?: number
  aspectRatio?: number
  frameRelativeSize?: number
  required?: boolean
}) {
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Take the input file, first convert it into a data URL, then read its width and height using an Image object, making up two asynchronous passes.
  useEffect(() => {
    let active = true
    if (files.length > 0) {
      setIsLoading(true)
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

  return (
    <>
      <div className={cn("relative", imageData && "hidden")}>
        <Dropzone
          ref={(element) => {
            fileInputRef.current = element
            if (typeof propRef === "function") {
              propRef(element)
            } else if (propRef) {
              propRef.current = element
            }
          }}
          name="file"
          accept={Object.values(MIME_TO_EXT).map((ext) => `.${ext}`)}
          maxSize={maxFileSize}
          multiple={false}
          required={required}
          value={files}
          className="relative h-auto w-full"
          style={{ aspectRatio: appAspectRatio }}
          onFilesChange={(newFiles) => {
            onFilesChange(newFiles)
          }}
        >
          {isLoading ? (
            <Spinner className="text-muted-foreground absolute top-1/2 left-1/2 mb-2 h-8 w-8 -translate-1/2" />
          ) : currentPicture && currentAlt ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <span className="text-muted-foreground text-sm">Huidige profielfoto.</span>
              <Avatar className="aspect-square w-auto grow">
                <AvatarImage src={currentPicture} alt={currentAlt} />
                <AvatarFallback>{avatarFallback}</AvatarFallback>
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
          aspectRatio={aspectRatio}
          appAspectRatio={appAspectRatio}
          frameRelativeSize={frameRelativeSize}
          imageData={imageData}
          onClear={() => {
            onFilesChange([])
          }}
        />
      )}
    </>
  )
}

export function ProfilePictureManager({
  currentPicture,
  currentAlt,
  avatarFallback,
}: ProfilePictureManagerProps) {
  const uploadFetcher = useFetcher()
  const deleteFetcher = useFetcher()
  const maxFileSize = MAX_SIZE_BYTES
  const appAspectRatio = 3 / 2
  const aspectRatio = 1
  const frameRelativeSize = 0.6
  const [files, setFiles] = useState<File[]>([])

  const isUploading = uploadFetcher.state !== "idle"
  const isDeleting = deleteFetcher.state !== "idle"

  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <uploadFetcher.Form method="post" encType="multipart/form-data" className="space-y-4">
      <input type="hidden" name="intent" value="update_profile_picture" />
      <ProfilePictureInput
        ref={fileInputRef}
        avatarFallback={avatarFallback}
        currentPicture={currentPicture}
        currentAlt={currentAlt}
        files={files}
        onFilesChange={setFiles}
        aspectRatio={aspectRatio}
        appAspectRatio={appAspectRatio}
        frameRelativeSize={frameRelativeSize}
        maxFileSize={maxFileSize}
        required={true}
      />
      <div className="flex flex-row items-center justify-end gap-2">
        {files.length > 0 ? (
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
                <AlertDialogHeader>
                  <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deze actie kan niet ongedaan worden gemaakt.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction
                    className={buttonVariants({ variant: "destructive" })}
                    onClick={() => {
                      const formData = new FormData()
                      formData.append("intent", "delete_profile_picture")
                      deleteFetcher.submit(formData, { method: "post" })
                    }}
                  >
                    Verwijderen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
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
