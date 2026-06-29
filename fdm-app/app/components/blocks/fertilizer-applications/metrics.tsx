import type {
  Dose,
  GebruiksnormResult,
  NitrogenBalanceFieldResultNumeric,
  NormFilling,
  NutrientAdvice,
} from "@nmi-agro/fdm-calculator"
import type { Cultivation } from "@nmi-agro/fdm-core"
import { CircleAlert, CircleCheck, CircleX, Sprout } from "lucide-react"
import { Suspense } from "react"
import { Await, NavLink } from "react-router"
import { MissingParametersWarning } from "~/components/blocks/balance/missing-parameters-warning"
import { CultivationSelector } from "~/components/custom/cultivation-selector"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "~/components/ui/item"
import { Progress } from "~/components/ui/progress"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"

export type MetricsResult<T> = { status: "ok"; data: T } | { status: "error"; message: string }
interface FertilizerApplicationMetricsData {
  norms: Promise<
    MetricsResult<{
      value: {
        manure: GebruiksnormResult
        phosphate: GebruiksnormResult
        nitrogen: GebruiksnormResult
      }
      filling: {
        manure: NormFilling
        phosphate: NormFilling
        nitrogen: NormFilling
      }
    } | null>
  >
  nitrogenBalance: Promise<MetricsResult<NitrogenBalanceFieldResultNumeric>>
  nutrientAdvice: NutrientAdvice
  dose: Dose
  b_id: string
  b_id_farm: string
  b_bufferstrip: boolean
  calendar: string
  cultivations: Cultivation[]
  activeCultivation: Cultivation | undefined
}

interface FertilizerApplicationMetricsCardProps {
  fertilizerApplicationMetricsData: FertilizerApplicationMetricsData
  isSubmitting: boolean
}

function MetricsErrorDisplay({ message }: { message: string }) {
  return message.match(/bufferstrook/) ? (
    <div className="text-muted-foreground text-sm">{message}</div>
  ) : message.match(/Missing required soil parameters/) ? (
    <MissingParametersWarning message={message} />
  ) : (
    <div className="text-destructive text-sm">Fout bij berekening</div>
  )
}

export function FertilizerApplicationMetricsCard({
  fertilizerApplicationMetricsData,
  isSubmitting,
}: FertilizerApplicationMetricsCardProps) {
  const getNormsProgressColor = (current: number, total: number) => {
    if (total === 0) return "gray-500"
    const percentage = (current / total) * 100
    if (percentage > 100) return "red-500"
    return "green-500"
  }

  const getAdviceProgressColor = (current: number, total: number) => {
    if (total === 0) return "gray-500"
    const percentage = (current / total) * 100
    if (percentage < 80) return "orange-500"
    if (percentage >= 80 && percentage <= 105) return "green-500"
    if (percentage > 105) return "orange-500"
    return "gray-500" // Default or error color
  }

  const {
    norms,
    nitrogenBalance,
    nutrientAdvice,
    dose,
    b_id,
    b_id_farm,
    calendar,
    cultivations,
    activeCultivation,
    b_bufferstrip,
  } = fertilizerApplicationMetricsData

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Bemestingsdashboard</CardTitle>
        <CardDescription>Krijg inzicht in de effecten van de bemesting.</CardDescription>
      </CardHeader>
      <CardContent>
        {!activeCultivation ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Sprout />
              </EmptyMedia>
              <EmptyTitle>Geen gewas gevonden</EmptyTitle>
              <EmptyDescription>
                Voeg eerst een gewas toe om het bemestingsdashboard te kunnen gebruiken.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <NavLink to={`/farm/${b_id_farm}/${calendar}/field/${b_id}/cultivation`}>
                  Gewas toevoegen
                </NavLink>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3">
            <ItemGroup className="min-w-0">
              <ItemSeparator />
              <Item className="flex-col items-stretch px-0 py-4">
                <ItemContent className="mb-4 flex-none">
                  <ItemTitle className="text-base font-semibold hover:underline">
                    <NavLink to={`/farm/${b_id_farm}/${calendar}/norms/${b_id}`}>
                      Gebruiksnormen
                    </NavLink>
                  </ItemTitle>
                </ItemContent>
                <ItemDescription className="line-clamp-none w-full min-w-0">
                  {isSubmitting ? (
                    <NormsSkeleton />
                  ) : (
                    <Suspense fallback={<NormsSkeleton />}>
                      <Await
                        resolve={norms}
                        errorElement={
                          <div className="text-destructive text-sm">Fout bij berekening</div>
                        }
                      >
                        {(result) => {
                          if (result.status === "error") {
                            return <MetricsErrorDisplay message={result.message} />
                          }

                          const resolvedNorms = result.data

                          if (!resolvedNorms) {
                            return (
                              <span className="text-xs">
                                Geen gebruiksnormen beschikbaar voor dit jaar.
                              </span>
                            )
                          }

                          return (
                            <div className="flex min-w-0 flex-col space-y-4">
                              <div className="min-w-0 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className="text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase">
                                        Stikstof
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Werkzame stikstof volgens forfaitaire gehalten</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className="shrink-0 text-right text-xs font-bold whitespace-nowrap">
                                    {Math.round(resolvedNorms.filling.nitrogen.normFilling)} /{" "}
                                    {Math.round(resolvedNorms.value.nitrogen.normValue)} kg N
                                  </span>
                                </div>
                                <Progress
                                  value={
                                    resolvedNorms.value.nitrogen.normValue === 0
                                      ? 0
                                      : (resolvedNorms.filling.nitrogen.normFilling /
                                          resolvedNorms.value.nitrogen.normValue) *
                                        100
                                  }
                                  colorBar={getNormsProgressColor(
                                    resolvedNorms.filling.nitrogen.normFilling,
                                    resolvedNorms.value.nitrogen.normValue,
                                  )}
                                  className="h-2"
                                />
                              </div>

                              <div className="min-w-0 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className="text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase">
                                        Fosfaat
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Fosfaataanvoer incl. mogelijke stimuleringsregeling</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className="shrink-0 text-right text-xs font-bold whitespace-nowrap">
                                    {Math.round(resolvedNorms.filling.phosphate.normFilling)} /{" "}
                                    {Math.round(resolvedNorms.value.phosphate.normValue)} kg P₂O₅
                                  </span>
                                </div>
                                <Progress
                                  value={
                                    resolvedNorms.value.phosphate.normValue === 0
                                      ? 0
                                      : (resolvedNorms.filling.phosphate.normFilling /
                                          resolvedNorms.value.phosphate.normValue) *
                                        100
                                  }
                                  colorBar={getNormsProgressColor(
                                    resolvedNorms.filling.phosphate.normFilling,
                                    resolvedNorms.value.phosphate.normValue,
                                  )}
                                  className="h-2"
                                />
                              </div>

                              <div className="min-w-0 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className="text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase">
                                        Dierlijk
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Totaal stikstof via dierlijke mest</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className="shrink-0 text-right text-xs font-bold whitespace-nowrap">
                                    {Math.round(resolvedNorms.filling.manure.normFilling)} /{" "}
                                    {Math.round(resolvedNorms.value.manure.normValue)} kg N
                                  </span>
                                </div>
                                <Progress
                                  value={
                                    resolvedNorms.value.manure.normValue === 0
                                      ? 0
                                      : (resolvedNorms.filling.manure.normFilling /
                                          resolvedNorms.value.manure.normValue) *
                                        100
                                  }
                                  colorBar={getNormsProgressColor(
                                    resolvedNorms.filling.manure.normFilling,
                                    resolvedNorms.value.manure.normValue,
                                  )}
                                  className="h-2"
                                />
                              </div>
                            </div>
                          )
                        }}
                      </Await>
                    </Suspense>
                  )}
                </ItemDescription>
              </Item>
            </ItemGroup>
            <ItemGroup className="min-w-0">
              <ItemSeparator />
              <Item className="flex-col items-stretch px-0 py-4">
                <ItemContent className="mb-4 flex-none">
                  <ItemTitle className="text-base font-semibold hover:underline">
                    <NavLink to={`/farm/${b_id_farm}/${calendar}/balance/nitrogen/${b_id}`}>
                      Stikstofbalans
                    </NavLink>
                  </ItemTitle>
                </ItemContent>
                <ItemDescription className="line-clamp-none w-full min-w-0">
                  {isSubmitting ? (
                    <NitrogenBalanceSkeleton />
                  ) : (
                    <Suspense fallback={<NitrogenBalanceSkeleton />}>
                      <Await
                        errorElement={
                          <div className="text-destructive text-sm">Fout bij berekening</div>
                        }
                        resolve={nitrogenBalance}
                      >
                        {(result) => {
                          if (result.status === "error") {
                            return <MetricsErrorDisplay message={result.message} />
                          }

                          const resolvedNitrogenBalance = result.data

                          if (b_bufferstrip) {
                            return (
                              <span className="text-muted-foreground text-xs">
                                Geen stikstofbalans beschikbaar voor bufferstrook.
                              </span>
                            )
                          }

                          if (!resolvedNitrogenBalance?.balance) {
                            return (
                              <div className="flex items-center gap-2 text-orange-500">
                                <CircleAlert className="size-4 shrink-0" />
                                <span className="text-xs">Geen balans beschikbaar</span>
                              </div>
                            )
                          }

                          const balance = resolvedNitrogenBalance.balance
                          return (
                            <div className="flex min-w-0 flex-col space-y-1.5">
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <p className="text-muted-foreground truncate text-xs">Aanvoer</p>
                                <span className="shrink-0 text-right text-xs font-medium whitespace-nowrap">
                                  {Math.round(balance.supply?.total ?? 0)} kg N
                                </span>
                              </div>
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <p className="text-muted-foreground truncate text-xs">Afvoer</p>
                                <span className="shrink-0 text-right text-xs font-medium whitespace-nowrap">
                                  {Math.round(balance.removal?.total ?? 0)} kg N
                                </span>
                              </div>
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <p className="text-muted-foreground truncate text-xs">Emissie</p>
                                <span className="shrink-0 text-right text-xs font-medium whitespace-nowrap">
                                  {Math.round(balance.emission?.total ?? 0)} kg N
                                </span>
                              </div>
                              <ItemSeparator className="my-1 opacity-50" />
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <p className="text-muted-foreground truncate text-sm font-bold tracking-tight uppercase">
                                  Balans
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <span className="shrink-0 text-right text-base font-black whitespace-nowrap">
                                    {Math.round(balance.balance)} kg N
                                  </span>
                                  {balance.balance <= balance.target ? (
                                    <CircleCheck className="size-4 shrink-0 text-green-500" />
                                  ) : (
                                    <CircleX className="size-4 shrink-0 text-red-500" />
                                  )}
                                </div>
                              </div>
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <p className="text-muted-foreground truncate text-[10px]">
                                  Streefwaarde
                                </p>
                                <span className="shrink-0 text-right text-[10px] font-medium whitespace-nowrap">
                                  {Math.round(balance.target)} kg N
                                </span>
                              </div>
                            </div>
                          )
                        }}
                      </Await>
                    </Suspense>
                  )}
                </ItemDescription>
              </Item>
            </ItemGroup>
            <ItemGroup className="min-w-0">
              <ItemSeparator />
              <Item className="flex-col items-stretch px-0 py-4">
                <ItemContent className="mb-4 flex-none">
                  <div className="flex w-full items-center justify-between gap-2">
                    <ItemTitle className="text-base font-semibold hover:underline">
                      <NavLink to={`/farm/${b_id_farm}/${calendar}/nutrient_advice/${b_id}`}>
                        Bemestingsadvies
                      </NavLink>
                    </ItemTitle>
                    <div className="shrink-0">
                      <CultivationSelector
                        cultivations={cultivations}
                        selectedCultivationId={activeCultivation.b_lu}
                        variant="icon"
                      />
                    </div>
                  </div>
                </ItemContent>
                <ItemDescription className="line-clamp-none w-full min-w-0">
                  {isSubmitting ? (
                    <NutrientAdviceSkeleton />
                  ) : (
                    <Suspense fallback={<NutrientAdviceSkeleton />}>
                      <Await
                        errorElement={
                          <div className="text-destructive text-sm">Fout bij berekening</div>
                        }
                        resolve={nutrientAdvice}
                      >
                        {(resolvedNutrientAdvice) => {
                          if (!resolvedNutrientAdvice) {
                            return <span className="text-xs">Geen advies beschikbaar</span>
                          }
                          return (
                            <div className="flex min-w-0 flex-col space-y-4">
                              <div className="min-w-0 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className="text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase">
                                        Stikstof
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Werkzame stikstof</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className="shrink-0 text-right text-xs font-bold whitespace-nowrap">
                                    {Math.round(dose.p_dose_n)} /{" "}
                                    {Math.round(resolvedNutrientAdvice.d_n_req)} kg N
                                  </span>
                                </div>
                                <Progress
                                  key={`n-${dose.p_dose_n}`}
                                  value={
                                    resolvedNutrientAdvice.d_n_req === 0
                                      ? 0
                                      : (dose.p_dose_n / resolvedNutrientAdvice.d_n_req) * 100
                                  }
                                  colorBar={getAdviceProgressColor(
                                    dose.p_dose_n,
                                    resolvedNutrientAdvice.d_n_req,
                                  )}
                                  className="h-2"
                                />
                              </div>

                              <div className="min-w-0 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase">
                                    Fosfaat
                                  </p>
                                  <span className="shrink-0 text-right text-xs font-bold whitespace-nowrap">
                                    {Math.round(dose.p_dose_p)} /{" "}
                                    {Math.round(resolvedNutrientAdvice.d_p_req)} kg P₂O₅
                                  </span>
                                </div>
                                <Progress
                                  key={`p-${dose.p_dose_p}`}
                                  value={
                                    resolvedNutrientAdvice.d_p_req === 0
                                      ? 0
                                      : (dose.p_dose_p / resolvedNutrientAdvice.d_p_req) * 100
                                  }
                                  colorBar={getAdviceProgressColor(
                                    dose.p_dose_p,
                                    resolvedNutrientAdvice.d_p_req,
                                  )}
                                  className="h-2"
                                />
                              </div>

                              <div className="min-w-0 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase">
                                    Kalium
                                  </p>
                                  <span className="shrink-0 text-right text-xs font-bold whitespace-nowrap">
                                    {Math.round(dose.p_dose_k)} /{" "}
                                    {Math.round(resolvedNutrientAdvice.d_k_req)} kg K₂O
                                  </span>
                                </div>
                                <Progress
                                  key={`k-${dose.p_dose_k}`}
                                  value={
                                    resolvedNutrientAdvice.d_k_req === 0
                                      ? 0
                                      : (dose.p_dose_k / resolvedNutrientAdvice.d_k_req) * 100
                                  }
                                  colorBar={getAdviceProgressColor(
                                    dose.p_dose_k,
                                    resolvedNutrientAdvice.d_k_req,
                                  )}
                                  className="h-2"
                                />
                              </div>
                            </div>
                          )
                        }}
                      </Await>
                    </Suspense>
                  )}
                </ItemDescription>
              </Item>
            </ItemGroup>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const NormsSkeleton = () => (
  <div className="flex flex-col space-y-4">
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          Stikstof
        </p>
        <span className="text-right text-xs font-bold whitespace-nowrap">
          {<Spinner className="h-3" />} kg N
        </span>
      </div>
      <Skeleton className="h-2 w-full" />
    </div>

    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          Fosfaat
        </p>
        <span className="text-right text-xs font-bold whitespace-nowrap">
          {<Spinner className="h-3" />} kg P₂O₅
        </span>
      </div>
      <Skeleton className="h-2 w-full" />
    </div>

    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          Dierlijk
        </p>
        <span className="text-right text-xs font-bold whitespace-nowrap">
          {<Spinner className="h-3" />} kg N
        </span>
      </div>
      <Skeleton className="h-2 w-full" />
    </div>
  </div>
)
const NitrogenBalanceSkeleton = () => (
  <div className="flex min-w-0 flex-col space-y-1.5">
    <div className="flex min-w-0 items-center justify-between gap-2">
      <p className="text-muted-foreground truncate text-xs">Aanvoer</p>
      <span className="shrink-0 text-right text-xs font-medium whitespace-nowrap">
        <Spinner className="h-3" /> kg N
      </span>
    </div>
    <div className="flex min-w-0 items-center justify-between gap-2">
      <p className="text-muted-foreground truncate text-xs">Afvoer</p>
      <span className="shrink-0 text-right text-xs font-medium whitespace-nowrap">
        <Spinner className="h-3" /> kg N
      </span>
    </div>
    <div className="flex min-w-0 items-center justify-between gap-2">
      <p className="text-muted-foreground truncate text-xs">Emissie</p>
      <span className="shrink-0 text-right text-xs font-medium whitespace-nowrap">
        <Spinner className="h-3" /> kg N
      </span>
    </div>
    <ItemSeparator className="my-1 opacity-50" />
    <div className="flex min-w-0 items-center justify-between gap-2">
      <p className="text-primary truncate text-sm font-bold tracking-tight uppercase">Balans</p>
      <span className="shrink-0 text-right text-base font-black whitespace-nowrap">
        <Spinner className="h-4" /> kg N
      </span>
    </div>
    <div className="flex min-w-0 items-center justify-between gap-2">
      <p className="text-muted-foreground truncate text-[10px]">Streefwaarde</p>
      <span className="shrink-0 text-right text-[10px] font-medium whitespace-nowrap">
        <Spinner className="h-3" /> kg N
      </span>
    </div>
  </div>
)

const NutrientAdviceSkeleton = () => (
  <div className="flex flex-col space-y-4">
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          Stikstof
        </p>
        <span className="text-right text-xs font-bold whitespace-nowrap">
          {<Spinner className="h-3" />} kg N
        </span>
      </div>
      <Skeleton className="h-2 w-full" />
    </div>
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          Fosfaat
        </p>
        <span className="text-right text-xs font-bold whitespace-nowrap">
          {<Spinner className="h-4" />} kg P₂O₅
        </span>
      </div>
      <Skeleton className="h-2 w-full" />
    </div>

    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          Kalium
        </p>
        <span className="text-right text-xs font-bold whitespace-nowrap">
          {<Spinner className="h-4" />}
          kg K₂O
        </span>
      </div>
      <Skeleton className="h-2 w-full" />
    </div>
  </div>
)
