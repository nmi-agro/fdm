import { getField, getSoilParametersDescription } from "@nmi-agro/fdm-core"
import { ArrowLeft } from "lucide-react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  NavLink,
  useLoaderData,
} from "react-router"
import type { FieldPageHandle } from "~/lib/field-page"
import {
  PdfReadingUnavailableAlert,
  SoilAnalysisUploadFlow,
} from "~/components/blocks/soil/upload-flow"
import { buttonVariants } from "~/components/ui/button"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { captureEvent } from "~/lib/analytics.server"
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
    const isNmiConfigured = Boolean(getNmiApiKey())

    // Return user information from loader
    return {
      field: field,
      soilParameterDescription: soilParameterDescription,
      isNmiConfigured,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/** The field layout names the page under the field name. */
export const handle: FieldPageHandle = {
  fieldDescription:
    "Bodemanalyse uploaden: je controleert de uitgelezen waarden voordat ze worden opgeslagen",
}

/**
 * Renders the page to add a soil analysis from a PDF lab report: first the PDF is read, then the
 * user checks the values next to the PDF and saves them.
 *
 * @returns The JSX element for the soil analysis upload page.
 */
export default function FarmFieldSoilAnalysisUploadBlock() {
  const { isNmiConfigured, soilParameterDescription } = useLoaderData<typeof loader>()

  return (
    <div className="space-y-6">
      <NavLink
        to="../soil/analysis/new"
        className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-3" })}
        data-slot="button"
      >
        <ArrowLeft />
        Andere manier kiezen
      </NavLink>
      {!isNmiConfigured && (
        <PdfReadingUnavailableAlert manualEntryHref="../soil/analysis/new/standard" />
      )}
      <SoilAnalysisUploadFlow
        soilParameterDescription={soilParameterDescription}
        disabled={!isNmiConfigured}
        manualEntryHref="../soil/analysis/new/standard"
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
 * @returns The values to check, or a redirect to the new soil analysis after saving.
 */
export async function action({ request, params }: ActionFunctionArgs) {
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
    redirectTo: (a_id) => `../soil/analysis/${a_id}`,
    onSaved: (principal_id, saved) =>
      captureEvent(principal_id, "soil_analysis_saved", {
        b_id_farm,
        b_id,
        analysis_type: saved.a_source,
        method: "upload",
        calendar: String(params.calendar),
      }),
  })
}
