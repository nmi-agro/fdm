import { ApiError } from "@google-cloud/storage"
import { getPrincipal } from "@nmi-agro/fdm-core"
import { data } from "react-router"
import { buildObjectKey, generateSignedReadUrl } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { Route } from "./+types/api.profile-picture.$principal_id[.]webp"

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    // Only logged-in users should be able to access profile pictures
    await getSession(request)

    try {
      const principal = await getPrincipal(fdm, params.principal_id)
      if (!principal) {
        return data("Not found", { status: 404 })
      }

      const folderName =
        principal.type === "user" ? "profile_picture_user" : "profile_picture_organization"

      const url = await generateSignedReadUrl(buildObjectKey(folderName, principal.id, "webp"))

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
