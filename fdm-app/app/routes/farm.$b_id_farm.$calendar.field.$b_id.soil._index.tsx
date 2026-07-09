import {
  checkPermission,
  getCurrentSoilData,
  getField,
  getSoilAnalyses,
  getSoilAnalysis,
  getSoilParametersDescription,
  removeSoilAnalysis,
} from "@nmi-agro/fdm-core"
import { Plus } from "lucide-react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  NavLink,
  useFetcher,
  useLoaderData,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { SoilDataCards } from "~/components/blocks/soil/cards"
import { SoilAnalysesList } from "~/components/blocks/soil/list"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { deleteObject } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { isBcsAnalysis } from "~/lib/bcs"
import { getTimeframe } from "~/lib/calendar"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { cn } from "~/lib/utils"

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

    // Get the session
    const session = await getSession(request)

    // Get timeframe from calendar store
    const timeframe = getTimeframe(params)

    // Get details of field
    const field = await getField(fdm, session.principal_id, b_id)
    if (!field) {
      throw data("Field is not found", {
        status: 404,
        statusText: "Field is not found",
      })
    }

    // Get the soil analyses
    const soilAnalyses = await getSoilAnalyses(fdm, session.principal_id, b_id, {
      start: null,
      end: timeframe.end,
    })

    const filteredSoilAnalyses = soilAnalyses.filter((analysis) => !isBcsAnalysis(analysis))

    // Get current soil data
    const currentSoilData = await getCurrentSoilData(fdm, session.principal_id, b_id, timeframe)

    // Get soil parameter descriptions
    const soilParameterDescription = getSoilParametersDescription()

    const pathname = new URL(request.url).pathname
    const fieldWritePermission = checkPermission(
      fdm,
      "field",
      "write",
      b_id,
      session.principal_id,
      pathname,
      false,
    )

    const soilAnalysisWritePermissionsEntries = await Promise.all(
      filteredSoilAnalyses.map(async (analysis) => [
        analysis.a_id,
        await checkPermission(
          fdm,
          "soil_analysis",
          "write",
          analysis.a_id,
          session.principal_id,
          pathname,
          false,
        ),
      ]),
    )
    const soilAnalysisWritePermissions = Object.fromEntries(soilAnalysisWritePermissionsEntries)

    // Return user information from loader
    return {
      field: field,
      fieldWritePermission: await fieldWritePermission,
      currentSoilData: currentSoilData,
      soilParameterDescription: soilParameterDescription,
      soilAnalyses: filteredSoilAnalyses,
      soilAnalysisWritePermissions: soilAnalysisWritePermissions,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Component that renders the soil data overview for a farm field..
 *
 * This component displays the soil data section, including a title, description, and
 * a list of soil data cards. It also handles the case where no soil analyses are available.
 *
 */
export default function FarmFieldSoilOverviewBlock() {
  const loaderData = useLoaderData<typeof loader>()
  const fetcher = useFetcher()

  return (
    <div className="space-y-6">
      <div className="flex space-y-4">
        <div>
          <h3 className="text-lg font-medium">Bodem</h3>
          <p className="text-muted-foreground text-sm">
            In de gegevens hieronder vind je de meest recente waarde gemeten voor elke
            bodemparameter
          </p>
        </div>
        <div className="ml-auto">
          <Button asChild className={cn(!loaderData.fieldWritePermission ? "invisible" : "")}>
            <NavLink to="./analysis/new">
              <Plus />
              Bodemanalyse toevoegen
            </NavLink>
          </Button>
        </div>
      </div>
      <Separator />
      {loaderData.soilAnalyses.length === 0 ? (
        <div className="mx-auto flex h-full w-full flex-col items-center justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Dit perceel heeft nog geen bodemanalyse
            </h1>
            <p className="text-muted-foreground text-sm">
              Voeg een analyse toe om gegevens over de bodem bij te houden
            </p>
          </div>
          <Button asChild className={cn(!loaderData.fieldWritePermission ? "invisible" : "")}>
            <NavLink to="./analysis/new">Bodemanalyse toevoegen</NavLink>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">
          <div className="border-t pt-6 lg:w-2/3 lg:border-t-0 lg:pt-0">
            <SoilDataCards
              currentSoilData={loaderData.currentSoilData}
              soilParameterDescription={loaderData.soilParameterDescription}
              canModifySoilAnalysis={loaderData.soilAnalysisWritePermissions}
            />
          </div>
          <div className="space-y-4 lg:w-1/3 lg:border-l lg:pl-6">
            <h4 className="text-muted-foreground text-xs font-bold tracking-[0.1em] uppercase">
              Bodemanalyses
            </h4>
            <SoilAnalysesList
              soilAnalyses={loaderData.soilAnalyses}
              soilParameterDescription={loaderData.soilParameterDescription}
              fetcher={fetcher}
              canModifySoilAnalysis={loaderData.soilAnalysisWritePermissions}
              fieldName={loaderData.field.b_name}
            />
          </div>
        </div>
      )}
    </div>
  )
}

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
    if (request.method === "DELETE") {
      const formData = await request.formData()
      const a_id = formData.get("a_id") as string | null
      if (!a_id) {
        throw data("Analysis ID is required", {
          status: 400,
          statusText: "Analysis ID is required",
        })
      }

      // Get the session
      const session = await getSession(request)

      // Remove the analysis
      const soilAnalysis = await getSoilAnalysis(fdm, session.principal_id, a_id)
      if (isBcsAnalysis(soilAnalysis)) {
        throw data("Dit is een BodemConditieScore analyse", {
          status: 403,
          statusText: "Dit is een BodemConditieScore analyse",
        })
      }
      if (soilAnalysis?.a_file_path) {
        await deleteObject(soilAnalysis.a_file_path)
      }
      await removeSoilAnalysis(fdm, session.principal_id, a_id)
      return redirectWithSuccess("./", {
        message: "Bodemanalyse is verwijderd! 🎉",
      })
    }
    throw data("Method not allowed", {
      status: 405,
      statusText: "Method not allowed",
    })
  } catch (error) {
    throw handleActionError(error)
  }
}
