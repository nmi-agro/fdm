import type { CurrentSoilData, SoilParameterDescription } from "@nmi-agro/fdm-core"
import { format } from "date-fns/format"
import { nl } from "date-fns/locale/nl"
import {
  Calculator,
  Calendar,
  ExternalLink,
  Layers,
  Microscope,
  Pencil,
  Sparkles,
  TriangleAlert,
  User,
} from "lucide-react"
import { NavLink } from "react-router"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"
import { SOIL_PARAMETER_GROUPS } from "./parameter-groups"

// The same groups and order as the soil analysis form, without the sampling details
const SOIL_GROUPS = SOIL_PARAMETER_GROUPS.filter((group) => group.id !== "sampling")

/** Classes for the small metadata lines at the bottom of a soil data card. */
const META_LINE = "text-muted-foreground flex items-center gap-1.5 text-xs"

/** Classes for the focus ring of the small interactive elements on a soil data card. */
const FOCUS_RING = "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"

function SoilDataCard({
  title,
  description,
  value,
  label,
  unit,
  type,
  link,
  date,
  source,
  sourceLabel,
  canModify,
  zones,
  coverage,
  hasCoverageWarning,
  onShowZones,
}: {
  title: string
  description: string
  value: number | string | null
  label: string | undefined
  unit: string
  type: "numeric" | "enum"
  link: string
  date: Date | null
  source: string | null
  sourceLabel: string
  canModify: boolean
  zones: SoilDataCardZone[]
  coverage: number | null
  hasCoverageWarning: boolean
  /**
   * Highlights the given analyses on the map of the page (an empty list clears the highlight).
   * Without it, the coverage warning links to the newest analysis instead.
   */
  onShowZones?: (a_ids: string[], options?: { scroll?: boolean }) => void
}) {
  const isAggregated = zones.length > 1
  const oldestDate = isAggregated ? zones[zones.length - 1].date : null
  const isEditable = canModify && source !== "calculated"
  const EditIcon = isEditable ? Pencil : ExternalLink
  const coveragePercentage = coverage !== null ? Math.round(coverage * 100) : null
  const showCoverage = hasCoverageWarning && coveragePercentage !== null
  const zoneIds = zones.map((zone) => zone.a_id)
  const zoneHighlightHandlers = onShowZones
    ? {
        onMouseEnter: () => onShowZones(zoneIds),
        onMouseLeave: () => onShowZones([]),
        onFocus: () => onShowZones(zoneIds),
        onBlur: () => onShowZones([]),
      }
    : {}

  const coverageClassName = cn(
    "inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 pointer-coarse:px-3 pointer-coarse:py-2",
    FOCUS_RING,
  )
  const coverageContent = (
    <>
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
      <span>{coveragePercentage}% van perceel</span>
    </>
  )
  const coverageLabel = `${title} is gebaseerd op bemonsterde zones die ${coveragePercentage}% van het perceel dekken.`

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2 max-sm:p-4 max-sm:pb-2">
        <CardTitle className="min-h-[2lh] min-w-0 text-sm leading-snug font-semibold">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                className={cn(
                  "decoration-muted-foreground/40 hover:decoration-muted-foreground line-clamp-2 cursor-help rounded-sm text-left underline decoration-dotted underline-offset-4 transition-colors",
                  FOCUS_RING,
                )}
              >
                {title}
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px]">{description}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        {source !== "nl-other-nmi" ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <NavLink
                    to={link}
                    aria-label={`${isEditable ? "Bewerk" : "Bekijk"} de analyse van ${title}`}
                    className={cn(
                      "text-muted-foreground hover:text-foreground hover:bg-accent -m-1 flex size-6 shrink-0 items-center justify-center rounded-md transition-colors pointer-coarse:-m-2.5 pointer-coarse:size-10",
                      FOCUS_RING,
                    )}
                  >
                    <EditIcon className="size-3.5" aria-hidden />
                  </NavLink>
                }
              />
              <TooltipContent>{isEditable ? "Bewerken" : "Bekijken"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 pt-0 max-sm:px-4 max-sm:pb-4">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          {value === null ? (
            <div className="text-muted-foreground text-xl leading-tight font-semibold">
              Onbekend
            </div>
          ) : type === "enum" ? (
            <div className="text-xl leading-tight font-bold">{label ?? value}</div>
          ) : (
            <>
              <div className="text-2xl font-bold tracking-tight tabular-nums">
                {typeof value === "number" ? Math.round(value * 10) / 10 : value}
              </div>
              <div className="text-muted-foreground text-xs font-medium">{unit}</div>
            </>
          )}
        </div>

        {showCoverage && (
          <TooltipProvider>
            <Tooltip>
              {onShowZones ? (
                <TooltipTrigger
                  type="button"
                  className={coverageClassName}
                  aria-label={`${coverageLabel} Toon de zones op de kaart.`}
                  {...zoneHighlightHandlers}
                  onClick={() => onShowZones(zoneIds, { scroll: true })}
                >
                  {coverageContent}
                </TooltipTrigger>
              ) : (
                <TooltipTrigger
                  render={
                    <NavLink
                      to={link}
                      className={coverageClassName}
                      aria-label={`${coverageLabel} Bekijk de bemonstering.`}
                    >
                      {coverageContent}
                    </NavLink>
                  }
                />
              )}
              <TooltipContent side="bottom" className="max-w-[260px]">
                De bemonsterde zones dekken {coveragePercentage}% van het perceel. De waarde geldt
                alleen voor het bemonsterde deel.{" "}
                {onShowZones
                  ? "De zones zijn gemarkeerd op de kaart."
                  : "Klik om de bemonstering te bekijken."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <div className="border-border/60 mt-auto flex flex-col gap-1.5 border-t pt-2">
          {source && (
            <div className={META_LINE}>
              {source === "calculated" ? (
                <Calculator className="size-3.5 shrink-0" aria-hidden />
              ) : source === "nl-other-nmi" ? (
                <Sparkles className="size-3.5 shrink-0" aria-hidden />
              ) : source === "other" ? (
                <User className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <Microscope className="size-3.5 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 truncate" title={sourceLabel}>
                <span className="sr-only">
                  {source === "calculated"
                    ? ""
                    : source === "nl-other-nmi"
                      ? "Geschat met "
                      : source === "other"
                        ? "Bron: "
                        : "Gemeten door "}
                </span>
                {sourceLabel}
              </span>
            </div>
          )}

          {!(!date || source === "nl-other-nmi") && (
            <div className={META_LINE}>
              <Calendar className="size-3.5 shrink-0" aria-hidden />
              <span>
                <span className="sr-only">Bemonsterd op </span>
                {oldestDate && oldestDate.getTime() !== date.getTime()
                  ? `${format(oldestDate, "P", { locale: nl })} – ${format(date, "P", { locale: nl })}`
                  : format(date, "P", { locale: nl })}
              </span>
            </div>
          )}

          {isAggregated && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  className={cn(META_LINE, "cursor-help rounded-sm text-left", FOCUS_RING)}
                  {...zoneHighlightHandlers}
                >
                  <Layers className="size-3.5 shrink-0" aria-hidden />
                  <span className="underline decoration-dotted underline-offset-4">
                    Gemiddelde van {zones.length} zones
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px]">
                  <p className="mb-1">
                    {type === "enum"
                      ? "Waarde met het grootste oppervlak over de bemonsterde zones:"
                      : "Naar oppervlak gewogen gemiddelde van de bemonsterde zones:"}
                  </p>
                  <ul className="space-y-0.5">
                    {zones.map((zone, index) => (
                      <li key={`${zone.a_id}-${index}`}>
                        {zone.date ? format(zone.date, "P", { locale: nl }) : "Onbekende datum"}:{" "}
                        {typeof zone.value === "number"
                          ? `${Math.round(zone.value * 10) / 10} ${unit}`
                          : (zone.label ?? zone.value ?? "Onbekend")}{" "}
                        ({Math.round(zone.area_fraction * 100)}%)
                      </li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * The current soil data of a field as cards, grouped by topic. Each card shows the most recent value
 * of a parameter with its source and sampling date. When a value combines several sampling zones,
 * or the sampled zones cover only part of the field, the card says so.
 *
 * Pass `onShowZones` when the page also shows the soil analyses map, so that the coverage warning
 * highlights the contributing zones there instead of linking away.
 */
export function SoilDataCards({
  currentSoilData,
  soilParameterDescription,
  canModifyAllSoilAnalyses = false,
  canModifySoilAnalysis = {},
  onShowZones,
}: {
  currentSoilData: CurrentSoilData
  soilParameterDescription: SoilParameterDescription
  canModifyAllSoilAnalyses?: boolean
  canModifySoilAnalysis?: Record<string, boolean>
  onShowZones?: (a_ids: string[], options?: { scroll?: boolean }) => void
}) {
  const cards = constructSoilDataCards(currentSoilData, soilParameterDescription)

  return (
    <div className="space-y-10">
      {SOIL_GROUPS.map((group) => {
        const groupCards = cards
          .filter((card) => group.parameters.includes(card.parameter))
          .sort(
            (a, b) => group.parameters.indexOf(a.parameter) - group.parameters.indexOf(b.parameter),
          )

        if (groupCards.length === 0) return null

        const headingId = `soil-group-${group.id}`
        return (
          <section key={group.id} className="space-y-4" aria-labelledby={headingId}>
            <div className="flex items-center gap-4">
              <h4
                id={headingId}
                className="text-muted-foreground text-xs font-bold tracking-[0.1em] whitespace-nowrap uppercase"
              >
                {group.title}
              </h4>
              <Separator className="flex-1 opacity-40" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] gap-3 sm:gap-4">
              {groupCards.map((card) => {
                const sourceParam = soilParameterDescription.find((x) => x.parameter === "a_source")
                const sourceOption = sourceParam?.options?.find((x) => x.value === card.source)
                const sourceLabel =
                  card.source === "calculated"
                    ? "Berekend"
                    : sourceOption?.label || card.source || "Onbekend"

                return (
                  <SoilDataCard
                    key={card.parameter}
                    title={card.title}
                    description={card.description}
                    value={card.value}
                    label={card.label}
                    unit={card.unit}
                    type={card.type}
                    link={card.link}
                    date={card.date}
                    source={card.source}
                    sourceLabel={sourceLabel}
                    canModify={canModifyAllSoilAnalyses || canModifySoilAnalysis[card.a_id]}
                    zones={card.zones}
                    coverage={card.coverage}
                    hasCoverageWarning={card.has_coverage_warning}
                    onShowZones={onShowZones}
                  />
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/**
 * A soil analysis that contributes to the value on a soil data card.
 */
export interface SoilDataCardZone {
  a_id: string
  date: Date | null
  value: number | string | null
  /** Option label for enum parameters. */
  label: string | undefined
  /** Share of the area with a value (0–1). */
  area_fraction: number
}

/**
 * Builds the soil data cards from the current soil data.
 *
 * The date, source and link of a card refer to the newest contributing analysis. When the value
 * combines several sampling zones, `zones` lists every contributing analysis.
 */
export function constructSoilDataCards(
  currentSoilData: CurrentSoilData,
  soilParameterDescription: SoilParameterDescription,
) {
  // Construct the soil data cards
  const cardValues = currentSoilData.map((item) => {
    const description = soilParameterDescription.find((x: { parameter: string }) => {
      return x.parameter === item.parameter
    })

    if (!description) {
      console.warn(`No description found for parameter: ${item.parameter}`)
      return null
    }

    if (description.type !== "numeric" && description.type !== "enum") {
      return null
    }

    let label: string | undefined
    if (description.type === "enum") {
      label = description.options?.find(
        (option: { value: string }) => option.value === item.value,
      )?.label
    }

    const newest = item.sources[0]
    const zones: SoilDataCardZone[] = item.sources.map((source) => ({
      a_id: source.a_id,
      date: source.b_sampling_date,
      value: source.value,
      label:
        description.type === "enum"
          ? description.options?.find((option: { value: string }) => option.value === source.value)
              ?.label
          : undefined,
      area_fraction: source.area_fraction,
    }))

    return {
      parameter: item.parameter,
      title: description.name,
      description: description.description,
      value: item.value,
      label: label,
      unit: description.unit,
      type: description.type,
      a_id: newest.a_id,
      link: `./analysis/${newest.a_id}`,
      date: newest.b_sampling_date,
      source: newest.a_source,
      zones,
      coverage: item.coverage,
      has_coverage_warning: item.has_coverage_warning,
    }
  })
  return cardValues.filter((x) => x !== null)
}
