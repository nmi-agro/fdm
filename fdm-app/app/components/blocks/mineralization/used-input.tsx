import type { MineralizationUsedInput } from "@nmi-agro/fdm-calculator"
import type { ReactNode } from "react"
import {
  ArrowRight,
  Calculator,
  ChevronDown,
  type LucideIcon,
  Microscope,
  Sparkles,
  User,
} from "lucide-react"
import { NavLink } from "react-router"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { FertilizerBadge } from "~/components/custom/fertilizer-badge"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import {
  DYNA_V2_MIN_DAYS_BETWEEN_HARVESTS,
  formatLongDate,
  formatNumber,
} from "~/lib/mineralization"

/** Name and unit of a soil parameter. */
export type SoilParameterLabels = Record<string, { name: string; unit: string }>

/** Source of soil values that are estimated rather than measured (NMI BodemSchat). */
const ESTIMATED_SOURCE = "nl-other-nmi"

type SoilRow = MineralizationUsedInput["soil"][number]

/** Soil values grouped by where they come from: one lab analysis, an estimate, etc. */
interface SoilGroup {
  key: string
  title: string
  icon: LucideIcon
  date: string | null
  rows: SoilRow[]
}

function groupSoilBySource(soil: SoilRow[], sourceLabels: Record<string, string>): SoilGroup[] {
  const groups = new Map<string, SoilGroup>()
  for (const row of soil) {
    const source = row.source
    const estimated = source === ESTIMATED_SOURCE
    const key = `${source ?? ""}|${estimated ? "" : (row.date ?? "")}`
    let group = groups.get(key)
    if (!group) {
      const label = source ? (sourceLabels[source] ?? source) : null
      group =
        source === "calculated"
          ? { key, title: "Berekend", icon: Calculator, date: null, rows: [] }
          : estimated
            ? { key, title: `Geschat met ${label}`, icon: Sparkles, date: null, rows: [] }
            : !source || source === "other"
              ? { key, title: "Onbekende bron", icon: User, date: row.date, rows: [] }
              : { key, title: `Gemeten door ${label}`, icon: Microscope, date: row.date, rows: [] }
      groups.set(key, group)
    }
    group.rows.push(row)
  }
  // Measured values first, estimates last
  return [...groups.values()].sort(
    (a, b) => Number(a.icon === Sparkles) - Number(b.icon === Sparkles),
  )
}

function plural(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function Section({
  title,
  editHref,
  editLabel,
  children,
}: {
  title: string
  editHref?: string
  editLabel?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {editHref ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            nativeButton={false}
            render={
              <NavLink to={editHref}>
                {editLabel}
                <ArrowRight aria-hidden />
              </NavLink>
            }
          />
        ) : null}
      </div>
      {children}
    </section>
  )
}

/**
 * Shows exactly which data was used for the calculation, with links to where it can be completed.
 */
export function UsedInput({
  id,
  open,
  onOpenChange,
  usedInput,
  soilLabels,
  sourceLabels,
  fertilizerTypes,
  fieldHref,
  partial,
}: {
  id?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  usedInput: MineralizationUsedInput
  soilLabels: SoilParameterLabels
  /** Labels of the soil analysis sources (labs, NMI BodemSchat). */
  sourceLabels: Record<string, string>
  /** Fertilizer type per fertilizer (`p_id`), for the icon of each application. */
  fertilizerTypes: Record<string, string | null>
  /** Base path of the field pages, e.g. `/farm/:id/:calendar/field/:b_id`. */
  fieldHref: string
  partial: boolean
}) {
  const label = (parameter: string) => soilLabels[parameter]?.name ?? parameter
  // Dimensionless parameters such as pH are stored with "-" as unit; that is not shown
  const unit = (parameter: string) => {
    const value = soilLabels[parameter]?.unit ?? ""
    return value === "-" ? "" : value
  }
  const skipped = usedInput.skippedApplications.length
  const soilGroups = groupSoilBySource(usedInput.soil, sourceLabels)
  const estimatedSoil = usedInput.soil.filter((s) => s.source === ESTIMATED_SOURCE).length
  const measuredSoil = usedInput.soil.length - estimatedSoil
  const summary = [
    usedInput.soil.length === 0
      ? "geen bodemgegevens"
      : estimatedSoil === 0
        ? `bodem: ${measuredSoil} gemeten`
        : measuredSoil === 0
          ? `bodem: ${estimatedSoil} geschat`
          : `bodem: ${measuredSoil} gemeten, ${estimatedSoil} geschat`,
    plural(usedInput.cultivations.length, "gewas", "gewassen"),
    plural(usedInput.harvests.length, "oogst", "oogsten"),
    plural(usedInput.fertilizerApplications.length, "bemesting", "bemestingen"),
  ].join(" · ")

  return (
    <Collapsible
      id={id}
      open={open}
      onOpenChange={onOpenChange}
      className="scroll-mt-4 rounded-xl border"
    >
      <CollapsibleTrigger className="group hover:bg-muted/40 focus-visible:ring-ring flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left focus-visible:ring-2 focus-visible:outline-none">
        <span className="min-w-0 space-y-0.5">
          <span className="block text-sm font-semibold">Gebruikte gegevens voor de berekening</span>
          <span className="text-muted-foreground block text-sm first-letter:uppercase">
            {summary}
          </span>
        </span>
        <ChevronDown
          className="text-muted-foreground size-4 shrink-0 transition-transform group-data-panel-open:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-6 border-t p-4 md:grid-cols-2">
          <Section title="Bodem" editHref={`${fieldHref}/soil`} editLabel="Bodemanalyse toevoegen">
            {soilGroups.length > 0 ? (
              <div className="space-y-3">
                {soilGroups.map((group) => (
                  <div key={group.key} className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                      <group.icon className="size-3.5 shrink-0" aria-hidden />
                      {group.title}
                      {group.date ? <span> · {formatLongDate(group.date)}</span> : null}
                    </p>
                    <ul className="space-y-1 text-sm">
                      {group.rows.map((s) => (
                        <li key={s.parameter} className="flex justify-between gap-3">
                          <span className="text-muted-foreground">{label(s.parameter)}</span>
                          <span className="text-right tabular-nums">
                            {typeof s.value === "number" ? formatNumber(s.value, 2) : s.value}{" "}
                            {unit(s.parameter)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Geen bodemanalyse bekend.</p>
            )}
            {estimatedSoil > 0 ? (
              <p className="text-muted-foreground text-xs">
                Geschatte waarden zijn afgeleid uit bodemkaarten en landelijke gegevens, niet
                gemeten op dit perceel. Een eigen bodemanalyse maakt de berekening nauwkeuriger.
              </p>
            ) : null}
            {usedInput.missingSoilParameters.length > 0 ? (
              <p className="text-muted-foreground text-xs">
                Niet bekend; het rekenmodel schat zelf:{" "}
                {usedInput.missingSoilParameters.map(label).join(", ")}.
              </p>
            ) : null}
          </Section>

          <Section
            title="Gewassen"
            editHref={`${fieldHref}/cultivation`}
            editLabel="Gewassen bekijken"
          >
            <ul className="space-y-1.5 text-sm">
              {usedInput.cultivations.map((c) => (
                <li key={c.b_lu} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    {/* Same crop badge as the crop rotation and field tables */}
                    <Badge
                      variant="default"
                      className="text-white"
                      style={{
                        backgroundColor: getCultivationColor(c.b_lu_croprotation ?? undefined),
                      }}
                    >
                      {c.b_lu_name ?? c.b_lu_catalogue}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {c.role === "main" ? "Hoofdteelt" : "Na hoofdteelt"}
                    </span>
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatLongDate(c.start)} – {formatLongDate(c.end)}
                  </span>
                </li>
              ))}
            </ul>
            {partial ? (
              <p className="text-muted-foreground text-xs">
                De teelt na de hoofdteelt kon nog niet worden meegerekend.
              </p>
            ) : null}
          </Section>

          <Section
            title="Oogsten"
            editHref={`${fieldHref}/cultivation`}
            editLabel="Oogst aanpassen"
          >
            {usedInput.harvests.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {usedInput.harvests.map((h) => (
                  <li key={`${h.b_lu}-${h.date}`} className="flex justify-between gap-3">
                    <span className="flex items-center gap-2">
                      {formatLongDate(h.date)}
                      {h.planned ? (
                        <Badge variant="outline" className="font-normal">
                          Gepland
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {h.b_lu_yield !== null
                        ? `${formatNumber(h.b_lu_yield)} kg DS/ha`
                        : "Opbrengst onbekend"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Geen oogst nodig voor deze teelt.</p>
            )}
            {usedInput.omittedHarvests.length > 0 ? (
              <p className="text-muted-foreground text-xs">
                Niet meegerekend (binnen {DYNA_V2_MIN_DAYS_BETWEEN_HARVESTS} dagen na de vorige):{" "}
                {usedInput.omittedHarvests.map((h) => formatLongDate(h.date)).join(", ")}.
              </p>
            ) : null}
          </Section>

          <Section
            title="Bemestingen"
            editHref={`${fieldHref}/fertilizer`}
            editLabel="Bemestingen bekijken"
          >
            {usedInput.fertilizerApplications.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {usedInput.fertilizerApplications.map((a) => (
                  <li
                    key={a.p_app_id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{formatLongDate(a.date)}</span>
                      {/* Same fertilizer badge as the crop rotation table */}
                      <FertilizerBadge variant="outline" showIcon p_type={fertilizerTypes[a.p_id]}>
                        {a.p_name_nl ?? "Meststof"}
                      </FertilizerBadge>
                    </span>
                    <span className="text-muted-foreground ml-auto text-right tabular-nums">
                      {a.amount !== null ? `${formatNumber(a.amount, 1)} ${a.unit}` : "–"}
                      {a.p_n_rt !== null ? ` · ${formatNumber(a.p_n_rt, 1)} g N/kg` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Geen bemestingen in dit jaar.</p>
            )}
            {usedInput.skippedApplications.length > 0 ? (
              <p className="text-muted-foreground text-xs">
                {skipped === 1
                  ? "1 bemesting is niet meegenomen"
                  : `${skipped} bemestingen zijn niet meegenomen`}
                : de meststof is niet bekend op dit bedrijf.
              </p>
            ) : null}
          </Section>

          <p className="text-muted-foreground text-xs md:col-span-2">
            Locatie: {formatNumber(usedInput.location.a_lat, 4)}° N,{" "}
            {formatNumber(usedInput.location.a_lon, 4)}° O
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
