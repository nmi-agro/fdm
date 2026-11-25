import type { FieldExclusionReason, PhosphateBalance } from "@nmi-agro/fdm-calculator"
import { PHOSPHATE_VERDICT_ORDER } from "@nmi-agro/fdm-calculator/browser"
import { ChevronDown, OctagonAlert } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader } from "~/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { BufferStripInfo } from "./buffer-strip-info"
import {
  formatAreaHa,
  PHOSPHATE_EXCLUSION_GROUP,
  PHOSPHATE_VERDICT_STYLE,
  PHOSPHATE_VERDICT_TEXT,
} from "./phosphate-format"
import { PhosphateCardHeading, PhosphateStatusIcon } from "./phosphate-soil"

/**
 * Area of the farm per verdict as a bar plus a legend with icon, label, hectares and number of
 * fields: the first answer on the farm page, because the farm saldo averages fields with different
 * aims.
 *
 * @param statusArea - Area and count per verdict.
 * @param failedCount - Number of fields whose balance could not be calculated.
 */
export function PhosphateStatusDistributionCard({
  statusArea,
  failedCount,
}: {
  statusArea: PhosphateBalance["status_area"]
  failedCount: number
}) {
  const total = PHOSPHATE_VERDICT_ORDER.reduce((sum, v) => sum + statusArea[v].area, 0)
  const verdicts = PHOSPHATE_VERDICT_ORDER.filter((v) => statusArea[v].count > 0)
  return (
    <Card>
      <CardHeader className="space-y-1.5 pb-3">
        <PhosphateCardHeading>Fosfaattoestand van de percelen</PhosphateCardHeading>
        <CardDescription>
          Oppervlakte per oordeel. Elk perceel wordt beoordeeld tegen zijn eigen streefzone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {total > 0 ? (
          <div className="flex h-3 w-full overflow-hidden rounded-full" aria-hidden="true">
            {verdicts.map((v) => (
              <div
                key={v}
                className={PHOSPHATE_VERDICT_STYLE[v].bar}
                style={{ width: `${(statusArea[v].area / total) * 100}%` }}
              />
            ))}
          </div>
        ) : null}
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {verdicts.map((v) => (
            <li key={v} className="flex items-center gap-1.5">
              <PhosphateStatusIcon verdict={v} className="size-4" decorative />
              <span className="font-medium">{PHOSPHATE_VERDICT_TEXT[v].label}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatAreaHa(statusArea[v].area)} ({statusArea[v].count}{" "}
                {statusArea[v].count === 1 ? "perceel" : "percelen"})
              </span>
            </li>
          ))}
          {verdicts.length === 0 ? (
            <li className="text-muted-foreground">Geen percelen beoordeeld</li>
          ) : null}
        </ul>
        {failedCount > 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-red-800">
            <OctagonAlert className="size-4 shrink-0" aria-hidden="true" />
            {failedCount === 1
              ? "1 perceel kon niet worden berekend."
              : `${failedCount} percelen konden niet worden berekend.`}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * Fields left out of the phosphate balance, grouped by reason and collapsed per group, so a farm
 * with many landscape elements does not bury the fields that count.
 *
 * @param excluded - Name and reason of each excluded field.
 */
export function PhosphateExcludedFieldsCard({
  excluded,
}: {
  excluded: { name: string; reason: FieldExclusionReason }[]
}) {
  const groups = (["nature", "landscape_element", "bufferstrip"] as const)
    .map((reason) => ({
      reason,
      names: excluded
        .filter((e) => e.reason === reason)
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b, "nl")),
    }))
    .filter((group) => group.names.length > 0)
  return (
    <Card>
      <CardHeader className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <PhosphateCardHeading>Niet meegenomen ({excluded.length})</PhosphateCardHeading>
          <BufferStripInfo />
        </div>
        <CardDescription>
          Natuur, landschapselementen en bufferstroken worden niet voor productie bemest of geoogst.
          Ze tellen niet mee in de balans en het bedrijfsgemiddelde.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {groups.map((group) => (
          <Collapsible key={group.reason}>
            <CollapsibleTrigger className="hover:bg-muted focus-visible:ring-ring/50 group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm outline-none focus-visible:ring-[3px] pointer-coarse:py-3">
              <span>
                {PHOSPHATE_EXCLUSION_GROUP[group.reason]}{" "}
                <span className="text-muted-foreground tabular-nums">({group.names.length})</span>
              </span>
              <ChevronDown className="size-4 transition-transform group-data-panel-open:rotate-180 motion-reduce:transition-none" />
            </CollapsibleTrigger>
            <CollapsibleContent className="text-muted-foreground px-2 pb-2 text-sm">
              {group.names.join(", ")}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  )
}
