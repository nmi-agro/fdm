import {
  checkPermission,
  getField,
  getSoilAnalysis,
  getSoilParametersDescription,
  updateSoilAnalysis,
} from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import { Pencil } from "lucide-react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  NavLink,
  useLoaderData,
  useSearchParams,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import type { FieldPageHandle } from "~/lib/field-page"
import { SoilAnalysisValues } from "~/components/blocks/soil/analysis-values"
import {
  getSoilAnalysisDownloadName,
  getSoilAnalysisTitle,
} from "~/components/blocks/soil/download"
import { SoilAnalysisForm } from "~/components/blocks/soil/form"
import { FormSchema } from "~/components/blocks/soil/formschema"
import { SAMPLING_PARAMETERS } from "~/components/blocks/soil/parameter-groups"
import { SoilSamplingMapCard } from "~/components/blocks/soil/soil-sampling-map-card"
import { PdfViewerDialogContent, ViewPdfButton } from "~/components/custom/pdf-viewer"
import { Button } from "~/components/ui/button"
import { getSession } from "~/lib/auth.server"
import { isBcsAnalysis } from "~/lib/bcs"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { Dialog, DialogTrigger } from "../components/ui/dialog"

/**
 * Loader function for the soil data page of a specific farm field.
 *
 * This function fetches the necessary data for rendering the soil data page, including
 * field details, soil analyses, current soil data, and soil parameter descriptions.
 * It validates the presence of the farm ID (`b_id_farm`) and field ID (`b_id`) in the
 * route parameters and retrieves the user session.
 *
 * @param request - The HTTP request object.
 * @param params - The route parameters, including `b_id_farm` and `b_id`.
 * @returns An object containing the field details, current soil data, soil parameter descriptions, and soil analyses.
 *
 * @throws {Response} If the farm ID is missing (HTTP 400).
 * @throws {Error} If the field ID is missing (HTTP 400).
 * @throws {Error} If the field is not found (HTTP 404).
 */
export async function loader({ request, params, url }: LoaderFunctionArgs) {
  try {
    // Get the farm id
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", {
        status: 400,
        statusText: "Farm ID is required",
      })
    }

    // Get the field id
    const b_id = params.b_id
    if (!b_id) {
      throw data("Field ID is required", {
        status: 400,
        statusText: "Field ID is required",
      })
    }

    // Get the analysis id
    const a_id = params.a_id
    if (!a_id) {
      throw data("Analysis ID is required", {
        status: 400,
        statusText: "Analysis ID is required",
      })
    }

    // Get the session
    const session = await getSession(request)

    // Get details of field
    const field = await getField(fdm, session.principal_id, b_id)
    if (!field) {
      throw data("Field is not found", {
        status: 404,
        statusText: "Field is not found",
      })
    }

    // Get the soil analyses
    const soilAnalysis = await getSoilAnalysis(fdm, session.principal_id, a_id)

    // BodemConditieScore assessments have their own pages and are not edited as a soil analysis
    if (!soilAnalysis || isBcsAnalysis(soilAnalysis)) {
      throw data("Soil analysis not found", {
        status: 404,
        statusText: "Soil analysis not found",
      })
    }

    // The parameters with a value (including 0), plus the sampling details so that missing ones
    // can be filled in; calculated parameters (d_) are never edited
    const values = soilAnalysis as unknown as Record<string, unknown>
    const soilParameterDescription = getSoilParametersDescription().filter(
      (item: { parameter: string }) =>
        !item.parameter.startsWith("d_") &&
        ((SAMPLING_PARAMETERS as readonly string[]).includes(item.parameter) ||
          (values[item.parameter] !== null && values[item.parameter] !== undefined)),
    )

    const soilAnalysisWritePermission = await checkPermission(
      fdm,
      "soil_analysis",
      "write",
      a_id,
      session.principal_id,
      url.pathname,
      false,
    )

    // Return user information from loader
    return {
      field: field,
      soilParameterDescription: soilParameterDescription,
      soilAnalysis: soilAnalysis,
      soilAnalysisWritePermission: soilAnalysisWritePermission,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Describes a soil analysis for under the field name: sampling date, laboratory and depth.
 */
function describeSoilAnalysis(loaderData: unknown): string | undefined {
  const data = loaderData as Awaited<ReturnType<typeof loader>> | undefined
  if (!data?.soilAnalysis) return undefined
  const { soilAnalysis, soilParameterDescription } = data
  const sourceLabel = soilParameterDescription
    .find((x) => x.parameter === "a_source")
    ?.options?.find((option: { value: string }) => option.value === soilAnalysis.a_source)?.label
  const samplingDate = soilAnalysis.b_sampling_date ? new Date(soilAnalysis.b_sampling_date) : null
  const depth =
    typeof soilAnalysis.a_depth_lower === "number"
      ? `${soilAnalysis.a_depth_upper ?? 0}–${soilAnalysis.a_depth_lower} cm`
      : null
  return [
    samplingDate
      ? `Bodemanalyse van ${format(samplingDate, "d MMMM yyyy", { locale: nl })}`
      : "Bodemanalyse",
    sourceLabel ? `Gemeten door ${sourceLabel}` : null,
    depth ? `diepte ${depth}` : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

/** The field layout shows the sampling date, laboratory and depth under the field name. */
export const handle: FieldPageHandle = { fieldDescription: describeSoilAnalysis }

/**
 * Page of one soil analysis. By default it shows the values read-only, grouped by topic, next to a
 * map of where the field was sampled. Users who may edit the analysis switch to the form with
 * "Bewerken" (`?modus=bewerken`).
 */
export default function FarmFieldSoilAnalysisBlock() {
  const loaderData = useLoaderData<typeof loader>()
  const { soilAnalysis, soilParameterDescription, soilAnalysisWritePermission } = loaderData
  const [searchParams] = useSearchParams()
  const isEditing = soilAnalysisWritePermission && searchParams.get("modus") === "bewerken"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2 empty:hidden">
        {soilAnalysis.a_file_path && (
          <Dialog>
            <DialogTrigger render={<ViewPdfButton variant="outline" size="sm" />} />
            <PdfViewerDialogContent
              downloadUrl={`/api/soil-analysis/download/${soilAnalysis.a_id}.pdf`}
              filename={getSoilAnalysisDownloadName(
                soilAnalysis,
                loaderData.field.b_name,
                soilParameterDescription,
              )}
              title={getSoilAnalysisTitle(soilAnalysis, soilParameterDescription)}
            />
          </Dialog>
        )}
        {soilAnalysisWritePermission && !isEditing && (
          <Button
            size="sm"
            nativeButton={false}
            render={
              <NavLink to={{ search: "?modus=bewerken" }}>
                <Pencil />
                Bewerken
              </NavLink>
            }
          />
        )}
      </div>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)] xl:items-start">
        <div className="min-w-0">
          {isEditing ? (
            <SoilAnalysisForm
              soilAnalysis={soilAnalysis}
              soilParameterDescription={soilParameterDescription}
              action="."
              secondaryAction={
                <Button
                  variant="ghost"
                  nativeButton={false}
                  render={<NavLink to={{ search: "" }}>Annuleren</NavLink>}
                />
              }
            />
          ) : (
            <SoilAnalysisValues
              soilAnalysis={soilAnalysis}
              soilParameterDescription={soilParameterDescription}
            />
          )}
        </div>
        <aside className="xl:sticky xl:top-4">
          <SoilSamplingMapCard
            fieldGeometry={loaderData.field.b_geometry}
            samplingZone={soilAnalysis.b_sampling_geometry_zone}
            samplingPoints={soilAnalysis.b_sampling_geometry}
            mapHeight="240px"
          />
        </aside>
      </div>
    </div>
  )
}

/**
 * Action function to update the soil analysis.
 *
 * This function updates a soil analysis based on the provided form data.
 * It validates the data, retrieves the necessary IDs from the route parameters,
 * and uses the `updateSoilAnalysis` function from `@nmi-agro/fdm-core` to perform the update.
 *
 * @param request - The HTTP request object.
 * @param params - The route parameters, including `a_id`, `b_id`, and `b_id_farm`.
 * @returns A redirect response after successful update.
 * @throws {Response} If any ID is missing (HTTP 400).
 * @throws {Response} If there is an error during the update (HTTP 500).
 */
export async function action({ request, params }: ActionFunctionArgs) {
  // Get the farm id
  const b_id_farm = params.b_id_farm
  if (!b_id_farm) {
    throw data("Farm ID is required", {
      status: 400,
      statusText: "Farm ID is required",
    })
  }

  // Get the field id
  const b_id = params.b_id
  if (!b_id) {
    throw data("Field ID is required", {
      status: 400,
      statusText: "Field ID is required",
    })
  }

  // Get the analysis id
  const a_id = params.a_id
  if (!a_id) {
    throw data("Analysis ID is required", {
      status: 400,
      statusText: "Analysis ID is required",
    })
  }

  try {
    // Get the session
    const session = await getSession(request)

    // Get from values
    const formValues = await extractFormValuesFromRequest(request, FormSchema)

    //update Soilanalysis
    await updateSoilAnalysis(fdm, session.principal_id, a_id, formValues)

    // Back to the read view of this analysis, so the user sees what was stored
    return redirectWithSuccess(`../soil/analysis/${a_id}`, {
      message: "Bodemanalyse bijgewerkt",
    })
  } catch (error) {
    return handleActionError(error)
  }
}
