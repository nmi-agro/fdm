import { Database } from "lucide-react"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import type { FieldMeasure } from "~/lib/indicators"

type CultivationSummary = {
  name: string
  year: number | null
  croprotation: string | null
}

type SoilMeasurement = {
  key: string
  label: string
  unit: string | null
  value: number
}

type BcsScore = {
  key: string
  name: string
  value: number
  direction: "positive" | "negative"
}

const BCS_SCORE_LABELS_POSITIVE: Record<number, string> = {
  0: "Slecht",
  1: "Matig",
  2: "Goed",
}

const BCS_SCORE_LABELS_NEGATIVE: Record<number, string> = {
  0: "Goed",
  1: "Matig",
  2: "Slecht",
}

type SoilData = {
  soilType: string | null
  gwlClass: string | null
  measurements: SoilMeasurement[]
  bcsScores: BcsScore[]
}

type FieldInputDialogProps = {
  cultivations: CultivationSummary[]
  fieldMeasures: FieldMeasure[]
  soilData: SoilData | null
}

export function FieldInputDialog({ cultivations, fieldMeasures, soilData }: FieldInputDialogProps) {
  const bln3Measures = fieldMeasures.filter((m) => m.m_id.startsWith("bln_"))

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          Invoergegevens
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoergegevens BLN3</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {/* Soil analysis */}
          <Section label="Bodemanalyse">
            {!soilData ||
            (!soilData.soilType && !soilData.gwlClass && soilData.measurements.length === 0) ? (
              <p className="text-muted-foreground italic">Geen bodemanalyse beschikbaar</p>
            ) : (
              <div className="space-y-0.5">
                {soilData.soilType && <Row label="Bodemtype" value={soilData.soilType} />}
                {soilData.gwlClass && <Row label="Grondwaterklasse" value={soilData.gwlClass} />}
                {soilData.measurements.length > 0 && (
                  <div className="mt-1.5 border-t pt-1.5 space-y-0.5">
                    {soilData.measurements.map(({ key, label, unit, value }) => (
                      <Row
                        key={key}
                        label={label}
                        value={String(value)}
                        unit={unit ?? undefined}
                        mono
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* BCS indicator scores */}
          {soilData && soilData.bcsScores.length > 0 && (
            <Section label={`BodemConditieScore (${soilData.bcsScores.length} indicatoren)`}>
              <div className="space-y-0.5">
                {soilData.bcsScores.map(({ key, name, value, direction }) => (
                  <div key={key} className="flex items-baseline justify-between gap-2">
                    <span className="text-muted-foreground text-xs shrink-0">{name}</span>
                    <span className="text-foreground text-xs tabular-nums font-mono text-right">
                      {value}
                      <span className="text-muted-foreground ml-1 font-sans">
                        {direction === "negative"
                          ? (BCS_SCORE_LABELS_NEGATIVE[value] ?? "")
                          : (BCS_SCORE_LABELS_POSITIVE[value] ?? "")}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Cultivations using Badge + getCultivationColor */}
          <Section label={`Teelten (${cultivations.length})`}>
            {cultivations.length === 0 ? (
              <p className="text-muted-foreground italic">Geen teelten geregistreerd</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {cultivations.map((c) => (
                  <li key={`${c.name}-${c.year}`}>
                    <Badge
                      style={{
                        backgroundColor: getCultivationColor(c.croprotation ?? undefined),
                      }}
                      className="text-white"
                      variant="default"
                    >
                      {c.name}
                      {c.year !== null && <span className="ml-1 opacity-80">{c.year}</span>}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* BLN measures */}
          <Section label={`BLN maatregelen (${bln3Measures.length})`}>
            {bln3Measures.length === 0 ? (
              <p className="text-muted-foreground italic">Geen maatregelen actief</p>
            ) : (
              <ul className="space-y-1">
                {bln3Measures.map((m) => (
                  <li key={m.b_id_measure} className="flex items-start gap-2">
                    <span className="shrink-0 font-mono text-xs text-muted-foreground pt-px">
                      {m.m_id.replace("bln_", "")}
                    </span>
                    <span className="text-foreground">{m.m_name}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <p className="text-xs text-muted-foreground pt-2 border-t">
            Dit zijn de gegevens die worden gebruikt als invoer voor de NMI BLN3-berekening.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
        {label}
      </p>
      {children}
    </div>
  )
}

function Row({
  label,
  value,
  unit,
  mono = false,
}: {
  label: string
  value: string
  unit?: string
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground text-xs shrink-0">{label}</span>
      <span
        className={`text-foreground text-xs text-right ${mono ? "tabular-nums font-mono" : ""}`}
      >
        {value}
        {unit && <span className="text-muted-foreground ml-1">{unit}</span>}
      </span>
    </div>
  )
}
