import { FileUpload, parseFormData } from "@remix-run/form-data-parser"
import { Building } from "lucide-react"
import crypto from "node:crypto"
import { data, useLoaderData } from "react-router"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import z from "zod"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { OrganizationSettingsForm } from "~/components/blocks/organization/form"
import { OrganizationInfoSchema } from "~/components/blocks/organization/schema"
import { detectExistingProfilePictureObjectKey } from "~/components/blocks/profile/detect-existing.server"
import {
  ProfilePictureManager,
  ALLOWED_MIME_TYPES,
  MAX_SIZE_BYTES,
  MIME_TO_EXT,
} from "~/components/blocks/profile/profile-picture-manager"
import { ProfilePictureSchema } from "~/components/blocks/profile/profile-picture-schema"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { buildObjectKey, deleteObject, uploadObject } from "~/integrations/gcs.server"
import { auth, getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { parseOrganizationMetadata } from "~/lib/organization-helpers"
import { readAndValidateFileUpload } from "~/lib/upload-utils.server"
import type { Route } from "./+types/organization.$slug.settings"

// Meta
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Instellingen - Organisatie | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bekijk en bewerk de gegevens van jouw organisatie.",
    },
  ]
}

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)

    const organizations = await auth.api.listOrganizations({
      headers: request.headers,
    })

    const organizationRaw = organizations.find((org) => org.slug === params.slug)

    if (!organizationRaw) {
      throw data("Organisatie niet gevonden.", {
        status: 404,
        statusText: "Organisatie niet gevonden.",
      })
    }

    const members = (
      await auth.api.listMembers({
        headers: request.headers,
        query: {
          organizationId: organizationRaw.id,
        },
      })
    ).members

    // Determine permissions
    const currentUserMember = members.find((m) => m.userId === session.principal_id)
    const role = currentUserMember?.role ?? "viewer"
    const organizationEditPermission = role === "owner" || role === "admin"

    const organization = {
      ...organizationRaw,
      metadata: parseOrganizationMetadata(organizationRaw),
    }

    return {
      organization: organization,
      organizationEditPermission: organizationEditPermission,
    }
  } catch (e) {
    throw handleLoaderError(e)
  }
}

/**
 * Renders a form for updating organization properties.
 *
 * This component initializes a form using data loaded from the route loader and sets default values for fields such as organization name (required), slug, and description. It leverages validation with a Zod schema and automatically resets form data when the loader data changes. Upon submission, the form sends a POST request to update the organization settings.
 */
export default function OrganizationSettingsBlock() {
  const loaderData = useLoaderData<typeof loader>()
  return (
    <main>
      <FarmTitle
        title={"Organisatie-instellingen"}
        description={"Werk de gegevens bij van deze organisatie."}
        action={{ to: "./..", label: "Terug naar dashboard" }}
      />
      <div className="flex flex-col gap-4 px-4 pb-8 md:flex-row md:px-8">
        <Card className="md:min-w-sm">
          <CardHeader>
            <CardTitle>Profielfoto wijzigen</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfilePictureManager
              currentPicture={loaderData.organization.metadata.data?.image}
              currentAlt={`Profielfoto van ${loaderData.organization.name}`}
              avatarFallback={<Building />}
            />
          </CardContent>
        </Card>
        <OrganizationSettingsForm
          className="grow"
          organization={loaderData.organization}
          canModify={loaderData.organizationEditPermission}
          profilePictureField={false}
        />
      </div>
    </main>
  )
}

const ActionSchema = z.discriminatedUnion("intent", [
  ProfilePictureSchema.extend({ intent: z.literal("update_profile_picture") }),
  OrganizationInfoSchema.extend({ intent: z.literal("update_organization_info") }),
  z.object({ intent: z.literal("delete_profile_picture") }),
])

export async function action({ params, request }: Route.ActionArgs) {
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

    const actionSchemaResult = ActionSchema.safeParse(Object.fromEntries(formData.entries()))

    if (actionSchemaResult.error) {
      return Response.json({ errors: actionSchemaResult.error }, { status: 400 })
    }

    const currentOrganization = (
      await auth.api.listOrganizations({ headers: request.headers })
    ).find((org) => org.slug === params.slug)

    if (!currentOrganization) {
      throw data("Organisatie niet gevonden.", {
        status: 404,
        statusText: "Organisatie niet gevonden.",
      })
    }

    const oldProfilePictureObjectKey = detectExistingProfilePictureObjectKey(
      currentOrganization.logo,
    )

    if (actionSchemaResult.data.intent === "update_profile_picture") {
      if (!fileBuffer || !detectedMime) {
        return Response.json({ error: "No valid image file provided" }, { status: 400 })
      }

      const detectedExt = MIME_TO_EXT[detectedMime]

      const hash = crypto.createHash("md5", { outputLength: 16 }).update(fileBuffer).digest("hex")

      const objectKey = buildObjectKey(
        "profile_picture_organization",
        currentOrganization.id,
        detectedExt,
      )

      await auth.api.updateOrganization({
        headers: request.headers,
        body: {
          organizationId: currentOrganization.id,
          data: {
            logo: `/api/profile-picture/organization/${currentOrganization.id}.${detectedExt}?hash=${hash}`,
          },
        },
      })

      try {
        await uploadObject(objectKey, fileBuffer, detectedMime)

        if (oldProfilePictureObjectKey && oldProfilePictureObjectKey !== objectKey) {
          await deleteObject(oldProfilePictureObjectKey)
        }
      } catch (err) {
        try {
          await auth.api.updateOrganization({
            headers: request.headers,
            body: {
              organizationId: currentOrganization.id,
              data: {
                logo: currentOrganization.logo,
              },
            },
          })
        } catch (revertErr) {
          handleActionError(revertErr)
        }
        // Caught by the outer try catch block
        throw err
      }

      return redirectWithSuccess(`/organization/${params.slug}`, {
        message: "Profielfoto is succesvol geüpload.",
      })
    }

    if (actionSchemaResult.data.intent === "delete_profile_picture") {
      await auth.api.updateOrganization({
        headers: request.headers,
        body: {
          organizationId: currentOrganization.id,
          data: {
            logo: null,
          },
        },
      })

      if (oldProfilePictureObjectKey) {
        try {
          await deleteObject(oldProfilePictureObjectKey)
        } catch (err) {
          try {
            if (currentOrganization.metadata.data) {
              await auth.api.updateOrganization({
                headers: request.headers,
                body: {
                  organizationId: currentOrganization.id,
                  data: {
                    logo: currentOrganization.logo,
                  },
                },
              })
            }
          } catch (revertErr) {
            handleActionError(revertErr)
          }
          // Caught by the outer try catch block
          throw err
        }
      }

      return redirectWithSuccess(`/organization/${params.slug}`, {
        message: "Profielfoto is succesvol verwijderd.",
      })
    }

    if (actionSchemaResult.data.intent === "update_organization_info") {
      const formValues = actionSchemaResult.data

      const name = formValues.name
      const slug = formValues.slug
      const description = formValues.description || ""

      // Update the organization
      await auth.api.updateOrganization({
        headers: request.headers,
        body: {
          organizationId: currentOrganization.id,
          data: {
            name,
            slug,
            metadata: {
              description,
            },
          },
        },
      })

      return redirectWithSuccess(`/organization/${slug}`, {
        message: `Organisatie ${formValues.name} is succesvol bijgewerkt! 🎉`,
      })
    }
  } catch (error) {
    if (
      error &&
      (error as { body?: { code?: string } }).body?.code === "ORGANIZATION_SLUG_ALREADY_TAKEN"
    ) {
      return dataWithError(
        null,
        "Naam voor organisatie is niet meer beschikbaar. Kies een andere naam",
      )
    }

    throw handleActionError(error)
  }
}
