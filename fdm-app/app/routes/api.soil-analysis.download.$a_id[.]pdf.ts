import { Readable } from "node:stream"
import { ApiError } from "@google-cloud/storage"
import { getField, getSoilAnalysis, getSoilParametersDescription } from "@nmi-agro/fdm-core"
import { data } from "react-router"
import { getSoilAnalysisDownloadName } from "~/components/blocks/soil/download"
import { getObjectStream } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { Route } from "./+types/api.soil-analysis.download.$a_id[.]pdf"

/**
 * Streams the soil analysis PDF through the app server instead of
 * redirecting to a signed GCS URL. Keeping the response same-origin means
 * `<a download>` works as a real download and the file can be embedded
 * inline (e.g. in an iframe viewer) without the browser navigating away to
 * storage.googleapis.com.
 *
 * Pass `?disposition=inline` to render the PDF in place (used by the
 * in-app viewer); the default is `attachment` (saves to disk).
 */
export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)
    const soilAnalysis = await getSoilAnalysis(fdm, session.principal_id, params.a_id)
    if (!soilAnalysis.a_file_path) {
      return data("Not Found", { status: 404 })
    }

    const disposition =
      new URL(request.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment"
    const field = await getField(fdm, session.principal_id, soilAnalysis.b_id)
    const filename = getSoilAnalysisDownloadName(
      soilAnalysis,
      field.b_name,
      getSoilParametersDescription(),
    )

    try {
      const { stream, contentType, size } = await getObjectStream(soilAnalysis.a_file_path)

      const headers = new Headers({
        "Content-Type": contentType ?? "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
      })
      if (size !== undefined) {
        headers.set("Content-Length", String(size))
      }

      return new Response(Readable.toWeb(stream) as ReadableStream, { headers })
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
