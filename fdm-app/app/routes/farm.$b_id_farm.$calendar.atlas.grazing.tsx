import type { FeatureCollection, Geometry } from "geojson"
import type { MapGeoJSONFeature } from "maplibre-gl"
import {
  checkPermission,
  getCultivationsForFarm,
  getFields,
  getGrazingCalendarForFarm,
  getHarvestsForFarm,
} from "@nmi-agro/fdm-core"
import { simplify } from "@turf/simplify"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Layer, type LayerProps, Source } from "react-map-gl/maplibre"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
  useNavigate,
} from "react-router"
import type { HelpHandle } from "~/lib/manual/help-targets"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import {
  countGrazingStatuses,
  GRAZING_MAP_COPY,
  GRAZING_STATUS,
  GRAZING_ZONE_FILL_STYLE,
  GRAZING_GRAZED_OUTLINE_STYLE,
  GRAZING_ZONE_CASING_STYLE,
  GRAZING_ZONE_LINE_STYLE,
  getGrazingFillStyle,
} from "~/components/blocks/atlas/atlas-grazing"
import { GrazingLegend, GrazingStatusSwatch } from "~/components/blocks/atlas/atlas-legend"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import { getDottedFieldOutlineStyle } from "~/components/blocks/atlas/atlas-styles"
import {
  AtlasTooltip,
  AtlasTooltipContent,
  AtlasTooltipFooter,
  AtlasTooltipHeader,
} from "~/components/blocks/atlas/atlas-tooltip"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { FieldPickerButton } from "~/components/blocks/grazing/field-picker-button"
import { GrazingPopover } from "~/components/blocks/grazing/grazing-popover"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Button, buttonVariants } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { useAnalytics } from "~/hooks/use-analytics"
import { useKeyedState } from "~/hooks/use-keyed-state"
import { useToday } from "~/hooks/use-today"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { fetchGrazingCalendarMatrix } from "~/lib/grazing-calendar.server"
import { handleGrazingEvent } from "~/lib/grazing-events.server"
import {
  clampToYear,
  defaultMapDay,
  type FieldGrazingState,
  getFieldGrazingState,
  type GrazingMapGrazing,
  type GrazingMapHarvest,
  grazingEndDay,
  shiftDay,
} from "~/lib/grazing-map"

export const handle: HelpHandle = { help: "beweiding-vandaag" }

export const meta: MetaFunction = () => {
  return [
    { title: `Beweiding - Atlas | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Bekijk per dag welke percelen worden beweid, gemaaid of rusten, en leg vast waar je koeien lopen.",
    },
  ]
}

/** A calendar date as `YYYY-MM-DD`, as the grazing and harvest dates are stored (UTC midnight). */
function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Loads the fields of the farm with their grazings and harvests in the selected year, and what the
 * grazing dialog needs (herds and grassland fields).
 *
 * @returns Field geometries, grazings and harvests per field, herds and the write permission.
 * @throws {Response} When loading fails.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm || b_id_farm === "undefined") {
      throw data("Farm ID is required", { status: 400 })
    }
    const session = await getSession(request)
    const calendar = getCalendar(params)
    const calendarYear = Number.parseInt(calendar, 10) || new Date().getFullYear()
    const timeframe = getTimeframe(params)

    const [fields, cultivationsByField, harvestsByCultivation, grazings, matrix] =
      await Promise.all([
        getFields(fdm, session.principal_id, b_id_farm, timeframe),
        getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
        getHarvestsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
        getGrazingCalendarForFarm(fdm, session.principal_id, b_id_farm, timeframe),
        fetchGrazingCalendarMatrix(session.principal_id, b_id_farm, calendarYear),
      ])

    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      new URL(request.url).pathname,
      false,
    )

    const fieldsData: FeatureCollection = {
      type: "FeatureCollection",
      features: fields.map((field) => {
        const cultivations = cultivationsByField.get(field.b_id) ?? []
        return {
          type: "Feature" as const,
          properties: {
            b_id: field.b_id,
            b_name: field.b_name,
            b_area: Math.round((field.b_area ?? 0) * 10) / 10,
            isGrassland: cultivations.some((c) => c.b_lu_croprotation === "grass"),
            isBufferstrip: Boolean(field.b_bufferstrip),
          },
          geometry: simplify(field.b_geometry as Geometry, {
            tolerance: 0.00001,
            highQuality: true,
          }),
        }
      }),
    }

    const harvestsByField: Record<string, GrazingMapHarvest[]> = {}
    for (const field of fields) {
      harvestsByField[field.b_id] = (cultivationsByField.get(field.b_id) ?? []).flatMap((c) =>
        (harvestsByCultivation.get(c.b_lu) ?? []).flatMap((h) =>
          h.b_lu_harvest_date
            ? [
                {
                  harvestDate: toIsoDate(new Date(h.b_lu_harvest_date)),
                  yield: h.harvestable?.harvestable_analyses?.[0]?.b_lu_yield ?? null,
                },
              ]
            : [],
        ),
      )
    }

    const mapGrazings: GrazingMapGrazing[] = grazings.map((g) => ({
      l_id_herd: g.l_id_herd,
      l_herd_name: g.l_herd_name ?? "Koppel",
      b_id: g.b_id ?? null,
      l_grazing_start: toIsoDate(new Date(g.l_grazing_start)),
      l_grazing_end: g.l_grazing_end ? toIsoDate(new Date(g.l_grazing_end)) : null,
      l_grazing_hours: g.l_grazing_hours ?? null,
      l_grazing_geometry_zone: g.l_grazing_geometry_zone ?? null,
    }))

    return {
      b_id_farm,
      calendar,
      calendarYear,
      fieldsData,
      grazings: mapGrazings,
      harvestsByField,
      herds: matrix.herds,
      grasslandFields: matrix.fields.map((f) => ({
        b_id: f.b_id,
        b_name: f.b_name,
        b_area: f.b_area,
      })),
      farmWritePermission,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/** Saves the grazing dialog, the same as on the grazing calendar. */
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)
    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      new URL(request.url).pathname,
      false,
    )
    if (!farmWritePermission) {
      throw data("U heeft geen schrijfrechten op dit bedrijf.", { status: 403 })
    }

    return await handleGrazingEvent(await request.formData(), {
      principal_id: session.principal_id,
      calendar: getCalendar(params),
    })
  } catch (error) {
    return handleActionError(error)
  }
}

/**
 * Atlas layer "Beweiding": colours every field by its use on the shown day (grazed, mown, resting
 * or not yet used in the selected year) and draws the grazed zones. Hovering a field shows the herd,
 * the hours or the rest; clicking a grassland field opens its grazing page. The panel picks the day
 * and records cows going out or coming in. Without a herd it explains how to activate the layer.
 */
export default function FarmAtlasGrazingBlock() {
  const { herds, b_id_farm, calendar } = useLoaderData<typeof loader>()
  if (herds.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-var(--app-header-height))] items-center justify-center p-6">
        <Card className="max-w-sm">
          <CardContent className="space-y-3">
            <p className="font-medium">{GRAZING_MAP_COPY.noHerdTitle}</p>
            <p className="text-muted-foreground text-sm">{GRAZING_MAP_COPY.noHerd}</p>
            <NavLink
              to={`/farm/${b_id_farm}/${calendar}/livestock`}
              className={buttonVariants({ size: "sm" })}
              data-slot="button"
            >
              {GRAZING_MAP_COPY.addHerd}
            </NavLink>
          </CardContent>
        </Card>
      </div>
    )
  }
  return <GrazingLayer />
}

function GrazingLayer() {
  const {
    b_id_farm,
    calendar,
    calendarYear,
    fieldsData,
    grazings,
    harvestsByField,
    herds,
    grasslandFields,
    farmWritePermission,
  } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const { capture } = useAnalytics()

  const fillLayerId = "fieldsGrazing"
  const outlineLayerId = "fieldsGrazingOutline"

  useEffect(() => {
    capture("atlas_viewed", { b_id_farm, calendar, layer: "grazing" })
  }, [b_id_farm, calendar, capture])

  // "Today" is only known on the client. The map opens on today's day and month in the selected
  // year; a day the user picks sticks until the year changes.
  const todayDate = useToday()
  const today = todayDate ? format(todayDate, "yyyy-MM-dd") : ""
  const defaultDay = today ? defaultMapDay(today, calendarYear) : ""
  const [day, setDay] = useKeyedState(defaultDay, (d) => d)
  const firstDay = `${calendarYear}-01-01`
  const lastDay = `${calendarYear}-12-31`
  const formatDay = (d: string) =>
    format(new Date(`${d}T12:00:00`), "EEEE d MMMM yyyy", { locale: nl })
  const dayLabel = day ? formatDay(day) : ""
  const isCurrentYear = today.startsWith(`${calendarYear}-`)

  // The grazing dialog for a field picked in the panel, on the day shown on the map; bumped on
  // every open so it starts fresh
  const [grazingField, setGrazingField] = useState<(typeof grasslandFields)[number] | null>(null)
  const [grazingSession, setGrazingSession] = useState(0)

  const herdCounts = useMemo(() => new Map(herds.map((h) => [h.l_id_herd, h.count ?? 0])), [herds])
  const grazingsByField = useMemo(() => {
    const map = new Map<string, GrazingMapGrazing[]>()
    for (const g of grazings) {
      if (!g.b_id) continue
      map.set(g.b_id, [...(map.get(g.b_id) ?? []), g])
    }
    return map
  }, [grazings])

  // Status per field on the shown day; empty until "today" is known on the client
  const states = useMemo(() => {
    const result = new Map<string, FieldGrazingState>()
    if (!day) return result
    for (const feature of fieldsData.features) {
      const b_id = feature.properties?.b_id as string
      result.set(
        b_id,
        getFieldGrazingState({
          grazings: grazingsByField.get(b_id) ?? [],
          harvests: harvestsByField[b_id] ?? [],
          day,
          today,
          calendarYear,
          isGrassland: Boolean(feature.properties?.isGrassland),
          isBufferstrip: Boolean(feature.properties?.isBufferstrip),
        }),
      )
    }
    return result
  }, [fieldsData, grazingsByField, harvestsByField, day, today, calendarYear])

  const shadedFields: FeatureCollection = useMemo(
    () => ({
      ...fieldsData,
      features: fieldsData.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          [GRAZING_STATUS]: states.get(feature.properties?.b_id as string)?.status ?? "unused",
        },
      })),
    }),
    [fieldsData, states],
  )
  const counts = useMemo(() => countGrazingStatuses(shadedFields), [shadedFields])

  // Zones grazed on the shown day, drawn on top of their field
  const zonesData: FeatureCollection = useMemo(
    () => ({
      type: "FeatureCollection",
      features: day
        ? grazings.flatMap((g) =>
            g.l_grazing_geometry_zone && day >= g.l_grazing_start && day <= grazingEndDay(g, today)
              ? [{ type: "Feature" as const, geometry: g.l_grazing_geometry_zone, properties: {} }]
              : [],
          )
        : [],
    }),
    [grazings, day, today],
  )

  const initialViewState = getViewState(fieldsData)
  const [showFields, setShowFields] = useState(true)
  const layerLayout = { visibility: showFields ? "visible" : "none" } as const
  const fillLayer = { ...getGrazingFillStyle(), layout: layerLayout } as LayerProps
  // White dotted outline around every field; keep its round caps and add the visibility toggle
  const outlineStyle = getDottedFieldOutlineStyle()
  const outlineLayer = {
    ...outlineStyle,
    layout: { ...outlineStyle.layout, ...layerLayout },
  } as LayerProps
  // Dark outline of the fields grazed on the shown day
  const grazedOutlineLayer = { ...GRAZING_GRAZED_OUTLINE_STYLE, layout: layerLayout } as LayerProps

  /** Opens the grazing page of a grassland field. */
  function onFieldClick(feature: MapGeoJSONFeature) {
    const b_id = feature.properties.b_id as string | undefined
    if (b_id && states.get(b_id)?.status !== "disabled") {
      void navigate(`/farm/${b_id_farm}/${calendar}/field/${b_id}/grazing`)
    }
  }

  const goToDay = (next: string) => setDay(clampToYear(next, calendarYear))

  return (
    <div className="relative">
      <Atlas
        initialViewState={initialViewState}
        interactive={true}
        interactiveLayerIds={[fillLayerId]}
      >
        <Controls
          showFlyToFields={fieldsData.features.length > 0}
          initialViewState={initialViewState}
          showFields={showFields}
          onToggleFields={() => setShowFields(!showFields)}
        />

        <MapTilerAttribution />

        <FieldsSourceNotClickable id={fillLayerId} fieldsData={shadedFields}>
          <Layer id={fillLayerId} {...fillLayer} />
          <Layer id={outlineLayerId} {...outlineLayer} />
          <Layer id="fieldsGrazingGrazedOutline" {...grazedOutlineLayer} />
        </FieldsSourceNotClickable>

        <Source id="grazingZones" type="geojson" data={zonesData}>
          <Layer id="grazingZonesFill" {...GRAZING_ZONE_FILL_STYLE} layout={layerLayout} />
          <Layer id="grazingZonesCasing" {...GRAZING_ZONE_CASING_STYLE} layout={layerLayout} />
          <Layer id="grazingZonesLine" {...GRAZING_ZONE_LINE_STYLE} layout={layerLayout} />
        </Source>

        <AtlasTooltip
          layers={[fillLayerId]}
          onFeatureClicked={onFieldClick}
          render={({ features, mode: tooltipMode }) => {
            if (features.length === 0) return null
            const feature = features[0]
            const state = states.get(feature.properties.b_id as string)
            if (!state) return null

            return (
              <>
                <AtlasTooltipHeader>
                  <p className="text-foreground font-semibold">{feature.properties.b_name}</p>
                  {feature.properties.b_area != null && (
                    <p className="text-muted-foreground mt-0.5">
                      {`${Number(feature.properties.b_area).toLocaleString("nl-NL")} ha`}
                    </p>
                  )}
                </AtlasTooltipHeader>
                <AtlasTooltipContent className="block">
                  <GrazingTooltipBody
                    state={state}
                    calendarYear={calendarYear}
                    isBufferstrip={Boolean(feature.properties.isBufferstrip)}
                    herdCounts={herdCounts}
                  />
                </AtlasTooltipContent>
                {state.status !== "disabled" && (
                  <AtlasTooltipFooter className="border-t pt-1.5">
                    {tooltipMode === "popup" ? (
                      <Button type="button" onClick={() => onFieldClick(feature)} className="grow">
                        {GRAZING_MAP_COPY.openField}
                      </Button>
                    ) : (
                      <p className="text-muted-foreground text-xs">{GRAZING_MAP_COPY.clickHint}</p>
                    )}
                  </AtlasTooltipFooter>
                )}
              </>
            )
          }}
        />
      </Atlas>

      {/* Day and quick entry (top left, like the selector of the other layers). On a phone it spans
          the width, leaving room for the map controls on the right. */}
      <Card className="absolute top-3 right-14 left-3 z-10 py-0 shadow-md md:right-auto md:w-72">
        <CardContent className="flex flex-col gap-2 p-2">
          <div className="flex items-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0 pointer-coarse:size-10"
              onClick={() => goToDay(shiftDay(day, -1))}
              disabled={!day || day <= firstDay}
              aria-label={GRAZING_MAP_COPY.previousDay}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="min-w-0 grow">
              <DatePicker
                label={<span className="sr-only">{GRAZING_MAP_COPY.dayLabel}</span>}
                field={{
                  name: "grazing_map_day",
                  value: day,
                  onChange: (value) => {
                    if (value) goToDay(format(new Date(value), "yyyy-MM-dd"))
                  },
                  onBlur: () => {},
                  ref: () => {},
                }}
                fieldState={{
                  invalid: false,
                  isTouched: false,
                  isDirty: false,
                  isValidating: false,
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0 pointer-coarse:size-10"
              onClick={() => goToDay(shiftDay(day, 1))}
              disabled={!day || day >= lastDay}
              aria-label={GRAZING_MAP_COPY.nextDay}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          {day && day !== defaultDay && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs pointer-coarse:h-10"
              onClick={() => setDay(defaultDay)}
            >
              <span key={isCurrentYear ? "today" : defaultDay}>
                {isCurrentYear
                  ? GRAZING_MAP_COPY.backToToday
                  : GRAZING_MAP_COPY.backToDay(
                      format(new Date(`${defaultDay}T12:00:00`), "d MMMM", { locale: nl }),
                    )}
              </span>
            </Button>
          )}
          {farmWritePermission && grasslandFields.length > 0 && (
            <FieldPickerButton
              label={GRAZING_MAP_COPY.addGrazing}
              icon={<Plus className="size-3.5" />}
              variant="default"
              className="h-8 w-full gap-1.5 text-xs pointer-coarse:h-10"
              fields={grasslandFields}
              onPick={(b_id) => {
                setGrazingSession((s) => s + 1)
                setGrazingField(grasslandFields.find((f) => f.b_id === b_id) ?? null)
              }}
            />
          )}
          <NavLink
            to={`/farm/${b_id_farm}/${calendar}/livestock/grazing`}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "h-8 w-full text-xs pointer-coarse:h-10",
            })}
            data-slot="button"
          >
            <CalendarDays className="size-3.5" />
            {GRAZING_MAP_COPY.openCalendar}
          </NavLink>
        </CardContent>
      </Card>

      {/* Legend (bottom left) */}
      {day && (
        <div className="pointer-events-none absolute bottom-9 left-4">
          <GrazingLegend dayLabel={dayLabel} counts={counts} />
        </div>
      )}

      {/* The grazing dialog, the same as on the grazing calendar */}
      <GrazingPopover
        key={grazingSession}
        open={grazingField !== null}
        onOpenChange={(open) => {
          if (!open) setGrazingField(null)
        }}
        b_id_farm={b_id_farm}
        calendar={calendar}
        field={grazingField}
        initialStartDate={day || undefined}
        initialEndDate={day || undefined}
        herds={herds}
        canWrite={farmWritePermission}
      />
    </div>
  )
}

/**
 * Popup body for the hovered field: the status with the same swatch as on the map and in the
 * legend, plus the herd and hours of a grazing, the yield of a harvest or the days of rest.
 */
function GrazingTooltipBody({
  state,
  calendarYear,
  isBufferstrip,
  herdCounts,
}: {
  state: FieldGrazingState
  calendarYear: number
  isBufferstrip: boolean
  herdCounts: Map<string, number>
}) {
  const statusLine = (text: string) => (
    <p className="flex items-center gap-1.5 text-xs">
      <GrazingStatusSwatch status={state.status} />
      {text}
    </p>
  )
  const formatShortDay = (d: string) => format(new Date(`${d}T12:00:00`), "d MMMM", { locale: nl })

  if (state.status === "disabled") {
    return statusLine(isBufferstrip ? GRAZING_MAP_COPY.bufferstrip : GRAZING_MAP_COPY.notGrassland)
  }
  if (state.status === "unused") {
    return statusLine(GRAZING_MAP_COPY.unusedInYear(calendarYear))
  }
  if (state.status === "maaien") {
    const yieldValue = state.harvest?.yield
    return (
      <div className="min-w-48 space-y-1.5">
        {statusLine(GRAZING_MAP_COPY.status.maaien)}
        {yieldValue != null && (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 tabular-nums">
            <dt>{GRAZING_MAP_COPY.yieldLabel}</dt>
            <dd className="text-right">{`${Math.round(yieldValue).toLocaleString("nl-NL")} kg ds/ha`}</dd>
          </dl>
        )}
      </div>
    )
  }
  if (state.status === "rust" && state.lastUse) {
    return (
      <div className="min-w-48 space-y-1.5">
        {statusLine(GRAZING_MAP_COPY.restDays(state.restDays ?? 0))}
        <dl className="grid grid-cols-[1fr_auto] gap-x-4">
          <dt>
            {state.lastUse.type === "weiden"
              ? GRAZING_MAP_COPY.lastGrazed
              : GRAZING_MAP_COPY.lastMown}
          </dt>
          <dd className="text-right">{formatShortDay(state.lastUse.date)}</dd>
        </dl>
      </div>
    )
  }

  const grazing = state.grazing
  if (!grazing) return null
  const animals = herdCounts.get(grazing.l_id_herd) ?? 0
  return (
    <div className="min-w-48 space-y-1.5">
      {statusLine(GRAZING_MAP_COPY.status.weiden)}
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 tabular-nums">
        <dt>{GRAZING_MAP_COPY.grazedBy}</dt>
        <dd className="text-right">
          {animals > 0
            ? `${grazing.l_herd_name} (${GRAZING_MAP_COPY.animals(animals)})`
            : grazing.l_herd_name}
        </dd>
        {grazing.l_grazing_hours != null && (
          <>
            <dt>{GRAZING_MAP_COPY.hoursPerDay}</dt>
            <dd className="text-right">{grazing.l_grazing_hours.toLocaleString("nl-NL")}</dd>
          </>
        )}
      </dl>
      {grazing.l_grazing_geometry_zone && (
        <p className="text-muted-foreground text-xs">{GRAZING_MAP_COPY.zone}</p>
      )}
    </div>
  )
}
