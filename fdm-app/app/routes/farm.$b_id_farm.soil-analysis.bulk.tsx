import {
  checkPermission,
  getFarms,
  getFields,
  getSoilAnalysesForFarm,
  getSoilParametersDescription,
} from "@nmi-agro/fdm-core"
import { AlertCircle, ShieldAlert } from "lucide-react"
import { data, type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import type { HelpHandle } from "~/lib/manual/help-targets"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { BulkSoilAnalysisUpload } from "~/components/blocks/soil/bulk-upload"
import { toDateKey } from "~/components/blocks/soil/bulk-upload-model"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { SidebarInset } from "~/components/ui/sidebar"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

export const handle: HelpHandle = { hideNavigationProgress: true, help: "bodemanalyses-uploaden" }

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
 * Loads what the bulk upload needs: the fields of the farm (with geometry, area and period, to link
 * analyses), the analyses already stored (to recognise the same report), and whether the user may
 * add analyses and whether PDFs can be read.
 */
export async function loader({ request, params, url }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)
    const [farms, fields, analysesByField, canWrite] = await Promise.all([
      getFarms(fdm, session.principal_id),
      getFields(fdm, session.principal_id, b_id_farm),
      getSoilAnalysesForFarm(fdm, session.principal_id, b_id_farm),
      checkPermission(fdm, "farm", "write", b_id_farm, session.principal_id, url.pathname, false),
    ])

    return {
      b_id_farm,
      farmOptions: farms.map((farm) => ({
        b_id_farm: farm.b_id_farm,
        b_name_farm: farm.b_name_farm,
      })),
      fields: fields.map((field) => ({
        b_id: field.b_id,
        b_name: field.b_name,
        b_area: field.b_area,
        b_start: field.b_start,
        b_end: field.b_end,
        geometry: field.b_geometry,
      })),
      existing: [...analysesByField.entries()].flatMap(([b_id, analyses]) =>
        analyses.map((analysis) => ({
          b_id,
          date: toDateKey(analysis.b_sampling_date),
          a_depth_lower: analysis.a_depth_lower ?? null,
        })),
      ),
      soilParameterDescription: getSoilParametersDescription(),
      canWrite,
      isNmiConfigured: Boolean(getNmiApiKey()),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Page to add the soil analyses of many PDF reports of a farm at once.
 */
export default function BulkSoilAnalysisUploadPage() {
  const loaderData = useLoaderData<typeof loader>()

  return (
    <SidebarInset>
      <Header
        action={{
          to: `/farm/${loaderData.b_id_farm}`,
          label: "Terug naar bedrijf",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={loaderData.b_id_farm} farmOptions={loaderData.farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbItem className="hidden md:block">Bodemanalyses uploaden</BreadcrumbItem>
      </Header>
      <main>
        <FarmTitle
          help="bodemanalyses-uploaden"
          title="Bodemanalyses uploaden"
          description="Upload de PDF-rapporten van meerdere percelen in één keer. Je controleert de koppeling aan de percelen en de waarden voordat ze worden opgeslagen."
        />
        <FarmContent>
          <div className="space-y-6">
            {!loaderData.canWrite ? (
              <Alert className="max-w-3xl">
                <ShieldAlert aria-hidden />
                <AlertTitle>Je kunt hier geen analyses toevoegen</AlertTitle>
                <AlertDescription>
                  Je hebt alleen leesrechten voor dit bedrijf. Vraag iemand die het bedrijf beheert
                  om je toegang aan te passen.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {!loaderData.isNmiConfigured && (
                  <Alert className="max-w-3xl border-amber-200 bg-amber-50 text-amber-800">
                    <AlertCircle aria-hidden className="text-amber-800!" />
                    <AlertTitle>Automatisch uitlezen van PDF's niet beschikbaar</AlertTitle>
                    <AlertDescription>
                      Het uitlezen van PDF-rapporten is in deze omgeving niet ingesteld. Je kunt
                      analyses per perceel invoeren via de bodempagina van het perceel.
                    </AlertDescription>
                  </Alert>
                )}
                <BulkSoilAnalysisUpload
                  fields={loaderData.fields}
                  existing={loaderData.existing}
                  soilParameterDescription={loaderData.soilParameterDescription}
                  disabled={!loaderData.isNmiConfigured}
                  destination={`/farm/${loaderData.b_id_farm}`}
                />
              </>
            )}
          </div>
        </FarmContent>
      </main>
    </SidebarInset>
  )
}
