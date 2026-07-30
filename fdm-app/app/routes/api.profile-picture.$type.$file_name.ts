import { ApiError } from "@google-cloud/storage"
import { getPrincipal } from "@nmi-agro/fdm-core"
import { data, redirect } from "react-router"
import { MIME_TO_EXT } from "~/components/blocks/profile/profile-picture-manager"
import { buildObjectKey, generateSignedReadUrl } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import type { Route } from "./+types/api.profile-picture.$type.$file_name"

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    if (params.type !== "user" && params.type !== "organization") {
      return data("Invalid type", { status: 400 })
    }

    const separatorIndex = params.file_name.lastIndexOf(".")
    if (separatorIndex <= 0 || separatorIndex === params.file_name.length - 1) {
      return data("Invalid file name", { status: 400 })
    }

    const principalId = params.file_name.slice(0, separatorIndex)
    const extension = params.file_name.slice(separatorIndex + 1).toLowerCase()

    if (!Object.values(MIME_TO_EXT).includes(extension)) {
      return data("Invalid file name", { status: 400 })
    }

    // Only logged-in users should be able to access profile pictures
    await getSession(request)

    try {
      const principal = await getPrincipal(fdm, principalId)
      if (!principal || principal.type !== params.type) {
        return data("Not found", { status: 404 })
      }

      const folderName =
        params.type === "user" ? "profile_picture_user" : "profile_picture_organization"

      const url = await generateSignedReadUrl(buildObjectKey(folderName, principalId, extension))

      const headers = new Headers({
        "Cache-Control": "private, max-age=1800",
      })

      return redirect(url, { status: 302, headers })
    } catch (gcsError) {
      if (gcsError instanceof ApiError && gcsError.code === 404) {
        return data("Not Found", { status: 404 })
      }
      throw gcsError
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}
