import { ApiError } from "@google-cloud/storage"
import { getSoilAnalysis } from "@nmi-agro/fdm-core"
import { data, redirect } from "react-router"
import { buildObjectKey, generateSignedReadUrl } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { Route } from "./+types/api.soil-analysis.download.$a_id[.]pdf"

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)
    const soilAnalysis = await getSoilAnalysis(fdm, session.principal_id, params.a_id)
    if (!soilAnalysis.a_fileavailable) {
      return data("Not Found", { status: 404 })
    }
    const objectKey = buildObjectKey("soil_analyses", params.a_id, "pdf")
    try {
      const url = await generateSignedReadUrl(objectKey)
      return redirect(url)
    } catch (gcsError) {
      if (gcsError instanceof ApiError && gcsError.code === 404) {
        return data("Not Found", { status: 404 })
      }
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}
