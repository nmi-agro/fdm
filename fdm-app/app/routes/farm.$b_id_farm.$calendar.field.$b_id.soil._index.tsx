import { enrichCurrentSoilDataWithNlv } from "@nmi-agro/fdm-calculator"
import {
  checkPermission,
  getCurrentSoilData,
  getField,
  getSoilAnalyses,
  getSoilAnalysis,
  getSoilParametersDescription,
  removeSoilAnalysis,
} from "@nmi-agro/fdm-core"
import { FlaskConical, Plus } from "lucide-react"
import { useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  NavLink,
  useFetcher,
  useLoaderData,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import type { HelpHandle } from "~/lib/manual/help-targets"
import { SoilDataCards } from "~/components/blocks/soil/cards"
import {
  SOIL_ANALYSES_MAP_ID,
  SoilAnalysesOverview,
} from "~/components/blocks/soil/soil-analyses-overview"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Separator } from "~/components/ui/separator"
import { deleteObject } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { isBcsAnalysis } from "~/lib/bcs"
import { getTimeframe } from "~/lib/calendar"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

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

export const handle: HelpHandle = { help: "bodem" }

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
    const currentSoilData = enrichCurrentSoilDataWithNlv(
      await getCurrentSoilData(fdm, session.principal_id, b_id, timeframe),
    )

    // Get soil parameter descriptions
    const soilParameterDescription = getSoilParametersDescription()

    const pathname = url.pathname
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
 * Component that renders the soil data overview for a farm field.
 *
 * It shows the most recent value of each soil parameter as cards, next to the map and list of the
 * soil analyses of the field. A value that only covers part of the field can highlight its sampling
 * zones on the map. Without soil analyses, it explains how to add one.
 */
export default function FarmFieldSoilOverviewBlock() {
  const loaderData = useLoaderData<typeof loader>()
  const fetcher = useFetcher()
  // A highlight set by clicking a value stays until the user points at something else; otherwise
  // the pointer leaving the value (for example when the page scrolls to the map) would clear it
  const [highlight, setHighlight] = useState<{ ids: string[]; pinned: boolean }>({
    ids: [],
    pinned: false,
  })
  const highlightedIds = highlight.ids
  const setHighlightedIds = (ids: string[]) => setHighlight({ ids, pinned: false })

  const handleShowZones = (a_ids: string[], options?: { scroll?: boolean }) => {
    if (a_ids.length === 0 && highlight.pinned) return
    setHighlight({ ids: a_ids, pinned: options?.scroll === true })
    if (options?.scroll) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      document
        .getElementById(SOIL_ANALYSES_MAP_ID)
        ?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" })
    }
  }

  const addAnalysisButton = loaderData.fieldWritePermission ? (
    <Button
      nativeButton={false}
      render={
        <NavLink to="./analysis/new">
          <Plus aria-hidden />
          Bodemanalyse toevoegen
        </NavLink>
      }
    />
  ) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">Bodem</h3>
          <p className="text-muted-foreground text-sm">
            Per bodemparameter de meest recente waarde, met de analyse waar die vandaan komt.
          </p>
        </div>
        {loaderData.soilAnalyses.length > 0 && addAnalysisButton}
      </div>
      <Separator />
      {loaderData.soilAnalyses.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FlaskConical aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Nog geen bodemanalyse</EmptyTitle>
            <EmptyDescription>
              {loaderData.fieldWritePermission
                ? "Voeg een bodemanalyse toe, bijvoorbeeld door het PDF-rapport van het lab te uploaden. De waarden verschijnen dan hier."
                : "Voor dit perceel is nog geen bodemanalyse vastgelegd."}
            </EmptyDescription>
          </EmptyHeader>
          {addAnalysisButton && <EmptyContent>{addAnalysisButton}</EmptyContent>}
        </Empty>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 lg:w-2/3">
            <SoilDataCards
              currentSoilData={loaderData.currentSoilData}
              soilParameterDescription={loaderData.soilParameterDescription}
              canModifySoilAnalysis={loaderData.soilAnalysisWritePermissions}
              onShowZones={handleShowZones}
            />
          </div>
          <section
            className="space-y-4 border-t pt-6 lg:w-1/3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
            aria-labelledby="soil-analyses-heading"
          >
            <h4
              id="soil-analyses-heading"
              className="text-muted-foreground text-xs font-bold tracking-[0.1em] uppercase"
            >
              Bodemanalyses
            </h4>
            <SoilAnalysesOverview
              soilAnalyses={loaderData.soilAnalyses}
              fieldGeometry={loaderData.field.b_geometry}
              soilParameterDescription={loaderData.soilParameterDescription}
              fetcher={fetcher}
              canModifySoilAnalysis={loaderData.soilAnalysisWritePermissions}
              fieldName={loaderData.field.b_name}
              highlightedIds={highlightedIds}
              onHighlight={setHighlightedIds}
            />
          </section>
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
      await removeSoilAnalysis(fdm, session.principal_id, a_id)
      if (soilAnalysis?.a_file_path) {
        await deleteObject(soilAnalysis.a_file_path)
      }
      return redirectWithSuccess("./", {
        message: "Bodemanalyse verwijderd",
      })
    }
    throw data("Method not allowed", {
      status: 405,
      statusText: "Method not allowed",
    })
  } catch (error) {
    return handleActionError(error)
  }
}
