import { FertilizerPlan, getFarm, getFertilizerPlan } from "@nmi-agro/fdm-core"
import { useLoaderData, useNavigate } from "react-router"
import {
  getBemestingsplanDownloadName,
  getBemestingsplanTitle,
} from "~/components/blocks/bemestingsplan/util"
import { PdfViewerDialogContent } from "~/components/custom/pdf-viewer"
import { Dialog } from "~/components/ui/dialog"
import { getSession } from "~/lib/auth.server"
import { fdm } from "~/lib/fdm.server"
import { Route } from "./+types/farm.$b_id_farm.bemestingsplan.$p_id_plan"

export async function loader({ params, request }: Route.LoaderArgs) {
  const session = await getSession(request)
  const farm = await getFarm(fdm, session.principal_id, params.b_id_farm)
  const plan = await getFertilizerPlan(fdm, session.principal_id, params.p_id_plan)
  return {
    filename: getBemestingsplanDownloadName(
      farm.b_id_farm,
      farm.b_name_farm,
      plan as FertilizerPlan,
    ),
    title: getBemestingsplanTitle(plan),
    downloadUrl: `/api/bemestingsplan/download/${params.p_id_plan}.pdf`,
  }
}

export default function BemestingsplanViewer() {
  const navigate = useNavigate()

  const { filename, title, downloadUrl } = useLoaderData<typeof loader>()

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) void navigate("./..")
      }}
    >
      <PdfViewerDialogContent title={title} downloadUrl={downloadUrl} filename={filename} />
    </Dialog>
  )
}
