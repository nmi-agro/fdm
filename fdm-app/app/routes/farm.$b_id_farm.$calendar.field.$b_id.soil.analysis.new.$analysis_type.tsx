import { addSoilAnalysis, getField } from "@nmi-agro/fdm-core"
import { ArrowLeft } from "lucide-react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  NavLink,
  useLoaderData,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import type { FieldPageHandle } from "~/lib/field-page"
import { SoilAnalysisForm } from "~/components/blocks/soil/form"
import { FormSchema } from "~/components/blocks/soil/formschema"
import { getSoilParametersForSoilAnalysisType } from "~/components/blocks/soil/parameters.server"
import { Button } from "~/components/ui/button"
import { captureEvent } from "~/lib/analytics.server"
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"

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

    // Get the parameters for the soil analysis
    const soilAnalysisType = params.analysis_type
    if (!soilAnalysisType) {
      throw data("Type of soil analysis required", {
        status: 400,
        statusText: "Type of soil analysis required",
      })
    }
    if (
      soilAnalysisType !== "all" &&
      soilAnalysisType !== "standard" &&
      soilAnalysisType !== "nmin" &&
      soilAnalysisType !== "derogation"
    ) {
      throw data("Invalid type of soil analysis", {
        status: 400,
        statusText: "Invalid type of soil analysis",
      })
    }
    const soilAnalysisParameterDescription = getSoilParametersForSoilAnalysisType(soilAnalysisType)

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

    // Return user information from loader
    return {
      field: field,
      soilParameterDescription: soilAnalysisParameterDescription,
      soilAnalysisType: soilAnalysisType,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/** The field layout names the form under the field name. */
export const handle: FieldPageHandle = {
  fieldDescription: (loaderData) => {
    const type = (loaderData as { soilAnalysisType?: string } | undefined)?.soilAnalysisType
    const title = SOIL_ANALYSIS_TYPE_TITLES[type as keyof typeof SOIL_ANALYSIS_TYPE_TITLES]
    return title ? `${title}: neem de waarden over uit het rapport van het lab` : undefined
  },
}

/** Page titles per type of soil analysis form. */
const SOIL_ANALYSIS_TYPE_TITLES = {
  standard: "Standaard bodemanalyse invoeren",
  nmin: "Nmin-bemonstering invoeren",
  derogation: "Analyse voor derogatie invoeren",
  all: "Bodemanalyse invoeren",
} as const

/**
 * Component that renders the soil analysis creation form for a specific field.
 *
 * This component displays a page header with description, a back button,
 * and the SoilAnalysisForm component for adding a new soil analysis.
 * It uses data loaded by the loader function to provide soil parameter descriptions.
 */
export default function FarmFieldSoilOverviewBlock() {
  const loaderData = useLoaderData<typeof loader>()

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <NavLink to="../soil/analysis/new">
          <ArrowLeft />
          Andere manier kiezen
        </NavLink>
      </Button>
      <SoilAnalysisForm
        soilAnalysis={undefined}
        soilParameterDescription={loaderData.soilParameterDescription}
        action="."
      />
    </div>
  )
}

/**
 *  Action function to add a new soil analysis.
 *
 * This function creates a new soil analysis based on the provided form data.
 * It validates the data, retrieves the necessary IDs from the route parameters,
 * and uses the `addSoilAnalysis` function from `@nmi-agro/fdm-core` to perform the creation.
 *
 * @param params - The route parameters, including `b_id` and `b_id_farm`.
 * @returns A redirect to the new soil analysis after successful creation.
 * @throws {Response} If any ID is missing (HTTP 400).
 * @throws {Response} If there is an error during the creation (HTTP 500).
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

  try {
    // Get the session
    const session = await getSession(request)

    // Get from values
    const formValues = await extractFormValuesFromRequest(request, FormSchema)

    // add soil analysis
    const a_id = await addSoilAnalysis(
      fdm,
      session.principal_id,
      undefined,
      formValues.a_source,
      b_id,
      undefined,
      formValues.b_sampling_date,
      formValues,
    )

    captureEvent(session.principal_id, "soil_analysis_saved", {
      b_id_farm,
      b_id,
      analysis_type: formValues.a_source,
      method: "manual",
      calendar: String(params.calendar),
    })

    // Show the saved analysis, so the user sees what was stored
    return redirectWithSuccess(`../soil/analysis/${a_id}`, {
      message: "Bodemanalyse toegevoegd",
    })
  } catch (error) {
    return handleActionError(error)
  }
}
