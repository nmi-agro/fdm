import { checkPermission } from "@nmi-agro/fdm-core"
import { redirect } from "react-router"
import { buildObjectKey, generateSignedReadUrl } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { Route } from "./+types/api.soil-analysis.download.$a_id[.]pdf"

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)
    await checkPermission(
      fdm,
      "soil_analysis",
      "read",
      params.a_id,
      session.principal_id,
      "routes/api.soil-analysis.download.$a_id[.]pdf",
    )
    const objectKey = buildObjectKey("soil_analyses", params.a_id, "pdf")
    const url = await generateSignedReadUrl(objectKey)
    return redirect(url)
  } catch (error) {
    throw handleLoaderError(error)
  }
}
