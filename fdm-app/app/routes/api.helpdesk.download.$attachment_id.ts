import { getAttachment } from "@nmi-agro/fdm-helpdesk"
import { data, redirect } from "react-router"
import { generateSignedReadUrl, isGcsNotFoundError } from "~/integrations/gcs.server"
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
        "Cache-Control": "private, no-store",
      })

      return redirect(url, { status: 302, headers })
    } catch (gcsError) {
      if (isGcsNotFoundError(gcsError)) {
        return data("Not Found", { status: 404 })
      }
      throw gcsError
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}
