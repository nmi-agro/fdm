import { ApiError } from "@google-cloud/storage"
import { getPrincipal } from "@nmi-agro/fdm-core"
import { data } from "react-router"
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

    const fileNameParts = params.file_name.split(".")
    if (fileNameParts.length !== 2) {
      return data("Invalid file name", { status: 400 })
    }

    if (!Object.values(MIME_TO_EXT).includes(fileNameParts[1])) {
      return data("Invalid file name", { status: 400 })
    }

    // Only logged-in users should be able to access profile pictures
    await getSession(request)

    try {
      const principal = await getPrincipal(fdm, fileNameParts[0])
      if (!principal || principal.type !== params.type) {
        return data("Not found", { status: 404 })
      }

      const folderName =
        params.type === "user" ? "profile_picture_user" : "profile_picture_organization"

      const url = await generateSignedReadUrl(
        buildObjectKey(folderName, fileNameParts[0], fileNameParts[1]),
      )

      const headers = new Headers({
        "Cache-Control": "public, max-age=1800",
      })

      return new Response(url, { status: 301, headers })
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
