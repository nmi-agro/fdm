import { ApiError } from "@google-cloud/storage"
import { getAttachment } from "@nmi-agro/fdm-helpdesk"
import { data, redirect } from "react-router"
import { generateSignedReadUrl } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import type { Route } from "./+types/api.helpdesk.download.$attachment_id"

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)
    const attachment = await getAttachment(fdm, session.principal_id, params.attachment_id)

    try {
      const url = await generateSignedReadUrl(attachment.file_path)

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
