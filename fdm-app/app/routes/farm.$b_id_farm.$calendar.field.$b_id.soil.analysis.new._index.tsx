import { getField, getSoilParametersDescription } from "@nmi-agro/fdm-core"
import { Files } from "lucide-react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  NavLink,
  useLoaderData,
} from "react-router"
import { SoilAnalysisFormSelection } from "~/components/blocks/soil/form-selection"
import {
  PdfReadingUnavailableAlert,
  SoilAnalysisUploadFlow,
} from "~/components/blocks/soil/upload-flow"
import { Separator } from "~/components/ui/separator"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { captureEvent } from "~/lib/analytics.server"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { handleSoilAnalysisUploadAction } from "~/lib/soil-upload.server"

/**
 * Loader function for the page to add a soil analysis.
 *
 * Fetches the field details to ensure the field exists and is accessible, the soil parameter
 * descriptions for checking the values read from a PDF, and whether PDFs can be read.
 *
 * @param request - The HTTP request object.
 * @param params - The route parameters containing `b_id_farm` and `b_id`.
 * @returns The field, the soil parameter descriptions and whether PDF reading is configured.
 * @throws {Response} If the farm ID or field ID is missing, or if the field is not found.
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

    return {
      field: field,
      b_id_farm: b_id_farm,
      soilParameterDescription: getSoilParametersDescription(),
      isNmiConfigured: Boolean(getNmiApiKey()),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Page to add a soil analysis. Uploading the PDF report of the lab is the main way: the values are
 * read and checked before saving. Below it are the forms to enter the values by hand.
 */
export default function FarmFieldSoilAnalysisNewBlock() {
  const { b_id_farm, isNmiConfigured, soilParameterDescription } = useLoaderData<typeof loader>()

  const manualEntry = (
    <section aria-labelledby="soil-manual-entry" className="space-y-3">
      <div className="space-y-1">
        <h4 id="soil-manual-entry" className="text-base font-semibold">
          Zelf invoeren
        </h4>
        <p className="text-muted-foreground text-sm">
          Geen PDF, of een lab dat nog niet wordt ondersteund? Kies het formulier dat bij de analyse
          past.
        </p>
      </div>
      <SoilAnalysisFormSelection />
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Files aria-hidden className="size-4 shrink-0" />
        <span>
          Rapporten voor meerdere percelen tegelijk?{" "}
          <NavLink
            to={`/farm/${b_id_farm}/soil-analysis/bulk`}
            className="text-foreground font-medium underline underline-offset-4"
          >
            Upload ze in één keer
          </NavLink>
        </span>
      </p>
    </section>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">Bodemanalyse toevoegen</h3>
          <p className="text-muted-foreground text-sm">
            Upload het PDF-rapport van het lab, of voer de waarden zelf in.
          </p>
        </div>
      </div>
      <Separator />
      {isNmiConfigured ? (
        <SoilAnalysisUploadFlow
          soilParameterDescription={soilParameterDescription}
          manualEntryHref="./standard"
          belowUpload={manualEntry}
        />
      ) : (
        <div className="max-w-3xl space-y-6">
          <PdfReadingUnavailableAlert manualEntryHref="./standard" />
          {manualEntry}
        </div>
      )}
    </div>
  )
}

/**
 * Action for adding a soil analysis from a PDF on this page: reads the PDF (`intent=extract`) or
 * saves the checked values with the PDF (`intent=save`). See `handleSoilAnalysisUploadAction`.
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
