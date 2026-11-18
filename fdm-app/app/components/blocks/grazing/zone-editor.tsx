import type { MultiPolygon } from "geojson"
import {
  calculateGrazingAllocationArea,
  GRAZING_HOURS_PER_KG_DM_MIN,
  GROWTH_DURING_GRAZING_KG_DM_HA_DAY,
  INSCHAREN_DRY_MATTER_TARGET_KG_HA,
  NNW_TOTAL_ROUGHAGE_INTAKE_KG_DM,
} from "@nmi-agro/fdm-calculator/browser"
import { cn } from "cn"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { Eraser, PenLine, Pencil, Rows3, Undo2 } from "lucide-react"
import { type ComponentProps, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useFetcher } from "react-router"
import { Button } from "~/components/ui/button"
import { Field, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Skeleton } from "~/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { type Area, cutStrip, hasHoles, zoneAreaWithinField } from "~/lib/grazing-strip"
import { pushUndo } from "~/lib/undo-history"
import type { ZoneEditorMode, ZoneMapControls, ZoneNotice } from "./zone-editor-map"
import {
  OTHER_ZONE_COLOR,
  ZONE_CASING_COLOR,
  ZONE_FILL_COLOR,
  ZONE_OUTLINE_COLOR,
} from "./zone-colors"

// Lazy-loaded to avoid SSR issues with maplibre-gl and terra-draw and to keep them out of the bundle
const ZoneEditorMap = lazy(() => import("./zone-editor-map"))

/** Height of the map, also used for its placeholders while it loads. */
const MAP_HEIGHT_CLASS = "h-[min(420px,55vh)]"

/** Number of earlier zones shown before "Meer tonen". */
const EARLIER_ZONES_SHOWN = 8

const DRAW_HINT =
  "Klik de hoeken. Klik op het eerste punt of druk Enter om af te ronden; Esc stopt. Lijnen mogen elkaar niet kruisen. Houd Alt ingedrukt om niet te laten springen."
const REPLACE_HINT = "De nieuwe zone vervangt de huidige."
const EDIT_HINT =
  "Sleep een hoek, klik op een middenpunt voor een extra hoek, rechtsklik op een hoek om hem te verwijderen."
const NO_ZONE_REASON = "Teken eerst een zone"
const HOLE_REASON = "Deze zone heeft een gat en kan niet worden aangepast; teken hem opnieuw"
const NOTHING_TO_UNDO_REASON = "Er is nog niets om ongedaan te maken"

const NOTICES: Record<ZoneNotice, Notice> = {
  clipped: { tone: "info", text: "Het deel buiten het perceel is afgeknipt." },
  outside: {
    tone: "warning",
    text: "De zone lag buiten het perceel; teken binnen de perceelsgrens.",
  },
}

/** A message in the live region under the toolbar, in place of the hint for the mode. */
interface Notice {
  tone: "info" | "warning"
  text: string
}

/** The mode to continue in with a zone: editing, unless there is no zone or it cannot be edited. */
const modeFor = (zone: Area | null): ZoneEditorMode => (zone && !hasHoles(zone) ? "edit" : "draw")

/**
 * Days before the start of a grazing in which earlier zones on the field count as recently grazed:
 * a new strip connects to them instead of overlapping them. The Handboek Melkveehouderij §3.9.2
 * advises grazing a field again after at most 28 growth days, so a strip older than that is free.
 */
const STRIP_ROTATION_DAYS = 28

const DIRECTIONS = [
  { value: "0", label: "Naar het noorden" },
  { value: "90", label: "Naar het oosten" },
  { value: "180", label: "Naar het zuiden" },
  { value: "270", label: "Naar het westen" },
]

interface EarlierZone {
  l_grazing_geometry_zone: MultiPolygon
  l_grazing_area_grazed: number
  last_used: string
  usage_count: number
  l_herd_names: string[]
}

interface ZonesData {
  b_geometry: Area
  zones: EarlierZone[]
  /** The earlier zones could not be loaded; drawing still works. */
  zonesFailed: boolean
}

const formatHa = (value: number) =>
  value.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 2 })

const sameZone = (a: Area | null | undefined, b: Area | null | undefined) =>
  Boolean(a && b && JSON.stringify(a) === JSON.stringify(b))

export interface ZoneEditorProps {
  b_id_farm: string
  calendar: string
  b_id: string
  /** The zone being edited; `null` when none is drawn yet. */
  zone: Area | null
  onZoneChange: (zone: Area | null) => void
  /** The zone stored for the grazing being edited, which is not an earlier strip. */
  storedZone?: Area | null
  /** Number of animals in the herd, to size a strip. */
  animals?: number
  /** Grazing hours per day, to estimate the grass intake. */
  hoursPerDay: number
  /** Days in the grazing period. */
  days: number
  /** Start of the grazing period (yyyy-MM-dd). */
  startDate: string
}

/**
 * Lets the user draw a grazing zone within a field, reuse a zone from an earlier grazing, or
 * calculate a strip of the right size for the herd.
 */
export function ZoneEditor({
  b_id_farm,
  calendar,
  b_id,
  zone,
  onZoneChange,
  storedZone,
  animals,
  hoursPerDay,
  days,
  startDate,
}: ZoneEditorProps) {
  const fetcher = useFetcher<ZonesData>()
  const url = `/farm/${b_id_farm}/${calendar}/field/${b_id}/grazing/zones`
  // Load the field outline and earlier zones when the editor opens or the field changes
  const { load } = fetcher
  useEffect(() => {
    void load(url)
  }, [load, url])

  const [mode, setMode] = useState<ZoneEditorMode>(() => modeFor(zone))
  const [showStripBuilder, setShowStripBuilder] = useState(false)
  // Earlier zones, newest last, for "Ongedaan maken"
  const [history, setHistory] = useState<(Area | null)[]>([])
  // Whether the user is drawing a zone: the first corner is placed, the zone is not finished yet
  const [isDrawing, setIsDrawing] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [highlightedZone, setHighlightedZone] = useState<Area | null>(null)
  const [showAllEarlier, setShowAllEarlier] = useState(false)
  const mapControlsRef = useRef<ZoneMapControls | null>(null)

  const field = fetcher.data?.b_geometry ?? null
  const earlierZones = useMemo(
    () =>
      (fetcher.data?.zones ?? []).filter((z) => !sameZone(z.l_grazing_geometry_zone, storedZone)),
    [fetcher.data, storedZone],
  )
  // Earlier strips in the rotation window before this grazing; a new strip connects to them
  const recentZones = useMemo(() => {
    const start = new Date(startDate).getTime()
    const windowStart = start - STRIP_ROTATION_DAYS * 86_400_000
    return earlierZones
      .filter((z) => {
        const used = new Date(z.last_used).getTime()
        return used >= windowStart && used <= start
      })
      .map((z) => z.l_grazing_geometry_zone as Area)
  }, [earlierZones, startDate])

  const zoneArea = field && zone ? zoneAreaWithinField(zone, field) : null
  const zoneHasHoles = zone !== null && hasHoles(zone)
  const canUndo = isDrawing || history.length > 0

  /** Changes the zone and remembers the previous one for "Ongedaan maken". */
  const changeZone = (next: Area | null) => {
    if (next !== zone && !sameZone(next, zone)) setHistory((h) => pushUndo(h, zone))
    onZoneChange(next)
  }

  /** Switches the mode from the toolbar; leaving the draw mode cancels an unfinished drawing. */
  const switchMode = (next: ZoneEditorMode) => {
    if (next !== mode) setIsDrawing(false)
    setMode(next)
    setNotice(null)
  }

  const undo = () => {
    // While drawing, undo removes the last corner
    if (isDrawing) {
      mapControlsRef.current?.undoCorner()
      return
    }
    if (history.length === 0) return
    const previous = history[history.length - 1]
    setHistory(history.slice(0, -1))
    onZoneChange(previous)
    setMode(modeFor(previous))
    setNotice({ tone: "info", text: "Laatste wijziging ongedaan gemaakt." })
  }

  if (fetcher.data === undefined) {
    return <Skeleton className={cn(MAP_HEIGHT_CLASS, "w-full rounded-lg")} />
  }

  const hint =
    mode === "draw"
      ? zone
        ? `${REPLACE_HINT} ${DRAW_HINT}`
        : DRAW_HINT
      : mode === "edit"
        ? EDIT_HINT
        : ""
  const startYear = new Date(startDate).getFullYear()
  const shownEarlierZones = showAllEarlier
    ? earlierZones
    : earlierZones.slice(0, EARLIER_ZONES_SHOWN)

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TooltipProvider>
            <div className="flex flex-wrap gap-1.5">
              <ToolbarButton
                variant={mode === "draw" ? "default" : "outline"}
                aria-pressed={mode === "draw"}
                onClick={() => switchMode("draw")}
              >
                <PenLine className="h-3.5 w-3.5" />
                <span>Tekenen</span>
              </ToolbarButton>
              <ToolbarButton
                variant={mode === "edit" ? "default" : "outline"}
                aria-pressed={mode === "edit"}
                onClick={() => switchMode("edit")}
                disabled={!zone || zoneHasHoles}
                disabledReason={zoneHasHoles ? HOLE_REASON : NO_ZONE_REASON}
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Aanpassen</span>
              </ToolbarButton>
              <ToolbarButton
                variant={showStripBuilder ? "default" : "outline"}
                aria-pressed={showStripBuilder}
                onClick={() => setShowStripBuilder((show) => !show)}
              >
                <Rows3 className="h-3.5 w-3.5" />
                <span>Strook berekenen</span>
              </ToolbarButton>
              <ToolbarButton
                variant="ghost"
                onClick={() => {
                  changeZone(null)
                  switchMode("draw")
                }}
                disabled={!zone}
                disabledReason={NO_ZONE_REASON}
              >
                <Eraser className="h-3.5 w-3.5" />
                <span>Wissen</span>
              </ToolbarButton>
              <ToolbarButton
                variant="ghost"
                onClick={undo}
                disabled={!canUndo}
                disabledReason={NOTHING_TO_UNDO_REASON}
                aria-keyshortcuts="Control+Z"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Ongedaan maken</span>
              </ToolbarButton>
            </div>
          </TooltipProvider>
          <p className="text-muted-foreground text-xs" aria-live="polite">
            {zoneArea !== null ? (
              <span key="area">
                Zone: <strong className="text-foreground">{formatHa(zoneArea)} ha</strong> binnen
                het perceel
              </span>
            ) : (
              <span key="none">Nog geen zone.</span>
            )}
          </p>
        </div>
        <p
          className={cn(
            "text-xs",
            notice?.tone === "warning" ? "text-amber-700" : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          <span key={notice ? `notice-${notice.text}` : `hint-${mode}`}>
            {notice ? notice.text : hint}
          </span>
        </p>
      </div>

      <p className="text-muted-foreground text-xs sm:hidden">
        Een zone tekenen gaat het best op een groter scherm. Op de telefoon kun je ook een eerdere
        zone kiezen, of Deel van perceel, zonder kaart.
      </p>

      {field ? (
        <div className="space-y-1.5">
          <div className="overflow-hidden rounded-lg border">
            <Suspense fallback={<Skeleton className={cn(MAP_HEIGHT_CLASS, "w-full")} />}>
              <ZoneEditorMap
                fieldGeometry={field}
                zone={zone}
                onZoneChange={(next) => {
                  changeZone(next)
                  setNotice(null)
                  // A zone that can no longer be edited (deleted, or with a hole after clipping)
                  if (mode === "edit" && modeFor(next) !== "edit") setMode("draw")
                }}
                otherZones={recentZones}
                highlightedZone={highlightedZone}
                mode={mode}
                onDrawFinished={(drawn) => setMode(modeFor(drawn))}
                onNotice={(kind) => setNotice(NOTICES[kind])}
                onDrawingChange={setIsDrawing}
                onUndo={undo}
                controlsRef={mapControlsRef}
              />
            </Suspense>
          </div>
          <ZoneLegend showRecent={recentZones.length > 0} />
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Dit perceel heeft geen perceelsgrens, dus een zone tekenen kan niet.
        </p>
      )}

      {field && showStripBuilder && (
        <StripBuilder
          field={field}
          occupied={recentZones}
          animals={animals}
          hoursPerDay={hoursPerDay}
          days={days}
          onStrip={(strip) => {
            const hadZone = zone !== null
            changeZone(strip)
            switchMode(modeFor(strip))
            const made = `Strook van ${formatHa(zoneAreaWithinField(strip, field))} ha gemaakt`
            setNotice({
              tone: "info",
              text: hadZone ? `${made}; Ongedaan maken zet de vorige zone terug.` : `${made}.`,
            })
          }}
        />
      )}

      {fetcher.data.zonesFailed && (
        <p className="text-xs text-amber-700">
          Eerder gebruikte zones konden niet worden geladen. Je kunt wel een zone tekenen.
        </p>
      )}

      {earlierZones.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Eerder gebruikte zones</p>
          <div className="flex flex-wrap gap-1.5">
            {shownEarlierZones.map((earlier) => {
              const isCurrent = sameZone(earlier.l_grazing_geometry_zone, zone)
              const used = new Date(earlier.last_used)
              const label = [
                `${formatHa(earlier.l_grazing_area_grazed)} ha`,
                format(used, used.getFullYear() === startYear ? "d MMM" : "d MMM yyyy", {
                  locale: nl,
                }),
                earlier.l_herd_names.join(", "),
                earlier.usage_count > 1 ? `${earlier.usage_count}×` : "",
              ]
                .filter(Boolean)
                .join(" · ")
              return (
                <Button
                  key={`${earlier.last_used}-${earlier.l_grazing_area_grazed}`}
                  type="button"
                  size="sm"
                  variant={isCurrent ? "default" : "outline"}
                  aria-pressed={isCurrent}
                  onClick={() => {
                    changeZone(earlier.l_grazing_geometry_zone)
                    switchMode(modeFor(earlier.l_grazing_geometry_zone))
                  }}
                  onMouseEnter={() => setHighlightedZone(earlier.l_grazing_geometry_zone)}
                  onMouseLeave={() => setHighlightedZone(null)}
                  onFocus={() => setHighlightedZone(earlier.l_grazing_geometry_zone)}
                  onBlur={() => setHighlightedZone(null)}
                  className="h-auto px-2 py-1 text-left text-xs leading-tight"
                >
                  <span>{label}</span>
                </Button>
              )
            })}
            {earlierZones.length > EARLIER_ZONES_SHOWN && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-expanded={showAllEarlier}
                onClick={() => setShowAllEarlier((show) => !show)}
                className="h-auto px-2 py-1 text-xs leading-tight"
              >
                <span key={showAllEarlier ? "less" : "more"}>
                  {showAllEarlier ? "Minder tonen" : "Meer tonen"}
                </span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * A toolbar button. A disabled button stays focusable and explains in a tooltip why it is
 * disabled.
 */
function ToolbarButton({
  disabled,
  disabledReason,
  className,
  ...props
}: ComponentProps<typeof Button> & { disabledReason?: string }) {
  return (
    <Tooltip disabled={!disabled || !disabledReason}>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            focusableWhenDisabled
            className={cn(
              "gap-1.5 text-xs aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
              className,
            )}
            {...props}
          />
        }
      />
      <TooltipContent>{disabledReason}</TooltipContent>
    </Tooltip>
  )
}

/** Explains the colours on the zone map. */
function ZoneLegend({ showRecent }: { showRecent: boolean }) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="inline-flex items-center gap-1.5">
        {/* As on the map: a white wash with a white outline on a dark casing */}
        <span
          aria-hidden="true"
          className="size-3 rounded-sm border-2"
          style={{
            backgroundColor: `${ZONE_FILL_COLOR}59`,
            borderColor: ZONE_OUTLINE_COLOR,
            boxShadow: `0 0 0 1.5px ${ZONE_CASING_COLOR}`,
          }}
        />
        <span>Zone</span>
      </span>
      {showRecent && (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-3 rounded-sm border border-dashed"
            style={{ backgroundColor: `${OTHER_ZONE_COLOR}4d`, borderColor: OTHER_ZONE_COLOR }}
          />
          <span>{`Stroken van de afgelopen ${STRIP_ROTATION_DAYS} dagen`}</span>
        </span>
      )}
    </div>
  )
}

/**
 * Calculates the strip size for the herd and cuts it from the free part of the field:
 * area = animals × grass intake × days ÷ (grass on offer at in-grazing + regrowth × days).
 */
function StripBuilder({
  field,
  occupied,
  animals,
  hoursPerDay,
  days,
  onStrip,
}: {
  field: Area
  occupied: Area[]
  animals?: number
  hoursPerDay: number
  days: number
  onStrip: (strip: Area) => void
}) {
  // Nieuw Nederlands Weiden: at least 1 grazing hour per kg DM, so the hours cap the grass intake
  const defaultIntake = Math.min(
    NNW_TOTAL_ROUGHAGE_INTAKE_KG_DM,
    hoursPerDay / GRAZING_HOURS_PER_KG_DM_MIN,
  )
  const [direction, setDirection] = useState("90")
  const [animalCount, setAnimalCount] = useState(animals ? String(animals) : "")
  const [intake, setIntake] = useState(String(Math.round(defaultIntake * 10) / 10))
  const [offer, setOffer] = useState(String(INSCHAREN_DRY_MATTER_TARGET_KG_HA))
  const [notFree, setNotFree] = useState(false)

  const allocation = useMemo(() => {
    const n = Number(animalCount)
    const kg = Number(intake)
    const available = Number(offer)
    if (!(n > 0) || !(kg > 0) || !(available > 0) || !(days > 0)) return null
    return calculateGrazingAllocationArea({
      animals: n,
      grassIntakeKgDmPerAnimalPerDay: kg,
      availableGrassKgDmPerHa: available,
      days,
    })
  }, [animalCount, intake, offer, days])

  const handleCut = () => {
    if (!allocation) return
    const strip = cutStrip({
      field,
      occupied,
      targetAreaHa: allocation.areaHa,
      bearing: Number(direction),
    })
    setNotFree(!strip)
    if (strip) onStrip(strip)
  }

  return (
    <div className="bg-muted/30 space-y-3 rounded-lg border p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field>
          <FieldLabel htmlFor="strip-direction" className="text-xs">
            Richting
          </FieldLabel>
          <Select
            value={direction}
            items={DIRECTIONS}
            onValueChange={(v) => {
              if (v !== null) setDirection(v)
            }}
          >
            <SelectTrigger id="strip-direction" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIRECTIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="strip-animals" className="text-xs">
            Dieren
          </FieldLabel>
          <Input
            id="strip-animals"
            type="number"
            min="1"
            value={animalCount}
            onChange={(e) => setAnimalCount(e.target.value)}
            className="h-8 text-xs"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="strip-intake" className="text-xs">
            Grasopname (kg ds/dier/dag)
          </FieldLabel>
          <Input
            id="strip-intake"
            type="number"
            min="0.5"
            step="0.5"
            value={intake}
            onChange={(e) => setIntake(e.target.value)}
            className="h-8 text-xs"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="strip-offer" className="text-xs">
            Grasaanbod (kg ds/ha)
          </FieldLabel>
          <Input
            id="strip-offer"
            type="number"
            min="100"
            step="100"
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            className="h-8 text-xs"
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {allocation ? (
            <span key="allocation">
              Strook van{" "}
              <strong className="text-foreground">{formatHa(allocation.areaHa)} ha</strong> voor{" "}
              {days} {days === 1 ? "dag" : "dagen"}: {animalCount} dieren × {intake} kg ds × {days}{" "}
              ÷ {allocation.grassOnOfferKgDmPerHa.toLocaleString("nl-NL")} kg ds/ha ({offer} bij
              inscharen + {GROWTH_DURING_GRAZING_KG_DM_HA_DAY} bijgroei per weidedag).
            </span>
          ) : (
            <span key="incomplete">Vul het aantal dieren, de grasopname en het grasaanbod in.</span>
          )}
        </p>
        <Button
          type="button"
          size="sm"
          onClick={handleCut}
          disabled={!allocation}
          className="text-xs"
        >
          Strook maken
        </Button>
      </div>
      {notFree && (
        <p className="text-xs text-amber-700">
          Het hele perceel is de afgelopen {STRIP_ROTATION_DAYS} dagen al beweid; er is geen vrije
          strook meer.
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        De strook sluit aan op de stroken van de afgelopen {STRIP_ROTATION_DAYS} dagen (grijs). De
        grasopname is maximaal 1 kg ds per weide-uur (Nieuw Nederlands Weiden: minimaal 1 weide-uur
        per kg ds). Het grasaanbod is 1.700 kg ds/ha bij inscharen plus{" "}
        {GROWTH_DURING_GRAZING_KG_DM_HA_DAY} kg ds/ha bijgroei per weidedag (Handboek
        Melkveehouderij). Pas de waarden aan voor je eigen bedrijf.
      </p>
    </div>
  )
}
