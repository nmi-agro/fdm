import type { SoilAnalysis, SoilParameterDescription } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import { formatSoilUnit, groupSoilParameters, SAMPLING_PARAMETERS } from "./parameter-groups"

/**
 * The measured values of a soil analysis, read-only and grouped by topic in the same order as the
 * soil analysis form. The sampling details are left out; show them in the page header instead.
 *
 * @param soilAnalysis - The soil analysis to show.
 * @param soilParameterDescription - Descriptions of the parameters, for names, units and labels.
 */
export function SoilAnalysisValues({
  soilAnalysis,
  soilParameterDescription,
}: {
  soilAnalysis: SoilAnalysis
  soilParameterDescription: SoilParameterDescription
}) {
  const record = soilAnalysis as unknown as Record<string, unknown>
  const items = soilParameterDescription.filter(
    (x) =>
      x.parameter !== "a_id" &&
      !(SAMPLING_PARAMETERS as readonly string[]).includes(x.parameter) &&
      record[x.parameter] !== null &&
      record[x.parameter] !== undefined &&
      record[x.parameter] !== "",
  )
  const groups = groupSoilParameters(items)

  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Deze bodemanalyse bevat nog geen waarden.</p>
    )
  }

  return (
    <div className="@container">
      <div className="grid gap-x-10 gap-y-8 @3xl:grid-cols-2">
        {groups.map(({ group, items: groupItems }) => (
          <section key={group.id} aria-labelledby={`soil-values-${group.id}`} className="space-y-2">
            <h4 id={`soil-values-${group.id}`} className="text-sm font-semibold">
              {group.title}
            </h4>
            <dl className="divide-y border-y">
              {groupItems.map((x) => (
                <div
                  key={x.parameter}
                  className="flex items-baseline justify-between gap-4 py-2 text-sm"
                >
                  <dt className="text-muted-foreground">{x.name}</dt>
                  <dd className="text-right font-medium tabular-nums">
                    {formatSoilValue(record[x.parameter], x)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  )
}

/** Formats the value of a soil parameter with its unit or option label. */
function formatSoilValue(value: unknown, description: SoilParameterDescription[number]): string {
  if (description.type === "enum") {
    const label = description.options?.find(
      (option: { value: string }) => option.value === value,
    )?.label
    return label ?? String(value)
  }
  if (value instanceof Date || description.type === "date") {
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : format(date, "PP", { locale: nl })
  }
  if (typeof value === "number") {
    const unit = formatSoilUnit(description.unit)
    const number = value.toLocaleString("nl-NL", { maximumFractionDigits: 3 })
    return unit ? `${number} ${unit}` : number
  }
  return String(value)
}
