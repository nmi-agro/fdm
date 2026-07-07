import { format } from "date-fns"
import { nl } from "date-fns/locale"
import maplibregl from "maplibre-gl"
import {
  Microscope,
  MoveRight,
  Sparkles,
  User,
} from "lucide-react"
import { type ReactNode, Suspense, useEffect, useMemo, useRef } from "react"
import { Await, Link, useNavigate } from "react-router"
import { ClientOnly } from "remix-utils/client-only"
import { Layer, Map as MapGL, type MapRef } from "react-map-gl/maplibre"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { FieldSourceClickable, FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { FieldsPanelHover } from "~/components/blocks/atlas/atlas-panels"
import { ScoreBadge } from "~/components/blocks/indicators/score-badge"
import { BCS_COLOR_CLASSES, BCS_SCORE_DOT } from "~/components/blocks/soil-visual/bcs-color-utils"
import { BcsScoreCard } from "~/components/blocks/soil-visual/bcs-score-card"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { NormProgressBar } from "~/components/blocks/norms/progress-bar"
import { AdviceProgressBar } from "~/components/blocks/nutrient-advice/progress-bar"
import { getScoreDotClass } from "~/lib/indicators"
import { cn } from "~/lib/utils"
import {
  type AsyncTileResult,
  type FieldDashboardCultivationHistoryEntry,
  type FieldDashboardTileProps,
} from "./types"
import {
  FieldDashboardTile,
  FieldDashboardTileEmpty,
  FieldDashboardTileError,
  FieldDashboardTileSkeleton,
} from "./tile"

function formatDateLabel(value: Date | string | null | undefined, fallback = "Onbekend") {
  if (!value) return fallback
  return format(new Date(value), "d MMM yyyy", { locale: nl })
}

function formatNumberLabel(value: number | null | undefined, unit?: string) {
  if (value == null) return "Onbekend"
  const rounded = Math.round(value * 10) / 10
  return unit ? `${rounded.toLocaleString("nl-NL")} ${unit}` : rounded.toLocaleString("nl-NL")
}

function soilSourceIcon(source: string | null) {
  if (source === "nl-other-nmi") return Sparkles
  if (source && source !== "other") return Microscope
  return User
}

function renderAsyncState<T>(
  title: string,
  detailHref: string,
  result: AsyncTileResult<T>,
  renderer: (data: T) => ReactNode,
) {
  if (result.status === "ready") {
    return renderer(result.data)
  }

  if (result.status === "empty" || result.status === "unavailable") {
    return (
      <FieldDashboardTile
        title={title}
        detailHref={detailHref}
        statusBadge={
          result.status === "unavailable" ? (
            <span className="text-muted-foreground text-xs font-medium">Niet beschikbaar</span>
          ) : undefined
        }
      >
        <p className="text-muted-foreground text-sm leading-relaxed">{result.message}</p>
      </FieldDashboardTile>
    )
  }

  return <FieldDashboardTileError title={title} detailHref={detailHref} message={result.message} />
}

export function FieldDashboardMapTile({ dashboard, tile }: FieldDashboardTileProps) {
  const fieldFeatures = dashboard.farmFieldsGeoJson.features

  if (fieldFeatures.length === 0) {
    return (
      <FieldDashboardTile
        title={tile.title}
        detailHref={tile.detailHref}
        detailLabel="Bekijk in atlas"
      >
        <div className="space-y-4">
          <div className="bg-muted/40 flex min-h-72 items-center justify-center rounded-lg border border-dashed p-6 text-center">
            <div className="space-y-2">
              <p className="font-medium">Kaart niet beschikbaar</p>
              <p className="text-muted-foreground text-sm">
                Voor dit perceel is nog geen geometrie beschikbaar. De perceelgegevens hieronder
                blijven wel beschikbaar.
              </p>
            </div>
          </div>
        </div>
      </FieldDashboardTile>
    )
  }

  return (
    <FieldDashboardTile
      title={tile.title}
      detailHref={tile.detailHref}
      detailLabel="Bekijk in atlas"
      contentClassName="space-y-4"
    >
      <ClientOnly
        fallback={<div className="bg-muted/40 h-72 rounded-lg border animate-pulse" />}
      >
        {() => (
          <Suspense fallback={<FieldDashboardMap dashboard={dashboard} fieldCroprotationById={{}} />}>
            <Await resolve={dashboard.asyncInsights.fieldCultivationColors} errorElement={
              <FieldDashboardMap dashboard={dashboard} fieldCroprotationById={{}} />
            }>
              {(fieldCroprotationById) => (
                <FieldDashboardMap dashboard={dashboard} fieldCroprotationById={fieldCroprotationById} />
              )}
            </Await>
          </Suspense>
        )}
      </ClientOnly>
    </FieldDashboardTile>
  )
}

function FieldDashboardMap({
  dashboard,
  fieldCroprotationById,
}: {
  dashboard: FieldDashboardTileProps["dashboard"]
  fieldCroprotationById: Record<string, string | null>
}) {
  const navigate = useNavigate()
  const mapRef = useRef<MapRef>(null)
  // Zoom in on the selected field rather than the full farm extent, so the field itself
  // is legible; neighbouring fields remain visible/clickable at the map's edges.
  const initialViewState = useMemo(
    () => getViewState(dashboard.selectedFieldGeoJson ?? dashboard.farmFieldsGeoJson),
    [dashboard],
  )

  useEffect(() => {
    if (initialViewState.bounds) {
      mapRef.current?.fitBounds(initialViewState.bounds, initialViewState.fitBoundsOptions)
    }
  }, [initialViewState])

  const coloredFieldsGeoJson = useMemo(
    () => ({
      ...dashboard.farmFieldsGeoJson,
      features: dashboard.farmFieldsGeoJson.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          b_lu_croprotation: fieldCroprotationById[feature.properties.b_id] ?? null,
        },
      })),
    }),
    [dashboard.farmFieldsGeoJson, fieldCroprotationById],
  )

  // Reuse the exact same layer styles as the full-screen atlas fields page: a crop-colored
  // fill, a green "saved fields" outline, and an invisible "fieldsSaved" layer used for
  // hover/click detection (its id is special-cased by FieldsPanelHover to show name + area).
  const fieldsColorFill = { ...getFieldsStyle("dashboard-fields-fill"), id: "dashboard-fields-fill" }
  const fieldsSavedOutline = { ...getFieldsStyle("fieldsSavedOutline"), id: "dashboard-fields-outline" }
  const fieldsSaved = { ...getFieldsStyle("fieldsSaved"), id: "fieldsSaved" }
  const selectedOutline = { ...getFieldsStyle("fieldsSelectedOutline"), id: "dashboard-selected-outline" }

  return (
    <MapGL
      {...initialViewState}
      ref={mapRef}
      style={{ height: 360, width: "100%" }}
      mapStyle={dashboard.mapStyle}
      mapLib={maplibregl}
      interactiveLayerIds={["fieldsSaved"]}
    >
      <MapTilerAttribution />
      <FieldSourceClickable
        id="dashboard-fields-source"
        fieldsData={coloredFieldsGeoJson}
        onFieldClick={(feature) => {
          const b_id = feature.properties?.b_id
          if (!b_id || b_id === dashboard.b_id) return
          void navigate(`/farm/${dashboard.b_id_farm}/${dashboard.calendar}/field/${b_id}`)
        }}
      >
        <Layer {...fieldsColorFill} />
        <Layer {...fieldsSavedOutline} />
        <Layer {...fieldsSaved} />
      </FieldSourceClickable>
      <FieldsSourceNotClickable
        id="dashboard-selected-source"
        fieldsData={dashboard.selectedFieldGeoJson}
      >
        <Layer {...selectedOutline} />
      </FieldsSourceNotClickable>
      <div className="fields-panel">
        <FieldsPanelHover zoomLevelFields={-1} layer="fieldsSaved" />
      </div>
    </MapGL>
  )
}

export function FieldDashboardIdentityTile({ dashboard, tile }: FieldDashboardTileProps) {
  const ownershipLabel =
    dashboard.acquiringMethodOptions.find(
      (option) => option.value === dashboard.field.b_acquiring_method,
    )?.label ?? "Onbekend"
  const inUseLabel = dashboard.field.b_start
    ? `${formatDateLabel(dashboard.field.b_start)} – ${
        dashboard.field.b_end ? formatDateLabel(dashboard.field.b_end) : "heden"
      }`
    : "Onbekend"

  return (
    <FieldDashboardTile
      title={tile.title}
      detailHref={tile.detailHref}
      detailLabel={dashboard.fieldWritePermission ? "Bewerk gegevens" : "Bekijk gegevens"}
    >
      <div className="space-y-6">
        <div>
          <p className="text-xl font-semibold">{dashboard.field.b_name}</p>
          <p className="text-muted-foreground text-sm">Overzicht van de belangrijkste veldgegevens.</p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Oppervlakte</dt>
            <dd className="mt-1 text-sm font-medium">
              {dashboard.field.b_area != null
                ? `${dashboard.field.b_area.toFixed(1).replace(".", ",")} ha`
                : "Onbekend"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Eigendom / pacht</dt>
            <dd className="mt-1 text-sm font-medium">{ownershipLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">In gebruik</dt>
            <dd className="mt-1 text-sm font-medium">{inUseLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Bufferstrook</dt>
            <dd className="mt-1 text-sm font-medium">
              {dashboard.field.b_bufferstrip ? "Ja" : "Nee"}
            </dd>
          </div>
        </dl>
      </div>
    </FieldDashboardTile>
  )
}

export function FieldDashboardCurrentCultivationTile({ dashboard, tile }: FieldDashboardTileProps) {
  const activeCultivation = dashboard.cultivation.active

  if (!activeCultivation) {
    return (
      <FieldDashboardTileEmpty
        title={tile.title}
        detailHref={tile.detailHref}
        emptyTitle="Nog geen gewas voor dit jaar"
        emptyDescription="Registreer een teelt om oogsten, bemesting en bodeminformatie in context te zien."
        action={
          dashboard.fieldWritePermission
            ? {
                href: tile.detailHref,
                label: "Gewas toevoegen",
              }
            : undefined
        }
      />
    )
  }

  const latestHarvest = activeCultivation.harvests[0]
  const harvestTermPlural = activeCultivation.harvestTermPlural
  const harvestDateTerm = activeCultivation.harvestDateTerm
  const isSingleHarvest = activeCultivation.b_lu_harvestable === "once"

  return (
    <FieldDashboardTile title={tile.title} detailHref={tile.detailHref}>
      <div className="space-y-4">
        <div>
          <p className="text-xl font-semibold">{activeCultivation.name}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Gestart op {formatDateLabel(activeCultivation.startDate)}.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs uppercase">Teeltperiode</p>
            <p className="mt-1 text-sm font-medium">
              {formatDateLabel(activeCultivation.startDate)} –{" "}
              {formatDateLabel(activeCultivation.endDate, "Lopend")}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs uppercase capitalize">
              {isSingleHarvest ? harvestTermPlural.replace(/en$/, "") : harvestTermPlural}
            </p>
            <p className="mt-1 text-sm font-medium">
              {activeCultivation.harvests.length === 0
                ? `Nog geen ${harvestTermPlural} geregistreerd`
                : isSingleHarvest
                  ? "Vastgelegd"
                  : `${activeCultivation.harvests.length} geregistreerd`}
            </p>
          </div>
        </div>
        {latestHarvest ? (
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-xs uppercase">{harvestDateTerm}</p>
                <p className="mt-1 text-sm font-medium">{formatDateLabel(latestHarvest.date)}</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to={latestHarvest.detailHref}>
                  Bekijken
                  <MoveRight className="size-4" />
                </Link>
              </Button>
            </div>
            {latestHarvest.metrics.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {latestHarvest.metrics.map((metric) => (
                  <div key={metric.label}>
                    <p className="text-muted-foreground text-xs">{metric.label}</p>
                    <p className="text-sm font-semibold">{metric.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground mt-4 text-sm">
                Nog geen opbrengst of gehaltes vastgelegd voor deze {activeCultivation.harvestTermPlural.replace(/en$/, "")}.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4">
            <p className="text-sm font-medium">Nog geen {harvestTermPlural} geregistreerd</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Voeg een {harvestTermPlural.replace(/en$/, "")} toe om opbrengst en gehaltes hier te
              tonen.
            </p>
          </div>
        )}
      </div>
    </FieldDashboardTile>
  )
}

export function FieldDashboardCultivationHistoryTile({ dashboard, tile }: FieldDashboardTileProps) {
  return (
    <Suspense fallback={<FieldDashboardTileSkeleton title={tile.title} detailHref={tile.detailHref} />}>
      <Await
        resolve={dashboard.asyncInsights.cultivationHistory}
        errorElement={<FieldDashboardTileError title={tile.title} detailHref={tile.detailHref} />}
      >
        {(result) =>
          renderAsyncState(tile.title, tile.detailHref, result, (history) =>
            history.length === 0 ? (
              <FieldDashboardTileEmpty
                title={tile.title}
                detailHref={tile.detailHref}
                emptyTitle="Nog geen teelthistorie"
                emptyDescription="Zodra er gewassen zijn geregistreerd, verschijnt hier een compact overzicht van de jaren op dit perceel."
              />
            ) : (
              <FieldDashboardTile title={tile.title} detailHref={tile.detailHref}>
                <FieldDashboardCultivationHistoryList history={history} />
              </FieldDashboardTile>
            ),
          )
        }
      </Await>
    </Suspense>
  )
}

function FieldDashboardCultivationHistoryList({
  history,
}: {
  history: FieldDashboardCultivationHistoryEntry[]
}) {
  return (
    <div className="max-h-80 overflow-y-auto pr-2">
      <div className="relative pl-1">
        {history.map((entry, index) => (
          <div
            key={`${entry.year}-${entry.b_lu_catalogue}`}
            className="group relative flex items-start space-x-4 pb-6 last:pb-0"
          >
            {/* Timeline line */}
            {index !== history.length - 1 && (
              <div className="bg-border group-hover:bg-primary/30 absolute top-10 left-4.75 h-full w-0.5 transition-colors" />
            )}

            {/* Dot */}
            <div className="bg-background relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full transition-all"
                style={{ backgroundColor: getCultivationColor(entry.b_lu_croprotation), opacity: 0.2 }}
              />
              <div
                className="absolute h-3 w-3 rounded-full shadow-sm"
                style={{ backgroundColor: getCultivationColor(entry.b_lu_croprotation) }}
              />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 py-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-semibold">{entry.b_lu_name ?? "Onbekend gewas"}</p>
                <Badge variant="secondary" className="shrink-0">
                  {entry.source === "nmi" ? "BRP" : "Ingevuld"}
                </Badge>
              </div>
              <span className="text-muted-foreground/70 mt-0.5 inline-block text-xs font-bold tabular-nums">
                {entry.year}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FieldDashboardFertilizerApplicationsTile({
  dashboard,
  tile,
}: FieldDashboardTileProps) {
  if (dashboard.fertilizer.applicationCount === 0) {
    return (
      <FieldDashboardTileEmpty
        title={tile.title}
        detailHref={tile.detailHref}
        emptyTitle="Nog geen bemesting geregistreerd"
        emptyDescription="Voeg meststoffen toe om de giften en gebruiksruimte hier te volgen."
        action={
          dashboard.fieldWritePermission
            ? { href: tile.detailHref, label: "Bemesting toevoegen" }
            : undefined
        }
      />
    )
  }

  return (
    <FieldDashboardTile title={tile.title} detailHref={tile.detailHref}>
      <div className="space-y-4">
        <div>
          <p className="text-3xl font-semibold">{dashboard.fertilizer.applicationCount}</p>
          <p className="text-muted-foreground text-sm">
            bemestingen · laatste op {formatDateLabel(dashboard.fertilizer.lastApplicationDate)}
          </p>
        </div>
        <Separator />
        <div className="space-y-3">
          {dashboard.fertilizer.applications.slice(0, 4).map((application) => (
            <div key={application.p_app_id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{application.p_name}</p>
                <p className="text-muted-foreground">{formatDateLabel(application.date)}</p>
              </div>
              <p className="shrink-0 font-semibold">
                {formatNumberLabel(application.amount, application.unit)}
              </p>
            </div>
          ))}
          {dashboard.fertilizer.applications.length > 4 ? (
            <p className="text-muted-foreground text-xs">
              + {dashboard.fertilizer.applications.length - 4} meer
            </p>
          ) : null}
        </div>
      </div>
    </FieldDashboardTile>
  )
}

export function FieldDashboardNutrientAdviceTile({ dashboard, tile }: FieldDashboardTileProps) {
  return (
    <Suspense fallback={<FieldDashboardTileSkeleton title={tile.title} detailHref={tile.detailHref} />}>
      <Await
        resolve={dashboard.asyncInsights.fertilizer}
        errorElement={<FieldDashboardTileError title={tile.title} detailHref={tile.detailHref} />}
      >
        {(result) =>
          renderAsyncState(tile.title, tile.detailHref, result.advice, (data) => (
            <FieldDashboardTile title={tile.title} detailHref={tile.detailHref}>
              <div className="space-y-4">
                {data.items.map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-muted-foreground text-xs uppercase">{item.label}</p>
                      <p className="text-sm font-semibold">
                        {Math.round(item.current)} / {Math.round(item.target)} {item.unit}
                      </p>
                    </div>
                    <AdviceProgressBar current={item.current} target={item.target} />
                  </div>
                ))}
              </div>
            </FieldDashboardTile>
          ))
        }
      </Await>
    </Suspense>
  )
}

export function FieldDashboardNormsTile({ dashboard, tile }: FieldDashboardTileProps) {
  return (
    <Suspense fallback={<FieldDashboardTileSkeleton title={tile.title} detailHref={tile.detailHref} />}>
      <Await
        resolve={dashboard.asyncInsights.fertilizer}
        errorElement={<FieldDashboardTileError title={tile.title} detailHref={tile.detailHref} />}
      >
        {(result) =>
          renderAsyncState(tile.title, tile.detailHref, result.norms, (data) => (
            <FieldDashboardTile title={tile.title} detailHref={tile.detailHref}>
              <div className="space-y-4">
                {data.items.map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-muted-foreground text-xs uppercase">{item.label}</p>
                      <p className="text-sm font-semibold">
                        {Math.round(item.used)} / {Math.round(item.limit)} {item.unit}
                      </p>
                    </div>
                    <NormProgressBar used={item.used} limit={item.limit} />
                  </div>
                ))}
              </div>
            </FieldDashboardTile>
          ))
        }
      </Await>
    </Suspense>
  )
}

export function FieldDashboardNitrogenBalanceTile({ dashboard, tile }: FieldDashboardTileProps) {
  return (
    <Suspense fallback={<FieldDashboardTileSkeleton title={tile.title} detailHref={tile.detailHref} />}>
      <Await
        resolve={dashboard.asyncInsights.nitrogenBalance}
        errorElement={<FieldDashboardTileError title={tile.title} detailHref={tile.detailHref} />}
      >
        {(result) =>
          renderAsyncState(tile.title, tile.detailHref, result, (data) => (
            <FieldDashboardTile
              title={tile.title}
              detailHref={tile.detailHref}
              statusBadge={
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
                    data.balance <= data.target
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
                  )}
                >
                  {data.balance <= data.target ? "Onder streefwaarde " : "Boven streefwaarde"}
                </span>
              }
            >
              <div className="space-y-4">
                <div>
                  <p className="text-3xl font-semibold">
                    {Math.round(data.balance)} / {Math.round(data.target)}
                  </p>
                  <p className="text-muted-foreground text-sm">Overschot / streefwaarde · {data.unit}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground text-xs uppercase">Aanvoer</p>
                    <p className="mt-1 text-sm font-semibold">{formatNumberLabel(data.supply, data.unit)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground text-xs uppercase">Afvoer</p>
                    <p className="mt-1 text-sm font-semibold">{formatNumberLabel(data.removal, data.unit)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground text-xs uppercase">Ammoniakemissie</p>
                    <p className="mt-1 text-sm font-semibold">
                      {formatNumberLabel(data.emissionAmmonia, data.unit)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground text-xs uppercase">Nitraatuitspoeling</p>
                    <p className="mt-1 text-sm font-semibold">
                      {formatNumberLabel(data.emissionNitrate, data.unit)}
                    </p>
                  </div>
                </div>
              </div>
            </FieldDashboardTile>
          ))
        }
      </Await>
    </Suspense>
  )
}

export function FieldDashboardOrganicMatterBalanceTile({ dashboard, tile }: FieldDashboardTileProps) {
  return (
    <Suspense fallback={<FieldDashboardTileSkeleton title={tile.title} detailHref={tile.detailHref} />}>
      <Await
        resolve={dashboard.asyncInsights.organicMatterBalance}
        errorElement={<FieldDashboardTileError title={tile.title} detailHref={tile.detailHref} />}
      >
        {(result) =>
          renderAsyncState(tile.title, tile.detailHref, result, (data) => (
            <FieldDashboardTile
              title={tile.title}
              detailHref={tile.detailHref}
              statusBadge={
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
                    data.balance > 0
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
                  )}
                >
                  {data.balance > 0 ? "Positief" : "Negatief"}
                </span>
              }
            >
              <div className="space-y-4">
                <div>
                  <p className="text-3xl font-semibold">{Math.round(data.balance)}</p>
                  <p className="text-muted-foreground text-sm">Balans · {data.unit}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground text-xs uppercase">Aanvoer</p>
                    <p className="mt-1 text-sm font-semibold">{formatNumberLabel(data.supply, data.unit)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground text-xs uppercase">Afbraak</p>
                    <p className="mt-1 text-sm font-semibold">
                      {formatNumberLabel(data.degradation, data.unit)}
                    </p>
                  </div>
                </div>
              </div>
            </FieldDashboardTile>
          ))
        }
      </Await>
    </Suspense>
  )
}

export function FieldDashboardSoilParametersTile({ dashboard, tile }: FieldDashboardTileProps) {
  if (dashboard.soil.parameterCards.length === 0) {
    return (
      <FieldDashboardTileEmpty
        title={tile.title}
        detailHref={tile.detailHref}
        emptyTitle="Nog geen bodemanalyse"
        emptyDescription="Voeg een analyse toe om bodemtype, organische stof en pH in één oogopslag te zien."
        action={
          dashboard.fieldWritePermission
            ? { href: tile.detailHref, label: "Bodemanalyse toevoegen" }
            : undefined
        }
      />
    )
  }

  return (
    <FieldDashboardTile title={tile.title} detailHref={tile.detailHref}>
      <div className="grid gap-4 sm:grid-cols-2">
        {dashboard.soil.parameterCards.map((card) => {
          const Icon = soilSourceIcon(card.source)
          const valueLabel =
            card.value == null
              ? "Onbekend"
              : card.type === "enum"
                ? (card.label ?? String(card.value))
                : `${card.value}${card.unit ? ` ${card.unit}` : ""}`

          return (
            <div key={card.parameter} className="rounded-lg border p-4">
              <div className="space-y-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="decoration-muted-foreground/50 cursor-help text-sm font-medium underline decoration-dotted underline-offset-4">
                        {card.title}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{card.description}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <p className="text-base font-semibold">{valueLabel}</p>
              </div>
              <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
                <Icon className="size-3.5" />
                <span className="truncate">
                  {card.source === "nl-other-nmi"
                    ? "Geschat met NMI BodemSchat"
                    : card.source && card.source !== "other"
                      ? `Gemeten door ${card.sourceLabel}`
                      : "Onbekende bron"}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </FieldDashboardTile>
  )
}

export function FieldDashboardSoilAnalysesTile({ dashboard, tile }: FieldDashboardTileProps) {
  if (dashboard.soil.analysisCount === 0) {
    return (
      <FieldDashboardTileEmpty
        title={tile.title}
        detailHref={tile.detailHref}
        emptyTitle="Nog geen bodemanalyses"
        emptyDescription="Registreer een analyse om meetmomenten en bronnen van de bodemdata te volgen."
      />
    )
  }

  return (
    <FieldDashboardTile title={tile.title} detailHref={tile.detailHref}>
      <div className="space-y-5">
        <div>
          <p className="text-3xl font-semibold">{dashboard.soil.analysisCount}</p>
          <p className="text-muted-foreground text-sm">
            analyses · laatste bemonstering op {formatDateLabel(dashboard.soil.latestAnalysisDate)}
          </p>
        </div>
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2">
              <Microscope className="size-4" />
              Gemeten
            </span>
            <span className="font-semibold">{dashboard.soil.measuredCount}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2">
              <Sparkles className="size-4" />
              Geschat
            </span>
            <span className="font-semibold">{dashboard.soil.estimatedCount}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2">
              <User className="size-4" />
              Onbekende bron
            </span>
            <span className="font-semibold">{dashboard.soil.unknownCount}</span>
          </div>
        </div>
      </div>
    </FieldDashboardTile>
  )
}

export function FieldDashboardBcsTile({ dashboard, tile }: FieldDashboardTileProps) {
  if (!dashboard.soil.bcs) {
    return (
      <FieldDashboardTileEmpty
        title={tile.title}
        detailHref={tile.detailHref}
        emptyTitle="Nog geen BodemConditieScore"
        emptyDescription="Voeg een visuele bodembeoordeling toe om de conditie van dit perceel te volgen."
        action={
          dashboard.fieldWritePermission ? { href: tile.detailHref, label: "Meting toevoegen" } : undefined
        }
      />
    )
  }

  const bcs = dashboard.soil.bcs

  return (
    <FieldDashboardTile
      title={tile.title}
      detailHref={tile.detailHref}
      statusBadge={
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium",
            BCS_COLOR_CLASSES[bcs.scoreColor],
          )}
        >
          <span className={cn("size-2 rounded-full", BCS_SCORE_DOT[bcs.scoreColor])} />
          {bcs.scoreLabel}
        </span>
      }
      contentClassName="p-0"
    >
      <div className="[&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
        <BcsScoreCard
          scores={bcs.scores}
          a_ph_bcs={bcs.a_ph_bcs}
          a_som_bcs={bcs.a_som_bcs}
          d_bcs={bcs.d_bcs}
          i_bcs={bcs.i_bcs}
          scoreColor={bcs.scoreColor}
          scoreLabel={bcs.scoreLabel}
          measuredAt={bcs.measuredAt ? formatDateLabel(bcs.measuredAt) : undefined}
        />
      </div>
    </FieldDashboardTile>
  )
}

export function FieldDashboardBlnTile({ dashboard, tile }: FieldDashboardTileProps) {
  return (
    <Suspense fallback={<FieldDashboardTileSkeleton title={tile.title} detailHref={tile.detailHref} />}>
      <Await
        resolve={dashboard.asyncInsights.bln}
        errorElement={<FieldDashboardTileError title={tile.title} detailHref={tile.detailHref} />}
      >
        {(result) =>
          renderAsyncState(tile.title, tile.detailHref, result, (data) => (
            <FieldDashboardTile
              title={tile.title}
              detailHref={tile.detailHref}
              statusBadge={<ScoreBadge score={data.score} />}
            >
              <div className="space-y-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-3xl font-semibold">{data.score}/100</p>
                    <p className="text-muted-foreground text-sm">{data.verdict}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">
                      {data.attentionCount === 0
                        ? "Geen directe aandachtspunten"
                        : `${data.attentionCount} aandachtspunt${data.attentionCount === 1 ? "" : "en"}`}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  {data.aggregations.map((aggregation) => (
                    <div key={aggregation.id} className="rounded-lg border p-3">
                      <p className="text-muted-foreground text-xs uppercase">{aggregation.label}</p>
                      <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
                        {aggregation.score == null ? (
                          "Onbekend"
                        ) : (
                          <>
                            <span
                              className={cn("size-2 rounded-full", getScoreDotClass(aggregation.score))}
                            />
                            {aggregation.score}/100
                          </>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </FieldDashboardTile>
          ))
        }
      </Await>
    </Suspense>
  )
}

export function FieldDashboardMeasuresTile({ dashboard, tile }: FieldDashboardTileProps) {
  if (dashboard.measures.activeCount === 0) {
    return (
      <FieldDashboardTileEmpty
        title={tile.title}
        detailHref={tile.detailHref}
        emptyTitle="Nog geen maatregelen"
        emptyDescription="Registreer bodemmaatregelen om de voortgang van dit perceel te volgen."
        action={
          dashboard.fieldWritePermission ? { href: tile.detailHref, label: "Maatregel toevoegen" } : undefined
        }
      />
    )
  }

  return (
    <FieldDashboardTile title={tile.title} detailHref={tile.detailHref}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs uppercase">Actief</p>
            <p className="mt-1 text-xl font-semibold">{dashboard.measures.activeCount}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs uppercase">Doorlopend</p>
            <p className="mt-1 text-xl font-semibold">{dashboard.measures.ongoingCount}</p>
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          {dashboard.measures.items.slice(0, 3).map((measure) => (
            <div key={measure.b_id_measure} className="min-w-0 text-sm">
              <p className="truncate font-medium">{measure.m_name}</p>
              <p className="text-muted-foreground">
                {measure.m_start ? formatDateLabel(measure.m_start) : "Onbekende start"} ·{" "}
                {measure.m_end ? `tot ${formatDateLabel(measure.m_end)}` : "doorlopend"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </FieldDashboardTile>
  )
}
