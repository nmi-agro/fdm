import { FileUpload } from "@remix-run/form-data-parser"
import { parseFormData } from "@remix-run/form-data-parser"
import { LucideImage } from "lucide-react"
import fs from "node:fs/promises"
import { useEffect, useState } from "react"
import { Form, useNavigate } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import sharp from "sharp"
import { ProfilePictureSchema } from "~/components/blocks/profile-picture/profile-picture-schema"
import { ImageCropperApp, ImageData } from "~/components/custom/image-cropper"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { buildObjectKey, uploadObject } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { handleActionError } from "~/lib/error"
import { readAndValidateFileUpload } from "~/lib/upload-utils.server"
import { Dropzone } from "../components/custom/dropzone"
import { Button } from "../components/ui/button"
import { Spinner } from "../components/ui/spinner"
import { cn } from "../lib/utils"
import { Route } from "./+types/user.settings.profile.picture"

const MAX_SIZE_BYTES = 5 * 1024 * 1024

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
])

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
}

export default function UserProfilePictureDialog() {
  const maxFileSize = MAX_SIZE_BYTES
  const navigate = useNavigate()

  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [files, setFiles] = useState<File[]>([])

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

  return (
    <Dialog open={true} onOpenChange={() => navigate("..")}>
      <DialogContent>
        <Form method="post" encType="multipart/form-data" className="space-y-4">
          <DialogHeader>
            <DialogTitle>Upload nieuwe profielfoto</DialogTitle>
            <DialogDescription>Hier kun je een nieuwe profielfoto uploaden.</DialogDescription>
          </DialogHeader>
          <div className={cn(imageData && "hidden")}>
            <Dropzone
              name="file"
              accept={Object.values(MIME_TO_EXT).map((ext) => `.${ext}`)}
              maxSize={maxFileSize}
              multiple={false}
              required={true}
              value={files}
              className="aspect-square"
              onFilesChange={setFiles}
            >
              {isLoading ? (
                <Spinner className="text-muted-foreground mb-2 h-8 w-8" />
              ) : (
                <LucideImage className="text-muted-foreground mb-2 h-8 w-8" />
              )}
              <div className="text-muted-foreground mt-1 text-xs">
                {maxFileSize
                  ? `Beeld tot ${
                      maxFileSize > 1024 * 1024
                        ? `${maxFileSize / 1024 / 1024}MB`
                        : maxFileSize > 1024
                          ? `${maxFileSize / 1024}KB`
                          : `${maxFileSize}B`
                    }`
                  : "Een beeld toevoegen"}
              </div>
            </Dropzone>
          </div>
          {imageData && (
            <>
              <ImageCropperApp
                aspectRatio={1}
                appAspectRatio={3 / 2}
                frameRelativeSize={0.6}
                imageData={imageData}
                onClear={() => setFiles([])}
              />
              <div className="flex flex-row justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setFiles([])}>
                  Kies een andere beeld
                </Button>
                <Button type="submit">Opslaan</Button>
              </div>
            </>
          )}
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export async function action({ request }: Route.ActionArgs) {
  try {
    const session = await getSession(request)
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    let fileBuffer: Buffer | null = null
    let detectedMime: string | null = null

    const uploadHandler = async (fileUpload: FileUpload) => {
      if (fileUpload.fieldName !== "file") return undefined
      const result = await readAndValidateFileUpload(fileUpload, ALLOWED_MIME_TYPES)
      fileBuffer = result.buffer
      detectedMime = result.mime

      return new File([new Uint8Array(fileBuffer)], fileUpload.name, {
        type: detectedMime,
      })
    }

    let formData: FormData
    try {
      formData = await parseFormData(request, { maxFileSize: MAX_SIZE_BYTES }, uploadHandler)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid upload"
      return Response.json({ error: message }, { status: 400 })
    }

    const cropRectResult = ProfilePictureSchema.safeParse(Object.fromEntries(formData.entries()))

    if (cropRectResult.error) {
      return Response.json({ errors: cropRectResult.error }, { status: 400 })
    }

    const cropRect = cropRectResult.data

    if (!fileBuffer || !detectedMime) {
      return Response.json({ error: "No valid image file provided" }, { status: 400 })
    }

    const cropped = await sharp(fileBuffer)
      .extract({
        left: cropRect.cropRectX,
        top: cropRect.cropRectY,
        width: cropRect.cropRectWidth,
        height: cropRect.cropRectHeight,
      })
      .resize(200, 200, { fit: "cover" })
      .webp()
      .toUint8Array()

    await fs.writeFile("profile-pic.webp", cropped.data)

    const objectKey = buildObjectKey("profile_pictures/users", session.principal_id, "webp")

    await uploadObject(objectKey, cropped.data, "image/webp")

    // TODO: Set the user's profile picture to a permanent GCS URL

    return redirectWithSuccess("/user/settings/profile", {
      message: "Profielfoto is succesvol geüpload.",
    })
  } catch (err) {
    throw handleActionError(err)
  }
}
