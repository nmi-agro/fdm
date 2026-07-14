import { calculateDose, getNutrientAdvice } from "@nmi-agro/fdm-calculator"
import {
  checkPermission,
  getCultivationsForFarm,
  getCurrentSoilDataForFarm,
  getFertilizerApplicationsForFarm,
  getFertilizers,
  getFields,
} from "@nmi-agro/fdm-core"
import { BookOpenText } from "lucide-react"
import { Suspense, use, useEffect } from "react"
import { type LoaderFunctionArgs, type MetaFunction, NavLink, useLoaderData } from "react-router"
import type { FieldNutrientRow } from "~/components/blocks/nutrient-advice/overview-types"
import { getNutrientsDescription } from "~/components/blocks/nutrient-advice/nutrients"
import { toFriendlyAdviceError } from "~/components/blocks/nutrient-advice/overview-errors"
import { NutrientAdviceOverviewSkeleton } from "~/components/blocks/nutrient-advice/overview-skeleton"
import { NutrientAdviceOverviewTable } from "~/components/blocks/nutrient-advice/overview-table"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { useAnalytics } from "~/hooks/use-analytics"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { getMainCultivation } from "~/lib/hoofdteelt.server"
import { getCultivationSuggestion } from "~/lib/cultivation-suggestion.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { cn } from "~/lib/utils"
import { getNmiApiKey } from "../integrations/nmi.server"

// Cap on simultaneous getNutrientAdvice calls per farm, so farms with many fields don't overload
// the external NMI API with unbounded parallel requests.
const NUTRIENT_ADVICE_CONCURRENCY = 4

/** Splits an array into consecutive chunks of at most `size` items each. */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

// Meta
export const meta: MetaFunction = () => {
  return [
    {
      title: `Bemestingsadvies | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bekijk je Bemestingsadvies",
    },
  ]
}

/**
 * Loads the fields of a farm and their write permission, so the overview can render immediately.
 * The (slower) per-field nutrient advice calculation is deferred into `asyncData` and streamed in,
 * since it requires an external NMI API call per field.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw new Error("b_id_farm is required")
    }

    // Get the session
    const session = await getSession(request)

    // Get timeframe from calendar store
    const timeframe = getTimeframe(params)
    const calendar = getCalendar(params)

    // Get the fields of the farm
    const fields = await getFields(fdm, session.principal_id, b_id_farm, timeframe)

    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      new URL(request.url).pathname,
      false,
    )

    const nutrientsDescription = getNutrientsDescription()

    const asyncData = (async (): Promise<{ rows: FieldNutrientRow[] }> => {
      if (fields.length === 0) {
        return { rows: [] }
      }

      // Fetch farm-wide data in a handful of batched queries instead of N queries per field. If this
      // batch fails, fall back to per-field error rows instead of throwing to the route error boundary.
      let cultivationsByField: Awaited<ReturnType<typeof getCultivationsForFarm>>
      let fertilizerApplicationsByField: Awaited<
        ReturnType<typeof getFertilizerApplicationsForFarm>
      >
      let soilDataByField: Awaited<ReturnType<typeof getCurrentSoilDataForFarm>>
      let fertilizers: Awaited<ReturnType<typeof getFertilizers>>
      try {
        ;[cultivationsByField, fertilizerApplicationsByField, soilDataByField, fertilizers] =
          await Promise.all([
            getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
            getFertilizerApplicationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
            getCurrentSoilDataForFarm(fdm, session.principal_id, b_id_farm, timeframe),
            getFertilizers(fdm, session.principal_id, b_id_farm),
          ])
      } catch (error) {
        const errorMessage = toFriendlyAdviceError(error)
        return {
          rows: fields.map(
            (field): FieldNutrientRow => ({
              b_id: field.b_id,
              b_name: field.b_name,
              b_area: field.b_area ?? 0,
              mainCultivation: null,
              errorMessage,
              values: {},
            }),
          ),
        }
      }

      const nmiApiKey = getNmiApiKey()

      const results: PromiseSettledResult<FieldNutrientRow>[] = []
      for (const fieldsChunk of chunk(fields, NUTRIENT_ADVICE_CONCURRENCY)) {
        const chunkResults = await Promise.allSettled(
          fieldsChunk.map(async (field): Promise<FieldNutrientRow> => {
            const cultivations = cultivationsByField.get(field.b_id) ?? []
            const b_area = field.b_area ?? 0

            if (cultivations.length === 0) {
              return {
                b_id: field.b_id,
                b_name: field.b_name,
                b_area,
                mainCultivation: null,
                errorMessage: "Geen gewas geregistreerd voor dit perceel.",
                values: {},
              }
            }

            const hasDefaultCultivation = !!getMainCultivation(cultivations, calendar)
            const activeCultivation =
              getMainCultivation(cultivations, calendar) ?? cultivations[0]
            const fertilizerApplications = fertilizerApplicationsByField.get(field.b_id) ?? []
            const currentSoilData = soilDataByField.get(field.b_id) ?? []

            const cultivationSuggestion = hasDefaultCultivation
              ? undefined
              : await getCultivationSuggestion(
                  fdm,
                  session.principal_id,
                  b_id_farm,
                  field.b_id,
                  calendar,
                  nmiApiKey,
                )

            const mainCultivation = {
              b_lu: activeCultivation.b_lu,
              b_lu_name: activeCultivation.b_lu_name,
              b_lu_croprotation: activeCultivation.b_lu_croprotation ?? null,
            }

            try {
              const doses = calculateDose({ applications: fertilizerApplications, fertilizers })
              const nutrientAdvice = await getNutrientAdvice(fdm, {
                b_lu_catalogue: activeCultivation.b_lu_catalogue,
                b_centroid: field.b_centroid,
                currentSoilData,
                nmiApiKey,
                b_bufferstrip: field.b_bufferstrip,
              })

              const values: FieldNutrientRow["values"] = {}
              for (const nutrient of nutrientsDescription) {
                values[nutrient.symbol] = {
                  filling:
                    (doses.dose[nutrient.doseParameter as keyof typeof doses.dose] as number) ?? 0,
                  advice:
                    nutrientAdvice[nutrient.adviceParameter as keyof typeof nutrientAdvice] ?? 0,
                }
              }

              return {
                b_id: field.b_id,
                b_name: field.b_name,
                b_area,
                mainCultivation,
                cultivationSuggestion,
                values,
              }
            } catch (error) {
              return {
                b_id: field.b_id,
                b_name: field.b_name,
                b_area,
                mainCultivation,
                cultivationSuggestion,
                errorMessage: toFriendlyAdviceError(error),
                values: {},
              }
            }
          }),
        )
        results.push(...chunkResults)
      }

      const rows = results.map((result, index) => {
        if (result.status === "fulfilled") {
          return result.value
        }
        const field = fields[index]
        return {
          b_id: field.b_id,
          b_name: field.b_name,
          b_area: field.b_area ?? 0,
          mainCultivation: null,
          errorMessage: toFriendlyAdviceError(result.reason),
          values: {},
        } satisfies FieldNutrientRow
      })

      return { rows }
    })()

    return {
      hasFields: fields.length > 0,
      b_id_farm: b_id_farm,
      calendar: calendar,
      farmWritePermission,
      nutrientsDescription,
      asyncData,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export default function FieldNutrientAdviceIndex() {
  const loaderData = useLoaderData<typeof loader>()
  const { hasFields, b_id_farm, calendar } = loaderData
  const { capture } = useAnalytics()

  useEffect(() => {
    capture("nutrient_advice_viewed", { b_id_farm, calendar })
  }, [])

  if (!hasFields) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpenText />
          </EmptyMedia>
          <EmptyTitle>Geen percelen gevonden</EmptyTitle>
          <EmptyDescription>
            Het lijkt erop dat er nog geen percelen zijn geregistreerd voor dit bedrijf.
            {loaderData.farmWritePermission
              ? " Voeg een nieuw perceel toe om bemestingsadvies te kunnen bekijken."
              : null}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">
            <Button
              variant="default"
              className={cn(!loaderData.farmWritePermission ? "hidden" : "")}
              asChild
            >
              <NavLink to={`/farm/${b_id_farm}/${calendar}/field/new`}>Nieuw perceel</NavLink>
            </Button>
            <Button variant="outline" asChild>
              <NavLink to="../">Naar bedrijfsoverzicht</NavLink>
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="min-w-0 px-10 pb-10">
      <Suspense key={`${b_id_farm}#${calendar}`} fallback={<NutrientAdviceOverviewSkeleton />}>
        <NutrientAdviceOverview loaderData={loaderData} />
      </Suspense>
    </div>
  )
}

/**
 * Renders the table once the per-field nutrient advice has resolved.
 *
 * This has to be extracted into a separate component because of the `use(...)` hook.
 * React will not render the component until `asyncData` resolves, but React Router
 * handles it nicely via the `Suspense` component and server-to-client data streaming.
 */
function NutrientAdviceOverview({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>
}) {
  const { rows } = use(loaderData.asyncData)
  return (
    <NutrientAdviceOverviewTable
      data={rows}
      nutrients={loaderData.nutrientsDescription}
      b_id_farm={loaderData.b_id_farm}
      calendar={loaderData.calendar}
    />
  )
}
