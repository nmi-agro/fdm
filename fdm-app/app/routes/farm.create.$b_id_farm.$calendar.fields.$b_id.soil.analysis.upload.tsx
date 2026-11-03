import { getField, getSoilParametersDescription } from "@nmi-agro/fdm-core"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  useLoaderData,
  useLocation,
  useParams,
} from "react-router"
import {
  PdfReadingUnavailableAlert,
  SoilAnalysisUploadFlow,
} from "~/components/blocks/soil/upload-flow"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { handleSoilAnalysisUploadAction } from "~/lib/soil-upload.server"

/**
 * Loader function for the soil analysis upload page.
 *
 * Fetches the field details and soil parameter descriptions.
 *
 * @param request - The HTTP request object.
 * @param params - The route parameters containing `b_id_farm` and `b_id`.
 * @returns An object containing the field details and soil parameter descriptions.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
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

    // Get soil parameter descriptions
    const soilParameterDescription = getSoilParametersDescription()

    // Return user information from loader
    return {
      field: field,
      soilParameterDescription: soilParameterDescription,
      isNmiConfigured: Boolean(getNmiApiKey()),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Renders the page to add a soil analysis from a PDF lab report: first the PDF is read, then the
 * user checks the values next to the PDF and saves them.
 *
 * @returns The JSX element for the soil analysis upload page.
 */
export default function FarmFieldSoilAnalysisUploadBlock() {
  const { isNmiConfigured, soilParameterDescription } = useLoaderData<typeof loader>()
  const { b_id_farm, calendar, b_id } = useParams()
  const location = useLocation()
  // Absolute, because the parent route is the fields list; the search keeps the creation flow
  const manualEntryHref = `/farm/create/${b_id_farm}/${calendar}/fields/${b_id}/soil/analysis/standard${location.search}`

  return (
    <div className="space-y-6">
      {!isNmiConfigured && <PdfReadingUnavailableAlert manualEntryHref={manualEntryHref} />}
      <SoilAnalysisUploadFlow
        soilParameterDescription={soilParameterDescription}
        disabled={!isNmiConfigured}
        manualEntryHref={manualEntryHref}
      />
    </div>
  )
}

/**
 * Action for the upload page: reads the PDF (`intent=extract`) or saves the checked values with
 * the PDF (`intent=save`). See `handleSoilAnalysisUploadAction`.
 *
 * @param request - The HTTP request object.
 * @param params - The route parameters containing `b_id_farm` and `b_id`.
 * @returns The values to check, or a redirect back to the field after saving.
 */
export async function action({ request, params, url }: ActionFunctionArgs) {
  const b_id_farm = params.b_id_farm
  if (!b_id_farm) {
    throw data("Farm ID is required", {
      status: 400,
      statusText: "Farm ID is required",
    })
  }

  const b_id = params.b_id
  if (!b_id) {
    throw data("Field ID is required", {
      status: 400,
      statusText: "Field ID is required",
    })
  }

  return handleSoilAnalysisUploadAction({
    request,
    b_id,
    // Search needed for the /farm/$b_id_farm/$calendar/field/new/fields route
    redirectTo: () => `../${url.search}`,
  })
}
