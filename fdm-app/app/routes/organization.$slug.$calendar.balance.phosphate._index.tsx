import {
  calculatePhosphateBalance,
  calculatePhosphateBalanceFieldsToFarm,
  collectInputForPhosphateBalanceForFarms,
  type PhosphateBalance,
  type PhosphateBalanceFieldResult,
} from "@nmi-agro/fdm-calculator"
import { getFarms, getFields } from "@nmi-agro/fdm-core"
import { CircleAlert, CircleCheck, CircleX } from "lucide-react"
import { Suspense, use } from "react"
import {
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
  useLocation,
  useParams,
} from "react-router"
import type { OrganizationFarmGroup } from "~/lib/farm-groups"
import { BufferStripInfo } from "~/components/blocks/balance/buffer-strip-info"
import { FarmSelectDialog } from "~/components/blocks/balance/farm-select-dialog"
import { PhosphateBalanceCard } from "~/components/blocks/balance/phosphate-balance-card"
import { PhosphateBalanceChart } from "~/components/blocks/balance/phosphate-chart"
import {
  formatNumberNl,
  getPhosphateTrendStatus,
  PHOSPHATE_UNIT,
} from "~/components/blocks/balance/phosphate-format"
import { NitrogenBalanceFallback } from "~/components/blocks/balance/skeletons"
import { GroupPicker } from "~/components/blocks/farm-groups/group-picker"
import { NoFarmsMessage } from "~/components/blocks/organization/no-farms-message"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { auth, getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { getOrganizationFarmGroups, parseFarmIdsParam } from "~/lib/farm-selection.server"
import { fdm } from "~/lib/fdm.server"

type Farm = Awaited<ReturnType<typeof getFarms>>[number]
type Organization = Awaited<ReturnType<typeof auth.api.listOrganizations>>[number]
type FarmResult = {
  farm: Farm
  totalArea: number
  phosphateBalanceResult: PhosphateBalance
}
type FarmExtended = Farm & { b_area_farm: number }
type AsyncData = {
  farmIds: string[]
  farmResults: FarmResult[]
  combinedResult: PhosphateBalance
  farms: FarmExtended[]
}
type LoaderData =
  | { organization: Organization; noFarms: true }
  | {
      organization: Organization
      noFarms: false
      farmGroups: OrganizationFarmGroup[]
      asyncData: Promise<AsyncData>
    }

// Meta
export const meta: MetaFunction = () => {
  return [
    { title: `Fosfaat | Organisatie | Nutriëntenbalans| ${clientConfig.name}` },
    { name: "description", content: "Bekijk de fosfaatbalans van je organisatie." },
  ]
}

/** Result of a farm that could not be calculated. */
function failedFarmResult(errorMessage: string): PhosphateBalance {
  return {
    ...calculatePhosphateBalanceFieldsToFarm([], [errorMessage]),
    hasErrors: true,
    errorMessage,
  }
}

/**
 * Loads the farms of the organisation and (deferred) their phosphate balance for the selected
 * calendar year, in the same way as the organisation pages of the nitrogen and organic matter
 * balance: the selection of farms comes from the `farmIds` search parameter or the farm groups.
 */
export async function loader({ request, params, url }: LoaderFunctionArgs): Promise<LoaderData> {
  try {
    const slug = params.slug
    if (!slug) {
      throw data("missing: slug", { status: 404, statusText: "missing: slug" })
    }

    const searchParamFarmIds = parseFarmIdsParam(url)
    const timeframe = getTimeframe(params)
    const session = await getSession(request)

    const allOrganizations = await auth.api.listOrganizations({ headers: request.headers })
    const organization = allOrganizations.find((org) => org.slug === slug)
    if (!organization) {
      throw data(`not found: ${slug}`, { status: 404, statusText: `not found: ${slug}` })
    }

    const farms = await getFarms(fdm, organization.id)
    if (farms.length === 0) {
      return { organization, noFarms: true }
    }

    const allFarmIds = new Set(farms.map((farm) => farm.b_id_farm))
    if (searchParamFarmIds?.some((b_id_farm) => !allFarmIds.has(b_id_farm))) {
      const statusText = "You do not have permission to compute phosphate balance for these farms"
      throw data(statusText, { status: 403, statusText })
    }

    async function getAsyncData(principal_id: string): Promise<AsyncData> {
      const farmIdsSet = new Set(searchParamFarmIds ?? [])

      const farmsExtended = await Promise.all(
        farms.map(async (farm) => {
          const fields = await getFields(fdm, principal_id, farm.b_id_farm)
          const b_area_farm = fields.reduce((total, field) => total + (field.b_area ?? 0), 0)
          return { ...farm, hasFields: fields.length > 0, b_area_farm }
        }),
      )
      // Largest farms first
      farmsExtended.sort((f1, f2) => f2.b_area_farm - f1.b_area_farm)

      // Default selection: the farms with fields (or all farms when none has fields)
      if (farmIdsSet.size === 0) {
        for (const farm of farmsExtended) {
          if (farm.hasFields) farmIdsSet.add(farm.b_id_farm)
        }
        if (farmIdsSet.size === 0) {
          for (const farm of farmsExtended) farmIdsSet.add(farm.b_id_farm)
        }
      }
      const farmIds = farmsExtended
        .filter((farm) => farmIdsSet.has(farm.b_id_farm))
        .map((farm) => farm.b_id_farm)

      const inputs = await collectInputForPhosphateBalanceForFarms(
        fdm,
        principal_id,
        farmIds,
        timeframe,
      )
      const inputsByFarm = new Map(inputs.map((input) => [input.b_id_farm, input]))

      const farmResults: FarmResult[] = await Promise.all(
        farmsExtended
          .filter((farm) => farmIdsSet.has(farm.b_id_farm))
          .map(async (farm) => {
            const input = inputsByFarm.get(farm.b_id_farm)
            if (!input || input.fields.length === 0) {
              return {
                farm,
                totalArea: farm.b_area_farm,
                phosphateBalanceResult: failedFarmResult("No fields in input"),
              }
            }
            try {
              const phosphateBalanceResult = await calculatePhosphateBalance(fdm, input)
              if (phosphateBalanceResult.hasErrors) {
                reportError(
                  phosphateBalanceResult.fieldErrorMessages.join(",\n"),
                  {
                    page: "organization/{slug}/{calendar}/balance/phosphate/_index",
                    scope: "loader",
                  },
                  { b_id_farm: farm.b_id_farm, timeframe, userId: session.principal_id },
                )
              }
              return { farm, totalArea: farm.b_area_farm, phosphateBalanceResult }
            } catch (error) {
              return {
                farm,
                totalArea: farm.b_area_farm,
                phosphateBalanceResult: failedFarmResult(
                  error instanceof Error ? error.message : String(error),
                ),
              }
            }
          }),
      )

      // Organisation average: area-weighted over all fields of the selected farms
      const allFields = farmResults.flatMap((r) => r.phosphateBalanceResult.fields)
      const combinedResult = calculatePhosphateBalanceFieldsToFarm(
        allFields,
        farmResults.flatMap((r) => r.phosphateBalanceResult.fieldErrorMessages),
      )

      return { farmIds, farms: farmsExtended, farmResults, combinedResult }
    }

    const farmGroups = await getOrganizationFarmGroups(
      session.principal_id,
      organization.id,
      farms.map((farm) => farm.b_id_farm),
      getCalendar(params),
    )

    return {
      organization,
      noFarms: false,
      farmGroups,
      asyncData: getAsyncData(organization.id),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Share of the area (%) of the fields whose balance fits the PSD aim (the green check on the farm
 * page), among the fields whose status is known. `null` when no status is known.
 */
function getShareOnTrack(fields: PhosphateBalanceFieldResult[]): number | null {
  let known = 0
  let onTrack = 0
  for (const field of fields) {
    if (!field.balance || field.b_bufferstrip || field.b_area <= 0) continue
    const status = getPhosphateTrendStatus(field.balance)
    if (status === "unknown") continue
    known += field.b_area
    if (status === "on_track") onTrack += field.b_area
  }
  return known > 0 ? (onTrack / known) * 100 : null
}

/** Check when at least half of the area is on track, cross otherwise, orange when unknown. */
function ShareOnTrackIcon({ share }: { share: number | null }) {
  if (share === null) {
    return (
      <CircleAlert
        aria-label="Fosfaatverzadiging onbekend"
        className="h-6 w-6 shrink-0 rounded-full bg-orange-100 p-0 text-orange-500"
      />
    )
  }
  return share >= 50 ? (
    <CircleCheck
      aria-label="De meeste percelen passen bij het doel voor de fosfaatverzadiging"
      className="h-6 w-6 shrink-0 rounded-full bg-green-100 p-0 text-green-500"
    />
  ) : (
    <CircleX
      aria-label="De meeste percelen passen niet bij het doel voor de fosfaatverzadiging"
      className="h-6 w-6 shrink-0 rounded-full bg-red-100 p-0 text-red-500"
    />
  )
}

export default function OrganizationBalancePhosphateBlock() {
  const loaderData = useLoaderData<typeof loader>()
  const location = useLocation()

  return (
    <main className="space-y-4 p-8">
      <h2 className="text-2xl font-bold tracking-tight">Fosfaat</h2>
      <Suspense
        key={`${loaderData.organization.id},${location.search}`}
        fallback={<NitrogenBalanceFallback />}
      >
        <OrganizationBalancePhosphateOverview {...loaderData} />
      </Suspense>
    </main>
  )
}

/** Page content with the deferred data (separate component for the `use(...)` hook). */
function OrganizationBalancePhosphateOverview(loaderData: LoaderData) {
  const params = useParams()

  if (loaderData.noFarms) {
    return (
      <div className="lg:mt-20">
        <NoFarmsMessage
          action={{ label: "Naar dashboard", to: `/organization/${loaderData.organization.slug}` }}
        />
      </div>
    )
  }

  const asyncData = use(loaderData.asyncData)
  const { combinedResult, farmResults } = asyncData
  const hasErrors = farmResults.some((r) => r.phosphateBalanceResult.hasErrors)
  const orgShare = getShareOnTrack(combinedResult.fields)

  const createFarmRow = ({ farm, totalArea, phosphateBalanceResult }: FarmResult) => {
    const href = `/farm/${farm.b_id_farm}/${params.calendar}/balance/phosphate`
    const share = getShareOnTrack(phosphateBalanceResult.fields)
    const delta = phosphateBalanceResult.errorMessage
      ? undefined
      : phosphateBalanceResult.balance - combinedResult.balance
    return (
      <div className="flex grow items-center" key={farm.b_id_farm}>
        <ShareOnTrackIcon share={phosphateBalanceResult.errorMessage ? null : share} />
        <div className="ml-4 space-y-1">
          <NavLink to={href}>
            <p className="text-sm leading-none font-medium hover:underline">
              {farm.b_name_farm ?? "Onbekend bedrijf"}
            </p>
          </NavLink>
          <p className="text-muted-foreground text-sm">
            {formatNumberNl(totalArea, 1)} ha
            {share !== null ? ` · ${formatNumberNl(share)} % van de oppervlakte op koers` : ""}
          </p>
        </div>
        <div className="ml-auto text-right font-medium">
          {phosphateBalanceResult.errorMessage ? (
            <NavLink to={href}>
              <p className="text-end text-sm text-orange-500 hover:underline">
                {phosphateBalanceResult.errorMessage === "No fields in input"
                  ? "Geen percelen"
                  : "Bekijk foutmelding"}
              </p>
            </NavLink>
          ) : (
            <>
              <span>{formatNumberNl(phosphateBalanceResult.balance)}</span>
              {delta !== undefined ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground block cursor-default text-xs">
                      {delta >= 0 ? "+" : ""}
                      {formatNumberNl(delta, 1)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {`Verschil t.o.v. het organisatiegemiddelde (${formatNumberNl(combinedResult.balance, 1)} ${PHOSPHATE_UNIT})`}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {/* Left: the farms, judged on the PSD of their fields (the main indicator) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <p className="grow">Bedrijven</p>
            {hasErrors ? (
              <Tooltip>
                <TooltipTrigger>
                  <CircleAlert className="h-6 w-6 rounded-full bg-orange-100 text-orange-500" />
                </TooltipTrigger>
                <TooltipContent>Niet alle bedrijven konden worden berekend</TooltipContent>
              </Tooltip>
            ) : null}
            <GroupPicker groups={loaderData.farmGroups} />
            <FarmSelectDialog farms={asyncData.farms} defaultSelectedFarmIds={asyncData.farmIds} />
            <BufferStripInfo />
          </CardTitle>
          <CardDescription>
            ✓ als minstens de helft van de oppervlakte (met bekende fosfaatverzadiging) op koers
            ligt: de PSD ligt bij het gemiddelde saldo van de afgelopen jaren over 20 jaar onder de
            grens.
            {orgShare !== null
              ? ` Alle geselecteerde bedrijven samen: ${formatNumberNl(orgShare)} % op koers.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">{farmResults.map(createFarmRow)}</div>
        </CardContent>
      </Card>
      {/* Right: the balance */}
      <PhosphateBalanceCard
        description="De gemiddelde fosfaatbalans per hectare van de geselecteerde bedrijven: aanvoer met bemesting, mineralisatie en depositie min afvoer met oogst en gewasresten."
        year={params.calendar ?? ""}
        balance={combinedResult.balance}
        supply={combinedResult.supply}
        removal={combinedResult.removal}
        leaching={combinedResult.leaching}
        longTerm={{ balance: combinedResult.long_term_balance }}
      >
        <PhosphateBalanceChart type="farm" balance={combinedResult} />
      </PhosphateBalanceCard>
    </div>
  )
}
