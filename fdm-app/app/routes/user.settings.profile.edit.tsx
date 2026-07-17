import { updateUserProfile } from "@nmi-agro/fdm-core"
import { type FileUpload, parseFormData } from "@remix-run/form-data-parser"
import imageSize from "image-size"
import { User } from "lucide-react"
import crypto from "node:crypto"
import { type MetaFunction, useLoaderData } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import z from "zod"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { detectExistingProfilePictureObjectKey } from "~/components/blocks/profile/detect-existing.server"
import { ProfileInfoForm } from "~/components/blocks/profile/profile-info-form"
import { ProfileInfoSchema } from "~/components/blocks/profile/profile-info-schema"
import {
  ProfilePictureManager,
  ALLOWED_MIME_TYPES,
  MIME_TO_EXT,
  MAX_SIZE_BYTES,
  MAX_DIMENSIONS,
} from "~/components/blocks/profile/profile-picture-manager"
import { ProfilePictureSchema } from "~/components/blocks/profile/profile-picture-schema"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { buildObjectKey, deleteObject, uploadObject } from "~/integrations/gcs.server"
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { readAndValidateFileUpload } from "~/lib/upload-utils.server"
import type { Route } from "./+types/user.settings.profile.edit"

// Meta
export const meta: MetaFunction = () => {
  return [
    { title: `Profiel - Account | ${clientConfig.name}` },
    {
      name: "description",
      content: "Bekijk en bewerk de gegevens van je account.",
    },
  ]
}

/**
 * Retrieves the user's profile data from the session.
 *
 * @param request - The HTTP request used to retrieve session data.
 * @returns An object containing the user's details and avatar initials.
 *
 * @throws {Error} If session retrieval fails.
 */
export async function loader({ request }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)
    return {
      user: session.user,
      initials: session.initials,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export default function UserProfileEditor() {
  const { user, initials } = useLoaderData<typeof loader>()

  return (
    <>
      <FarmTitle
        title="Accountgegevens wijzigen"
        description="Hieronder kunt je jouw accountgegevens wijzigen."
        action={{ to: "/user/settings/profile", label: "Terug" }}
      />

      <div className="flex flex-col gap-4 px-4 pb-8 md:flex-row md:px-8">
        <Card className="md:min-w-sm">
          <CardHeader>
            <CardTitle>Profielfoto wijzigen</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfilePictureManager
              avatarFallback={initials ?? <User />}
              currentPicture={user.image}
              currentAlt={`Profielfoto van ${user.displayUsername}`}
            />
          </CardContent>
        </Card>
        <Card className="md:grow">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Jouw gegevens wijzigen</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileInfoForm user={user} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

const ActionSchema = z.discriminatedUnion("intent", [
  ProfilePictureSchema.extend({ intent: z.literal("update_profile_picture") }),
  ProfileInfoSchema.extend({ intent: z.literal("update_profile_info") }),
  z.object({ intent: z.literal("delete_profile_picture") }),
])

const redirectUrl = "/user/settings/profile/edit"
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

      const imagePixelSize = imageSize(fileBuffer)
      if (imagePixelSize.width > MAX_DIMENSIONS || imagePixelSize.height > MAX_DIMENSIONS) {
        throw new Error("De foto is te groot of te breed.")
      }

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

    const actionSchemaResult = ActionSchema.safeParse(Object.fromEntries(formData.entries()))

    if (actionSchemaResult.error) {
      return Response.json({ errors: actionSchemaResult.error }, { status: 400 })
    }

    const oldProfilePictureObjectKey = detectExistingProfilePictureObjectKey(session.user.image)

    if (actionSchemaResult.data.intent === "update_profile_picture") {
      if (!fileBuffer || !detectedMime) {
        return Response.json({ error: "No valid image file provided" }, { status: 400 })
      }

      const detectedExt = MIME_TO_EXT[detectedMime]

      const hash = crypto.createHash("md5", { outputLength: 16 }).update(fileBuffer).digest("hex")

      const objectKey = buildObjectKey("profile_picture_user", session.principal_id, detectedExt)

      await auth.api.updateUser({
        headers: request.headers,
        body: {
          image: `/api/profile-picture/user/${session.principal_id}.${detectedExt}?hash=${hash}`,
        },
      })

      try {
        await uploadObject(objectKey, fileBuffer, detectedMime)

        if (oldProfilePictureObjectKey && oldProfilePictureObjectKey !== objectKey) {
          await deleteObject(oldProfilePictureObjectKey)
        }
      } catch (err) {
        try {
          await auth.api.updateUser({
            headers: request.headers,
            body: { image: session.user.image },
          })
        } catch (revertErr) {
          handleActionError(revertErr)
        }
        // Caught by the outer try catch block
        throw err
      }

      return redirectWithSuccess(redirectUrl, {
        message: "Profielfoto is succesvol geüpload.",
      })
    }

    if (actionSchemaResult.data.intent === "delete_profile_picture") {
      // Delete the object from the GCS. Will fail silently if not found.
      await auth.api.updateUser({
        headers: request.headers,
        body: { image: null },
      })

      if (oldProfilePictureObjectKey) {
        try {
          await deleteObject(oldProfilePictureObjectKey)
        } catch (err) {
          handleActionError(err)
          await auth.api.updateUser({
            headers: request.headers,
            body: { image: session.user.image },
          })
        }
      }
    }

    if (actionSchemaResult.data.intent === "update_profile_info") {
      await updateUserProfile(
        fdm,
        session.user.id,
        actionSchemaResult.data.firstname,
        actionSchemaResult.data.surname,
      )

      return redirectWithSuccess(redirectUrl, {
        message: "Profielinfo is succesvol gewijzigd.",
      })
    }
  } catch (err) {
    throw handleActionError(err)
  }
}
