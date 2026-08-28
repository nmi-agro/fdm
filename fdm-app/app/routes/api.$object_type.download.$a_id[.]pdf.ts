import { ApiError } from "@google-cloud/storage"
import {
  getFarm,
  getFertilizerPlan,
  getField,
  getSoilAnalysis,
  getSoilParametersDescription,
} from "@nmi-agro/fdm-core"
import { Readable } from "node:stream"
import { data } from "react-router"
import { getBemestingsplanDownloadName } from "~/components/blocks/bemestingsplan/util"
import { getSoilAnalysisDownloadName } from "~/components/blocks/soil/download"
import { getObjectStream } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { Route } from "./+types/api.$object_type.download.$a_id[.]pdf"

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

    let filePath: string | null | undefined
    let filename = "download.pdf"
    if (params.object_type === "soil-analysis") {
      const soilAnalysis = await getSoilAnalysis(fdm, session.principal_id, params.a_id)
      filePath = soilAnalysis.a_file_path
      let fieldName = "onbekend"
      try {
        const field = await getField(fdm, session.principal_id, soilAnalysis.b_id)
        fieldName = field.b_name
      } catch (err) {
        console.error(err)
      }
      filename = getSoilAnalysisDownloadName(
        soilAnalysis,
        fieldName,
        getSoilParametersDescription(),
      )
    } else if (params.object_type === "bemestingsplan") {
      const bemestingsplan = await getFertilizerPlan(fdm, session.principal_id, params.a_id)
      filePath = bemestingsplan.p_plan_file_path
      let farmName = "onbekend"
      if (bemestingsplan.b_id_farm) {
        try {
          const farm = await getFarm(fdm, session.principal_id, bemestingsplan.b_id_farm)
          if (farm.b_name_farm) {
            farmName = farm.b_name_farm
          }
        } catch (err) {
          console.error(err)
        }
      }
      filename = getBemestingsplanDownloadName(
        bemestingsplan.b_id_farm ?? "onbekend",
        farmName,
        bemestingsplan,
      )
    }

    if (!filePath) {
      return data("Not Found", { status: 404 })
    }

    const disposition =
      new URL(request.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment"

    try {
      const { stream, contentType, size } = await getObjectStream(filePath)

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
