import { getFields, toFdmDateString } from "@nmi-agro/fdm-core"
import { Map as MapIcon } from "lucide-react"
import { useEffect } from "react"
import {
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
} from "react-router"
import {
  FarmAttentionList,
  FarmFieldTable,
  FarmSummary,
} from "~/components/blocks/mineralization/farm-overview"
import { useSettledOutcomes } from "~/components/blocks/mineralization/use-settled-outcomes"
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
import {
  calculateFieldMineralization,
  getMineralizationTimeframe,
  getMineralizationYear,
  loadFarmMineralizationContext,
} from "~/integrations/mineralization.server"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { type FieldMineralizationOutcome, getBulkHarvestHref } from "~/lib/mineralization"

export const meta: MetaFunction = () => {
  return [
    { title: `Mineralisatie | Bedrijfsoverzicht | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Stikstofaanbod, opname en uitspoeling per perceel, met de percelen die aandacht vragen.",
    },
  ]
}

/**
 * Loads the fields of the farm and streams the mineralization outcome of every field.
 *
 * Only the field list is awaited; the farm data and the Dyna calculations are returned as promises
 * so the page renders immediately and fills in per field.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("invalid: b_id_farm", { status: 400, statusText: "invalid: b_id_farm" })
    }
    const session = await getSession(request)
    const year = getMineralizationYear(params.calendar)
    const fields = await getFields(
      fdm,
      session.principal_id,
      b_id_farm,
      getMineralizationTimeframe(year),
    )

    const contextPromise = loadFarmMineralizationContext({
      principal_id: session.principal_id,
      b_id_farm,
      year,
    })
    // Rows handle a failed load themselves; without rows nothing else observes the promise
    contextPromise.catch(() => undefined)

    const rows = fields.map((field) => ({
      b_id: field.b_id,
      b_name: field.b_name,
      b_area: field.b_area,
      outcome: contextPromise
        .then((ctx) =>
          calculateFieldMineralization(ctx, field.b_id, session.principal_id, b_id_farm),
        )
        .catch((error: unknown): FieldMineralizationOutcome => {
          reportError(error, { page: "mineralization", scope: "farm-overview" })
          return {
            b_id: field.b_id,
            b_name: field.b_name,
            b_area: field.b_area,
            status: "error",
            message: "De gegevens van dit bedrijf konden niet worden geladen.",
          }
        }),
    }))

    const currentYear = Number(toFdmDateString(new Date()).slice(0, 4))

    return {
      b_id_farm,
      calendar: params.calendar ?? String(year),
      year,
      isCurrentYear: year === currentYear,
      rows,
    }
  } catch (error) {
    const normalized = handleLoaderError(error)
    throw normalized ?? error
  }
}

export default function MineralizationFarmOverview() {
  const loaderData = useLoaderData<typeof loader>()
  // Remount per farm and year, so outcomes of another year are never shown
  return <FarmOverview key={`${loaderData.b_id_farm}-${loaderData.year}`} {...loaderData} />
}

function FarmOverview({
  b_id_farm,
  calendar,
  year,
  isCurrentYear,
  rows,
}: ReturnType<typeof useLoaderData<typeof loader>>) {
  const outcomes = useSettledOutcomes(rows)
  const { capture } = useAnalytics()

  useEffect(() => {
    capture("mineralization_viewed", { b_id_farm, year, page: "farm" })
  }, [capture, b_id_farm, year])

  const fields = rows.map(({ b_id, b_name, b_area }) => ({ b_id, b_name, b_area }))
  const overviewHref = `/farm/${b_id_farm}/${calendar}/mineralization`
  const props = {
    fields,
    outcomes,
    year,
    isCurrentYear,
    fieldHref: (b_id: string) => `${overviewHref}/${b_id}`,
    harvestHref: (b_lu_catalogue: string, fieldIds: string[]) =>
      getBulkHarvestHref({
        b_id_farm,
        calendar,
        b_lu_catalogue,
        fieldIds,
        returnUrl: overviewHref,
      }),
  }

  if (fields.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MapIcon />
          </EmptyMedia>
          <EmptyTitle>Nog geen percelen in {year}</EmptyTitle>
          <EmptyDescription>
            Voeg percelen toe aan dit bedrijf om de mineralisatie te berekenen.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            nativeButton={false}
            render={
              <NavLink to={`/farm/${b_id_farm}/${calendar}/field/new`}>Percelen toevoegen</NavLink>
            }
          />
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* The summary introduces the attention list, so it sits closer to it than the cards do */}
      <div className="flex flex-col gap-3">
        <FarmSummary fields={fields} outcomes={outcomes} />
        <FarmAttentionList {...props} />
      </div>
      <FarmFieldTable {...props} />
    </div>
  )
}
