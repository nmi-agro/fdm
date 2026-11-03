import {
  getFarm,
  getFields,
  getSoilAnalysesForFarm,
  getSoilParametersDescription,
} from "@nmi-agro/fdm-core"
import { AlertCircle } from "lucide-react"
import { data, type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarmCreate } from "~/components/blocks/header/create-farm"
import { BulkSoilAnalysisUpload } from "~/components/blocks/soil/bulk-upload"
import { toDateKey } from "~/components/blocks/soil/bulk-upload-model"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { SidebarInset } from "~/components/ui/sidebar"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

export const handle = { hideNavigationProgress: true }

export const meta: MetaFunction = () => {
  return [
    { title: `Bodemanalyses uploaden | ${clientConfig.name}` },
    {
      name: "description",
      content: "Upload de PDF-rapporten van meerdere percelen in één keer.",
    },
  ]
}

/**
 * Loads what the bulk upload needs while creating a farm: the fields of the selected year, the
 * analyses already stored and whether PDFs can be read.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) throw data("Farm ID is required", { status: 400 })

    const b_id = params.b_id
    if (!b_id) throw data("Field ID is required", { status: 400 })

    const session = await getSession(request)
    const calendar = getCalendar(params)
    const timeframe = getTimeframe(params)
    const [farm, fields, analysesByField] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
      getFields(fdm, session.principal_id, b_id_farm, timeframe),
      getSoilAnalysesForFarm(fdm, session.principal_id, b_id_farm),
    ])

    return {
      b_id_farm,
      b_id,
      b_name_farm: farm.b_name_farm,
      calendar,
      fields: fields.map((field) => ({
        b_id: field.b_id,
        b_name: field.b_name,
        b_area: field.b_area,
        b_start: field.b_start,
        b_end: field.b_end,
        geometry: field.b_geometry,
      })),
      existing: [...analysesByField.entries()].flatMap(([field_id, analyses]) =>
        analyses.map((analysis) => ({
          b_id: field_id,
          date: toDateKey(analysis.b_sampling_date),
          a_depth_lower: analysis.a_depth_lower ?? null,
        })),
      ),
      soilParameterDescription: getSoilParametersDescription(),
      isNmiConfigured: Boolean(getNmiApiKey()),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Page to add the soil analyses of many PDF reports at once while creating a farm.
 */
export default function BulkSoilAnalysisUploadWizardPage() {
  const loaderData = useLoaderData<typeof loader>()
  const fieldsHref = `/farm/create/${loaderData.b_id_farm}/${loaderData.calendar}/fields`

  return (
    <SidebarInset>
      <Header
        action={{
          to: `${fieldsHref}/${loaderData.b_id}`,
          label: "Terug naar percelen",
          disabled: false,
        }}
      >
        <HeaderFarmCreate b_name_farm={loaderData.b_name_farm} />
      </Header>
      <main>
        <div className="space-y-6 p-4 pb-16 md:p-10">
          <div className="space-y-0.5">
            <h2 className="text-2xl font-bold tracking-tight">Bodemanalyses uploaden</h2>
            <p className="text-muted-foreground">
              Upload de PDF-rapporten van meerdere percelen in één keer. Je controleert de koppeling
              aan de percelen en de waarden voordat ze worden opgeslagen.
            </p>
          </div>
          {!loaderData.isNmiConfigured && (
            <Alert className="max-w-3xl border-amber-200 bg-amber-50 text-amber-800">
              <AlertCircle aria-hidden className="text-amber-800!" />
              <AlertTitle>Automatisch uitlezen van PDF's niet beschikbaar</AlertTitle>
              <AlertDescription>
                Het uitlezen van PDF-rapporten is in deze omgeving niet ingesteld. Je kunt analyses
                per perceel handmatig invoeren.
              </AlertDescription>
            </Alert>
          )}
          <BulkSoilAnalysisUpload
            fields={loaderData.fields}
            existing={loaderData.existing}
            soilParameterDescription={loaderData.soilParameterDescription}
            disabled={!loaderData.isNmiConfigured}
            destination={fieldsHref}
          />
        </div>
      </main>
    </SidebarInset>
  )
}
