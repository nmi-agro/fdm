import type { ReactNode, Ref, SubmitEventHandler } from "react"
import imageCompression from "browser-image-compression"
import { LucideImage } from "lucide-react"
import { useEffect, useRef, useState, useTransition } from "react"
import { useFetcher } from "react-router"
import { compressAvatar } from "@/app/lib/image-upload.client"
import { cn } from "@/app/lib/utils"
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

const DEFAULT_PROFILE_PICTURE_FILE_INPUT_NAME = "file"

export const MAX_SIZE_BYTES = 5 * 1024 * 1024

export const MAX_DIMENSIONS = 500

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

type ProfilePictureManagerProps = { avatarFallback: ReactNode; currentTitle?: string } & (
  | { currentPicture: string; currentAlt: string }
  | { currentPicture?: null | undefined; currentAlt?: any }
)

export function ProfilePictureInput({
  ref: propRef,
  name,
  files,
  onFilesChange,
  currentTitle,
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
  name?: string
  title?: string
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
  const [cropFramePosition, setCropFramePosition] = useState({ x: 0, y: 0, scale: 1 })
  const [cropFrameRectangle, setCropFrameRectangle] = useState({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  })

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
      <input type="hidden" name="cropRectX" value={cropFrameRectangle.x} />
      <input type="hidden" name="cropRectY" value={cropFrameRectangle.y} />
      <input type="hidden" name="cropRectWidth" value={cropFrameRectangle.width} />
      <input type="hidden" name="cropRectHeight" value={cropFrameRectangle.height} />
      <div className={cn("relative", imageData && "hidden")}>
        <Dropzone
          ref={propRef}
          name={name ?? DEFAULT_PROFILE_PICTURE_FILE_INPUT_NAME}
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
              {currentTitle ? (
                <span className="text-muted-foreground text-sm">{currentTitle}</span>
              ) : undefined}
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
          framePosition={cropFramePosition}
          onFramePositionChange={setCropFramePosition}
          onFrameRectangleChange={setCropFrameRectangle}
        />
      )}
    </>
  )
}

export function ProfilePictureManager({
  currentTitle = "Huidige profielfoto",
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

  const [isProcessingForm, processForm] = useTransition()

  const isUploading = isProcessingForm || uploadFetcher.state !== "idle"
  const isDeleting = deleteFetcher.state !== "idle"

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault()
    processForm(async () => {
      uploadFetcher.submit(await cropProfilePicture(new FormData(e.currentTarget)), {
        method: "post",
        encType: "multipart/form-data",
      })
    })
  }

  return (
    <uploadFetcher.Form
      method="post"
      encType="multipart/form-data"
      className="space-y-4"
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="intent" value="update_profile_picture" />
      <ProfilePictureInput
        ref={fileInputRef}
        avatarFallback={avatarFallback}
        currentTitle={currentTitle}
        currentPicture={currentPicture as string}
        currentAlt={currentAlt as string}
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

/**
 * Crops the file field found in the form data, and leaves the rest of the fields alone,
 * including those that define the cropping rectangle. It returns a new FormData object.
 *
 * Cropping rectangle is expected to be defined in the cropRectX, cropRectY, cropRectWidth,
 * and cropRectHeight form fields.
 *
 * @param formData Form data object to get the values from.
 * @param fileFieldName Name of the field that contains the image file that should be cropped.
 * @returns
 */
export async function cropProfilePicture(
  formData: FormData,
  fileFieldName = DEFAULT_PROFILE_PICTURE_FILE_INPUT_NAME,
) {
  const result = new FormData()

  const cropRectX = formData.get("cropRectX")
  const cropRectY = formData.get("cropRectY")
  const cropRectWidth = formData.get("cropRectWidth")
  const cropRectHeight = formData.get("cropRectHeight")
  const file = formData.get(fileFieldName)

  const parsed = {
    x: typeof cropRectX === "string" ? Number.parseFloat(cropRectX) : Number.NaN,
    y: typeof cropRectY === "string" ? Number.parseFloat(cropRectY) : Number.NaN,
    width: typeof cropRectWidth === "string" ? Number.parseFloat(cropRectWidth) : Number.NaN,
    height: typeof cropRectHeight === "string" ? Number.parseFloat(cropRectHeight) : Number.NaN,
  }

  if (
    window?.document &&
    file instanceof File &&
    file.size > 0 &&
    Number.isFinite(parsed.x) &&
    Number.isFinite(parsed.y) &&
    Number.isFinite(parsed.width) &&
    Number.isFinite(parsed.height)
  ) {
    const croppedFile = await new Promise<File>((resolve, reject) => {
      imageCompression
        .getDataUrlFromFile(file)
        .then((url) => {
          const image = new Image()
          image.addEventListener("error", (e) =>
            reject(e.error ?? new Error("Afbeelding kon niet worden geladen")),
          )
          image.src = url
          image.addEventListener("load", () => {
            const canvas = document.createElement("canvas")
            canvas.width = parsed.width
            canvas.height = parsed.height
            const ctx = canvas.getContext("2d")
            ctx?.drawImage(image, -parsed.x, -parsed.y)
            imageCompression.canvasToFile(canvas, "image/webp", "avatar", Date.now()).then(resolve)
          })
        })
        .catch(reject)
    })

    const compressedFile = await compressAvatar(croppedFile)

    result.append(fileFieldName, compressedFile)
  } else if (file !== null) {
    result.append(fileFieldName, file)
  }

  for (const [key, value] of formData.entries()) {
    if (key !== fileFieldName) {
      result.append(key, value)
    }
  }

  return result
}
