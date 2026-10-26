import { getFieldExclusionReason, getMainCultivation } from "@nmi-agro/fdm-calculator"
import { getCultivationsForFarm, getFarm, getFarms, getFields } from "@nmi-agro/fdm-core"
import { Bubbles } from "lucide-react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import {
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  Outlet,
  useLoaderData,
  useParams,
} from "react-router"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { HeaderMineralization } from "~/components/blocks/header/mineralization"
import { MineralizationExperimentalNote } from "~/components/blocks/mineralization/experimental-note"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { SidebarInset } from "~/components/ui/sidebar"
import {
  getMineralizationTimeframe,
  getMineralizationYear,
} from "~/integrations/mineralization.server"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import PostHogClient from "~/posthog.server"

/** Calculations stream in with their own loading states; the global loader is not needed. */
export const handle = { hideNavigationProgress: true }

export const meta: MetaFunction = () => {
  return [
    { title: `Mineralisatie | ${clientConfig.name}` },
    {
      name: "description",
      content: "Bekijk de stikstofmineralisatie voor je percelen en bedrijf.",
    },
  ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("invalid: b_id_farm", {
        status: 400,
        statusText: "invalid: b_id_farm",
      })
    }

    const session = await getSession(request)
    const posthog = PostHogClient()

    // Check if Mineralization is enabled for this user
    const isMineralizationEnabled =
      (
        await posthog?.evaluateFlags(session.principal_id, {
          flagKeys: ["mineralization"],
        })
      )?.isEnabled("mineralization") ?? true

    const year = getMineralizationYear(params.calendar)
    const timeframe = getMineralizationTimeframe(year)

    const farm = await getFarm(fdm, session.principal_id, b_id_farm)
    if (!farm) {
      throw data("not found: b_id_farm", {
        status: 404,
        statusText: "not found: b_id_farm",
      })
    }

    const farms = await getFarms(fdm, session.principal_id)
    if (!farms || farms.length === 0) {
      throw data("not found: farms", {
        status: 404,
        statusText: "not found: farms",
      })
    }

    const farmOptions = farms.map((f) => ({
      b_id_farm: f.b_id_farm,
      b_name_farm: f.b_name_farm,
    }))

    const [fields, cultivations] = await Promise.all([
      getFields(fdm, session.principal_id, b_id_farm, timeframe),
      getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
    ])
    // Buffer strips, nature and landscape elements are not calculated, so they are not offered
    const fieldOptions = fields
      .filter((field) => {
        const main = getMainCultivation(cultivations.get(field.b_id) ?? [], year)
        return (
          getFieldExclusionReason({
            b_bufferstrip: field.b_bufferstrip,
            b_lu_croprotation: main?.b_lu_croprotation,
            b_lu_catalogue: main?.b_lu_catalogue,
          }) === null
        )
      })
      .map((field) => {
        if (!field?.b_id) throw new Error("Invalid field data")
        return {
          b_id: field.b_id,
          b_name: field.b_name,
          b_area: field.b_area != null ? Math.round(field.b_area * 10) / 10 : 0,
        }
      })

    return {
      farm,
      b_id_farm,
      farmOptions,
      fieldOptions,
      isMineralizationEnabled,
    }
  } catch (error) {
    const normalized = handleLoaderError(error)
    throw normalized ?? error
  }
}

export { shouldRevalidateMineralization as shouldRevalidate } from "~/lib/mineralization"

export default function MineralizationLayout() {
  const loaderData = useLoaderData<typeof loader>()
  const { b_id } = useParams() // Get the field ID from child routes

  // Prefer the server-evaluated flag (avoids flicker on initial render and
  // eliminates a redundant PostHog call). Fall back to the client hook only
  // when the server value is absent (e.g. PostHog unavailable server-side).
  const clientFlagEnabled = useFeatureFlagEnabled("mineralization")
  const isMineralizationEnabled = loaderData.isMineralizationEnabled ?? clientFlagEnabled ?? true

  const fieldName = b_id
    ? (loaderData.fieldOptions.find((f) => f.b_id === b_id)?.b_name ?? "Perceel")
    : null
  const title = fieldName ? `Mineralisatie – ${fieldName}` : "Mineralisatie"
  const description = fieldName
    ? "Stikstofaanbod, opname door het gewas en uitspoeling door het seizoen heen."
    : "Hoeveel stikstof komt er beschikbaar voor je gewassen, en welke percelen vragen aandacht?"

  const { calendar } = useParams()
  const action = b_id
    ? {
        to: `/farm/${loaderData.b_id_farm}/${calendar}/mineralization`,
        label: "Terug naar mineralisatie",
        disabled: false,
      }
    : {
        to: `/farm/${loaderData.b_id_farm}`,
        label: "Terug naar bedrijf",
        disabled: false,
      }

  if (isMineralizationEnabled === false) {
    return (
      <SidebarInset>
        <Header action={action}>
          <HeaderFarm b_id_farm={loaderData.b_id_farm} farmOptions={loaderData.farmOptions} />
        </Header>
        <main className="flex flex-1 flex-col items-center justify-center p-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Bubbles className="text-muted-foreground h-10 w-10" />
              </EmptyMedia>
              <EmptyTitle>Mineralisatie is nog niet beschikbaar voor je.</EmptyTitle>
              <EmptyDescription>
                Mineralisatie is momenteel in ontwikkeling en is nog niet voor iedereen geactiveerd.
                Als je meer wilt weten, neem dan contact op met Ondersteuning.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </main>
      </SidebarInset>
    )
  }

  return (
    <SidebarInset>
      <Header action={action}>
        <HeaderFarm b_id_farm={loaderData.b_id_farm} farmOptions={loaderData.farmOptions} />
        <HeaderMineralization
          b_id_farm={loaderData.b_id_farm}
          b_id={b_id}
          fieldOptions={loaderData.fieldOptions}
        />
      </Header>
      <main>
        <FarmTitle
          title={title}
          description={description}
          descriptionNode={
            <div className="space-y-2">
              <p className="text-muted-foreground wrap-break-word">{description}</p>
              <MineralizationExperimentalNote b_id_farm={loaderData.b_id_farm} />
            </div>
          }
        />
        <FarmContent>
          <Outlet />
        </FarmContent>
      </main>
    </SidebarInset>
  )
}
