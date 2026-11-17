import type { MultiPolygon } from "geojson"
import {
  calculateGrazingAllocationArea,
  GRAZING_HOURS_PER_KG_DM_MIN,
  INSCHAREN_DRY_MATTER_TARGET_KG_HA,
  NNW_TOTAL_ROUGHAGE_INTAKE_KG_DM,
} from "@nmi-agro/fdm-calculator/browser"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { Eraser, PenLine, Pencil, Rows3 } from "lucide-react"
import { lazy, Suspense, useEffect, useMemo, useState } from "react"
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
import { type Area, cutStrip, zoneAreaWithinField } from "~/lib/grazing-strip"
import type { ZoneEditorMode } from "./zone-editor-map"

// Lazy-loaded to avoid SSR issues with maplibre-gl and terra-draw and to keep them out of the bundle
const ZoneEditorMap = lazy(() => import("./zone-editor-map"))

/**
 * Days before the start of a grazing in which earlier zones on the field count as recently grazed:
 * a new strip connects to them instead of overlapping them. Nieuw Nederlands Weiden switches block
 * after four weeks; using that as the rotation window is an assumption.
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

  const [mode, setMode] = useState<ZoneEditorMode>(zone ? "edit" : "draw")
  const [showStripBuilder, setShowStripBuilder] = useState(false)

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

  if (fetcher.data === undefined) {
    return <Skeleton className="h-[320px] w-full rounded-lg" />
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={mode === "draw" ? "default" : "outline"}
            onClick={() => setMode("draw")}
            className="gap-1.5 text-xs"
          >
            <PenLine className="h-3.5 w-3.5" />
            <span>Tekenen</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "edit" ? "default" : "outline"}
            onClick={() => setMode("edit")}
            disabled={!zone}
            className="gap-1.5 text-xs"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Aanpassen</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={showStripBuilder ? "default" : "outline"}
            onClick={() => setShowStripBuilder((show) => !show)}
            className="gap-1.5 text-xs"
          >
            <Rows3 className="h-3.5 w-3.5" />
            <span>Strook berekenen</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              onZoneChange(null)
              setMode("draw")
            }}
            disabled={!zone}
            className="gap-1.5 text-xs"
          >
            <Eraser className="h-3.5 w-3.5" />
            <span>Wissen</span>
          </Button>
        </div>
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {zoneArea !== null ? (
            <span key="area">
              Zone: <strong className="text-foreground">{formatHa(zoneArea)} ha</strong> binnen het
              perceel
            </span>
          ) : (
            <span key="hint">
              {mode === "draw"
                ? "Klik op de kaart om de hoeken te zetten; dubbelklik om af te ronden."
                : "Nog geen zone."}
            </span>
          )}
        </p>
      </div>

      {field ? (
        <div className="overflow-hidden rounded-lg border">
          <Suspense fallback={<Skeleton className="h-[320px] w-full" />}>
            <ZoneEditorMap
              fieldGeometry={field}
              zone={zone}
              onZoneChange={onZoneChange}
              otherZones={recentZones}
              mode={mode}
              onDrawFinished={() => setMode("edit")}
            />
          </Suspense>
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
            onZoneChange(strip)
            setMode("edit")
          }}
        />
      )}

      {earlierZones.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Eerder gebruikte zones</p>
          <div className="flex flex-wrap gap-1.5">
            {earlierZones.slice(0, 8).map((earlier) => (
              <Button
                key={`${earlier.last_used}-${earlier.l_grazing_area_grazed}`}
                type="button"
                size="sm"
                variant={sameZone(earlier.l_grazing_geometry_zone, zone) ? "default" : "outline"}
                onClick={() => {
                  onZoneChange(earlier.l_grazing_geometry_zone)
                  setMode("edit")
                }}
                className="h-auto px-2 py-1 text-left text-[11px] leading-tight"
              >
                <span>
                  {formatHa(earlier.l_grazing_area_grazed)} ha ·{" "}
                  {format(new Date(earlier.last_used), "d MMM", { locale: nl })}
                  {earlier.usage_count > 1 ? ` · ${earlier.usage_count}×` : ""}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Calculates the strip size for the herd and cuts it from the free part of the field:
 * area = animals × grass intake × days ÷ grass on offer.
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
              ÷ {offer} kg ds/ha.
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
      <p className="text-muted-foreground text-[11px]">
        De strook sluit aan op de stroken van de afgelopen {STRIP_ROTATION_DAYS} dagen (grijs). De
        grasopname gaat uit van minimaal 1 weide-uur per kg ds (Nieuw Nederlands Weiden); het
        grasaanbod van 1.700 kg ds/ha bij inscharen (Handboek Melkveehouderij).
      </p>
    </div>
  )
}
