import { FileUpload, parseFormData } from "@remix-run/form-data-parser"
import imageSize from "image-size"
import crypto from "node:crypto"
import { redirectWithSuccess } from "remix-toast"
import z from "zod"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { OrganizationSettingsForm } from "~/components/blocks/organization/form"
import { OrganizationInfoSchema } from "~/components/blocks/organization/schema"
import {
  ALLOWED_MIME_TYPES,
  MAX_DIMENSIONS,
  MAX_SIZE_BYTES,
  MIME_TO_EXT,
} from "~/components/blocks/profile/profile-picture-manager"
import {
  ProfilePictureFields,
  ProfilePictureSchema,
} from "~/components/blocks/profile/profile-picture-schema"
import { buildObjectKey, deleteObject, uploadObject } from "~/integrations/gcs.server"
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { readAndValidateFileUpload } from "~/lib/upload-utils.server"
import type { Route } from "./+types/organization.new"

export const meta: Route.MetaFunction = () => {
  return [
    { title: `Organisatie aanmaken | ${clientConfig.name}` },
    {
      name: "description",
      content: "Voeg een nieuwe organisatie toe.",
    },
  ]
}

export async function loader() {
  try {
    return {}
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export default function AddOrganizationPage() {
  return (
    <main>
      <FarmTitle
        title={"Organisatie aanmaken"}
        description={
          "Start een organisatie om met anderen samen te werken, gebruikers uit te nodigen en gegevens te delen."
        }
      />
      <div className="mx-auto max-w-3xl px-4">
        <OrganizationSettingsForm method="post" canModify={true} profilePictureField={true} />
      </div>
    </main>
  )
}

const ActionSchema = OrganizationInfoSchema.extend(
  Object.fromEntries(
    Object.entries(ProfilePictureFields).map(([k, v]) => [k, v.optional()]),
  ) as Partial<z.infer<typeof ProfilePictureSchema>>,
)

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

      // The file submission will be empty if the user hasn't added a profile picture
      if (fileUpload.name === "" && fileUpload.size === 0) return

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
    const formValues = actionSchemaResult.data

    let organizationImage: { buffer: Uint8Array; hash: string; detectedMime: string } | null = null

    if (fileBuffer && detectedMime) {
      const hash = crypto.createHash("md5", { outputLength: 16 }).update(fileBuffer).digest("hex")

      organizationImage = { buffer: fileBuffer, hash: hash, detectedMime: detectedMime }
    }

    const name = formValues.name
    const slug = formValues.slug
    const description = formValues.description || ""

    // Create the organization
    const organization = await auth.api.createOrganization({
      headers: request.headers,
      body: {
        name,
        slug,
        metadata: {
          description,
        },
      },
    })

    // Try to add the profile picture, fail entirely if this fails
    if (organizationImage) {
      const detectedExt = MIME_TO_EXT[organizationImage.detectedMime]

      const objectKey = buildObjectKey("profile_picture_organization", organization.id, detectedExt)

      let uploaded = true
      try {
        await uploadObject(objectKey, organizationImage.buffer, organizationImage.detectedMime)
        uploaded = true
        await auth.api.updateOrganization({
          headers: request.headers,
          body: {
            organizationId: organization.id,
            data: {
              logo: `/api/profile-picture/organization/${organization.id}.${detectedExt}?hash=${organizationImage.hash}`,
            },
          },
        })
      } catch (err) {
        if (uploaded) {
          try {
            await deleteObject(objectKey)
          } catch (revertError) {
            handleActionError(revertError)
          }
        }
        try {
          await auth.api.deleteOrganization({
            headers: request.headers,
            body: {
              organizationId: organization.id,
            },
          })
        } catch (revertError) {
          handleActionError(revertError)
        }
        throw err
      }
    }

    return redirectWithSuccess(`/organization/${formValues.slug}`, {
      message: `Organisatie ${formValues.name} is aangemaakt! 🎉`,
    })
  } catch (error) {
    return handleActionError(error)
  }
}
