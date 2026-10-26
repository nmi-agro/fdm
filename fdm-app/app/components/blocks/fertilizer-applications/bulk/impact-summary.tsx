import { AlertTriangle, ArrowRight, ChevronDown, Info, RotateCw } from "lucide-react"
import { type ReactNode, useId, useState } from "react"
import { NavLink, useRevalidator } from "react-router"
import { computeNormProgress } from "~/components/blocks/norms/progress-bar"
import { computeAdviceProgress } from "~/components/blocks/nutrient-advice/progress-bar"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { Label } from "~/components/ui/label"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { Switch } from "~/components/ui/switch"
import { cn } from "~/lib/utils"
import type { AdviceSummary, BalanceSummary, NormOutcome } from "./aggregate"
import type { ImpactState } from "./impact-state"
import type { BulkFieldIssue, BulkNormKey, BulkNormValues, BulkNutrient } from "./types"
import { ImpactBar, type ImpactBarTone } from "./impact-bar"
import { InfoTip } from "./info-tip"
import { ComparisonLabel, formatKg } from "./status"

/** Labels, units and explanations of the farm norms, as on the norms page. */
export const NORM_DESCRIPTIONS: Record<
  BulkNormKey,
  { label: string; unit: string; tooltip: string }
> = {
  nitrogen: {
    label: "Stikstof, werkzaam",
    unit: "kg N",
    tooltip: "Werkzame stikstof volgens forfaitaire gehalten",
  },
  phosphate: {
    label: "Fosfaat",
    unit: "kg P₂O₅",
    tooltip: "Fosfaataanvoer incl. mogelijke stimuleringsregeling",
  },
  manure: {
    label: "Stikstof uit dierlijke mest",
    unit: "kg N",
    tooltip: "Totaal stikstof via dierlijke mest",
  },
  renure: {
    label: "RENURE",
    unit: "kg N",
    tooltip: "Stikstof uit RENURE, max. 80 kg N/ha bovenop dierlijke mest",
  },
}

const NUTRIENT_DESCRIPTIONS: Record<
  BulkNutrient,
  { label: string; unit: string; tooltip?: string }
> = {
  n: { label: "N", unit: "kg N/ha", tooltip: "Werkzame stikstof" },
  p: { label: "P₂O₅", unit: "kg P₂O₅/ha" },
  k: { label: "K₂O", unit: "kg K₂O/ha" },
}

/** Whether norms are shown for a single field (kg per ha) or for the whole farm (kg). */
export type NormsScope = "field" | "farm"

/** Shared frame of an impact block: heading with link, basis, controls, content and footer. */
function ImpactBlock({
  title,
  basis,
  detailHref,
  detailLabel,
  pending,
  controls,
  titleAddon,
  children,
  footer,
}: {
  title: string
  basis: string
  detailHref: string
  detailLabel: string
  pending?: boolean
  /** Controls for the block, such as a scope switch. Shown on their own line below the basis. */
  controls?: ReactNode
  /** A small element shown right after the title, such as the colour of a cultivation. */
  titleAddon?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section aria-label={title} className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              {title}
              {titleAddon}
            </h3>
            <p className="text-muted-foreground text-xs">{basis}</p>
          </div>
          <NavLink
            to={detailHref}
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs underline-offset-4 hover:underline"
          >
            {detailLabel}
            <ArrowRight className="size-3" aria-hidden="true" />
          </NavLink>
        </div>
        {(controls || pending) && (
          <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-3">{controls}</div>
            {pending && (
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Spinner className="size-3.5" aria-hidden="true" />
                Effect berekenen…
              </span>
            )}
          </div>
        )}
      </div>
      <div className={cn("space-y-3 transition-opacity", pending && "[&_[data-after]]:opacity-50")}>
        {children}
      </div>
      {footer}
    </section>
  )
}

/** One metric row: label, "current → after / reference unit", bar and status. */
function MetricRow({
  label,
  tooltip,
  unit,
  current,
  after,
  reference,
  referenceLabel,
  tone,
  status,
}: {
  label: string
  tooltip?: string
  unit: string
  current: number
  after?: number
  reference: number
  referenceLabel: string
  tone: ImpactBarTone
  status?: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      {/* The label wraps, the value keeps its own right-aligned column, so every row lines up */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 text-sm">
        <span className="flex min-w-0 items-center gap-1 font-medium">
          {label}
          {tooltip && (
            <InfoTip content={tooltip}>
              <button
                type="button"
                className="text-muted-foreground -m-1 rounded-sm p-1"
                aria-label={tooltip}
              >
                <Info className="size-3.5" aria-hidden="true" />
              </button>
            </InfoTip>
          )}
        </span>
        <span className="flex items-baseline gap-2 whitespace-nowrap tabular-nums">
          <span>
            {formatKg(current)}
            {after !== undefined && formatKg(after) !== formatKg(current) && (
              <>
                <span data-after className="font-semibold">
                  {" "}
                  → {formatKg(after)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  ({after > current ? "+" : "−"}
                  {formatKg(Math.abs(after - current))})
                  <span className="sr-only">{after > current ? " toename" : " afname"}</span>
                </span>
              </>
            )}
            <span className="text-muted-foreground">
              {" "}
              / {formatKg(reference)} {unit}
            </span>
            <span className="sr-only">{referenceLabel}</span>
          </span>
          {status}
        </span>
      </div>
      <ImpactBar current={current} after={after} reference={reference} tone={tone} />
    </div>
  )
}

/** "x van y percelen meegenomen" with an expandable list of reasons. */
function CoverageFooter({
  counted,
  total,
  issues,
}: {
  counted: number
  total: number
  issues: BulkFieldIssue[]
}) {
  if (issues.length === 0 && counted === total) return null
  const summary =
    total === 1
      ? counted === 1
        ? "Opmerking bij dit perceel"
        : "Dit perceel kon niet worden meegenomen"
      : `${counted} van ${total} percelen meegenomen`
  return (
    <Collapsible>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex items-center gap-1 text-xs">
        {summary}
        {issues.length > 0 && (
          <ChevronDown
            className="size-3 transition-transform group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        )}
      </CollapsibleTrigger>
      {issues.length > 0 && (
        <CollapsibleContent>
          <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
            {issues.map((issue) => (
              <li key={`${issue.b_id}-${issue.message}`}>
                {total > 1 && (
                  <>
                    <span className="text-foreground font-medium">{issue.b_name}</span>:{" "}
                  </>
                )}
                {issue.message}
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

function BlockSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Laden">
      {Array.from({ length: rows }, (_, i) => (
        <div key={`skeleton-${i}`} className="space-y-1.5">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-2 w-full" />
        </div>
      ))}
    </div>
  )
}

/** A failed block, with the option to load the page data again. */
function BlockError({ message }: { message: string }) {
  const revalidator = useRevalidator()
  const busy = revalidator.state !== "idle"
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm">{message}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void revalidator.revalidate()}
      >
        {busy ? <Spinner /> : <RotateCw className="size-4" aria-hidden="true" />}
        Opnieuw proberen
      </Button>
    </div>
  )
}

const normTone = (used: number, limit: number): ImpactBarTone =>
  computeNormProgress(used, limit).isOverLimit ? "over" : "ok"

const adviceTone = (current: number, target: number): ImpactBarTone => {
  const { status } = computeAdviceProgress(current, target)
  return status === "on-target" ? "ok" : status
}

/**
 * The legal application norms (gebruiksruimte), with the filling before and after the change.
 * By default for the whole farm in kg; for a single field in kg per ha.
 */
export function FarmNormsImpact({
  detailHref,
  loading,
  error,
  available,
  showRenure,
  farmNorms,
  current,
  after,
  pending,
  counted,
  total,
  issues,
  title = "Gebruiksruimte bedrijf",
  basis = "Hele bedrijf, totaal in kg",
  perHectare = false,
  controls,
}: {
  detailHref: string
  loading: boolean
  error?: string
  available: boolean
  showRenure: boolean
  farmNorms?: BulkNormValues
  current?: BulkNormValues
  after?: BulkNormValues
  pending: boolean
  counted: number
  total: number
  issues: BulkFieldIssue[]
  title?: string
  basis?: string
  /** Show the units per hectare, for the norms of a single field. */
  perHectare?: boolean
  controls?: ReactNode
}) {
  const keys: BulkNormKey[] = showRenure
    ? ["nitrogen", "phosphate", "manure", "renure"]
    : ["nitrogen", "phosphate", "manure"]

  return (
    <ImpactBlock
      title={title}
      basis={basis}
      detailHref={detailHref}
      detailLabel="Gebruiksnormen"
      pending={pending && available}
      controls={controls}
      footer={
        available && !loading && !error ? (
          <CoverageFooter counted={counted} total={total} issues={issues} />
        ) : null
      }
    >
      {loading ? (
        <BlockSkeleton rows={3} />
      ) : error ? (
        <BlockError message={error} />
      ) : !available || !farmNorms || !current ? (
        <p className="text-muted-foreground text-sm">
          Geen gebruiksnormen beschikbaar voor dit jaar.
        </p>
      ) : (
        keys.map((key) => {
          const norm = farmNorms[key] ?? 0
          const shown = after?.[key] ?? current[key] ?? 0
          const { label, unit, tooltip } = NORM_DESCRIPTIONS[key]
          const isOver = computeNormProgress(shown, norm).isOverLimit
          return (
            <MetricRow
              key={key}
              label={label}
              tooltip={tooltip}
              unit={perHectare ? `${unit}/ha` : unit}
              current={current[key] ?? 0}
              after={after?.[key]}
              reference={norm}
              referenceLabel="gebruiksruimte"
              tone={normTone(shown, norm)}
              status={<ComparisonLabel status={isOver ? "over" : "on-target"} noun="norm" />}
            />
          )
        })
      )}
    </ImpactBlock>
  )
}

/** The area-weighted N, P₂O₅ and K₂O dose against the advice of the included fields, in kg/ha. */
export function AdviceImpact({
  detailHref,
  loading,
  error,
  summary,
  pending,
  issues,
  title = "Advies selectie",
  basis = "Selectie, oppervlaktegewogen per ha",
  single = false,
  controls,
  titleAddon,
}: {
  detailHref: string
  loading: boolean
  error?: string
  summary?: AdviceSummary
  pending: boolean
  issues: BulkFieldIssue[]
  title?: string
  basis?: string
  /** The block is about a single field, which changes the wording. */
  single?: boolean
  controls?: ReactNode
  titleAddon?: ReactNode
}) {
  return (
    <ImpactBlock
      title={title}
      basis={basis}
      controls={controls}
      titleAddon={titleAddon}
      detailHref={detailHref}
      detailLabel="Bemestingsadvies"
      pending={pending}
      footer={
        summary && !loading && !error ? (
          <CoverageFooter
            counted={summary.countedFields}
            total={summary.includedFields}
            issues={issues}
          />
        ) : null
      }
    >
      {loading ? (
        <BlockSkeleton rows={3} />
      ) : error ? (
        <BlockError message={error} />
      ) : !summary || summary.countedFields === 0 ? (
        <p className="text-muted-foreground text-sm text-balance">
          {single
            ? "Voor dit perceel is geen advies beschikbaar."
            : "Voor de geselecteerde percelen is geen advies beschikbaar."}
        </p>
      ) : (
        (["n", "p", "k"] as const).map((nutrient) => {
          const { label, unit, tooltip } = NUTRIENT_DESCRIPTIONS[nutrient]
          const advice = summary.advice[nutrient]
          const shown = summary.doseAfter?.[nutrient] ?? summary.dose[nutrient]
          const { status } = computeAdviceProgress(shown, advice)
          return (
            <MetricRow
              key={nutrient}
              label={label}
              tooltip={tooltip}
              unit={unit}
              current={summary.dose[nutrient]}
              after={summary.doseAfter?.[nutrient]}
              reference={advice}
              referenceLabel="advies"
              tone={adviceTone(shown, advice)}
              status={<ComparisonLabel status={status} noun="advies" />}
            />
          )
        })
      )}
    </ImpactBlock>
  )
}

/** The area-weighted nitrogen balance against the target of the included fields, in kg N/ha. */
export function BalanceImpact({
  detailHref,
  loading,
  error,
  summary,
  pending,
  issues,
  title = "Stikstofbalans selectie",
  basis = "Selectie zonder bufferstroken, in kg N/ha",
  single = false,
}: {
  detailHref: string
  loading: boolean
  error?: string
  summary?: BalanceSummary
  pending: boolean
  issues: BulkFieldIssue[]
  title?: string
  basis?: string
  /** The block is about a single field, which changes the wording. */
  single?: boolean
}) {
  const current = summary?.current
  const after = summary?.after
  const shown = after ?? current
  const isOver = shown ? shown.balance > shown.target : false

  return (
    <ImpactBlock
      title={title}
      basis={basis}
      detailHref={detailHref}
      detailLabel="Stikstofbalans"
      pending={pending}
      footer={
        summary && !loading && !error ? (
          <CoverageFooter
            counted={summary.countedFields}
            total={summary.includedFields}
            issues={issues}
          />
        ) : null
      }
    >
      {loading ? (
        <BlockSkeleton rows={2} />
      ) : error ? (
        <BlockError message={error} />
      ) : !current || !summary || summary.countedFields === 0 ? (
        <p className="text-muted-foreground text-sm text-balance">
          {single
            ? "Voor dit perceel is geen stikstofbalans beschikbaar."
            : "Voor de geselecteerde percelen is geen stikstofbalans beschikbaar."}
        </p>
      ) : (
        <>
          <MetricRow
            label="Balans"
            unit="kg N/ha"
            current={current.balance}
            after={after?.balance}
            reference={current.target}
            referenceLabel="streefwaarde"
            tone={isOver ? "over" : "ok"}
            status={<ComparisonLabel status={isOver ? "over" : "on-target"} noun="streefwaarde" />}
          />
          <dl
            aria-label="Aanvoer, afvoer en emissie"
            className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-2 text-xs tabular-nums"
          >
            {(
              [
                ["Aanvoer", current.supply.total, after?.supply.total],
                ["Afvoer", current.removal.total, after?.removal.total],
                ["Emissie ammoniak", current.emission.ammonia.total, after?.emission.ammonia.total],
                ["Emissie nitraat", current.emission.nitrate, after?.emission.nitrate],
              ] as const
            ).map(([label, value, valueAfter]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className="text-foreground">
                  {formatKg(value)}
                  {valueAfter !== undefined && formatKg(valueAfter) !== formatKg(value) && (
                    <span data-after className="font-semibold">
                      {" "}
                      → {formatKg(valueAfter)}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </ImpactBlock>
  )
}

/**
 * The verdict near the save button: for each norm the change adds to, how much room is left or by
 * how much it is exceeded, followed by neutral agronomic notes. It never blocks saving.
 *
 * For a single field (`perHectare`), the legal verdict of the whole farm is added, because the
 * farm total is what counts legally.
 *
 * @param props.outcomes - The outcomes on the same level as the norms block next to it.
 * @param props.farmOutcomes - For a single field, the outcomes of the whole farm.
 * @param props.notes - Agronomic notes, such as a nitrogen balance above its target.
 */
export function SaveVerdict({
  outcomes,
  perHectare = false,
  farmOutcomes,
  notes = [],
}: {
  outcomes: NormOutcome[]
  perHectare?: boolean
  farmOutcomes?: NormOutcome[]
  notes?: string[]
}) {
  if (outcomes.length === 0 && notes.length === 0 && !farmOutcomes?.length) return null
  const unit = (key: BulkNormKey) =>
    perHectare ? `${NORM_DESCRIPTIONS[key].unit}/ha` : NORM_DESCRIPTIONS[key].unit
  const farmExceeded = farmOutcomes?.filter((outcome) => outcome.remaining < 0) ?? []

  return (
    // Announced politely once the debounced preview changes, not on every keystroke
    <div className="space-y-3 text-sm" aria-live="polite">
      {outcomes.length > 0 && (
        <ul className="space-y-1">
          {outcomes.map((outcome) => {
            const label = NORM_DESCRIPTIONS[outcome.key].label
            return outcome.remaining < 0 ? (
              <li key={outcome.key} className="flex gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {label}:{" "}
                  <strong className="tabular-nums">
                    {formatKg(-outcome.remaining)} {unit(outcome.key)}
                  </strong>{" "}
                  boven de gebruiksruimte
                </span>
              </li>
            ) : (
              <li key={outcome.key} className="text-muted-foreground pl-6">
                {label}: nog{" "}
                <span className="text-foreground tabular-nums">
                  {formatKg(outcome.remaining)} {unit(outcome.key)}
                </span>{" "}
                ruimte
              </li>
            )
          })}
        </ul>
      )}
      {farmOutcomes && (
        <p className="text-muted-foreground border-t pt-2 text-xs">
          {farmExceeded.length > 0 ? (
            <span className="text-red-700 dark:text-red-400">
              Bedrijf:{" "}
              {farmExceeded
                .map(
                  (outcome) =>
                    `${NORM_DESCRIPTIONS[outcome.key].label.toLocaleLowerCase("nl-NL")} ${formatKg(-outcome.remaining)} ${NORM_DESCRIPTIONS[outcome.key].unit} boven de gebruiksruimte`,
                )
                .join("; ")}
              .
            </span>
          ) : (
            <span>Bedrijf: binnen de gebruiksruimte.</span>
          )}{" "}
          Wettelijk telt het bedrijfstotaal; de waarden per perceel zijn indicatief.
        </p>
      )}
      {notes.length > 0 && (
        <ul className="text-muted-foreground space-y-1 border-t pt-2">
          {notes.map((note) => (
            <li key={note} className="flex gap-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * The three impact blocks (norms, advice and nitrogen balance) in one card, fed by
 * {@link ImpactState}. The advice and balance blocks can be relabelled, for example for a single
 * field instead of a selection.
 *
 * Stacked in a narrow column, two per row in a medium column and three per row in a wide one.
 *
 * @param props.base - The base path of the farm and calendar, for the detail links.
 * @param props.normsField - Show the norms of this field (`b_id`), with a switch to the norms of
 *   the whole farm. Without it, the norms of the whole farm are shown.
 * @param props.normsScope - The scope of the norms, when the page keeps it (for example to match
 *   the verdict near the save button). Without it, the card keeps it itself.
 */
export function ImpactSummaryCard({
  state,
  base,
  advice,
  balance,
  normsField,
  normsScope,
  onNormsScopeChange,
}: {
  state: ImpactState
  base: string
  advice?: {
    title?: string
    basis?: string
    detailHref?: string
    controls?: ReactNode
    titleAddon?: ReactNode
    single?: boolean
  }
  balance?: { title?: string; basis?: string; detailHref?: string; single?: boolean }
  normsField?: string
  normsScope?: NormsScope
  onNormsScopeChange?: (scope: NormsScope) => void
}) {
  const { norms, normsAfter, farmNormsResult, adviceResult, balanceResult, preview } = state
  const [ownScope, setOwnScope] = useState<NormsScope>("field")
  const scope = normsScope ?? ownScope
  const setScope = onNormsScopeChange ?? setOwnScope
  const switchId = useId()
  const fieldNorms = normsField ? norms?.selectedFields?.[normsField] : undefined
  const showField = Boolean(normsField) && scope === "field"
  const fieldIssues = (normsAfter?.fieldIssues ?? norms?.fieldIssues ?? []).filter(
    (issue) => issue.b_id === normsField,
  )

  return (
    <Card>
      <CardContent className="@container/impact pt-6">
        <div className="grid gap-8 @3xl/impact:grid-cols-2 @5xl/impact:grid-cols-3">
          <FarmNormsImpact
            detailHref={showField ? `${base}/norms/${normsField}` : `${base}/norms`}
            loading={!farmNormsResult}
            error={farmNormsResult?.status === "error" ? farmNormsResult.message : undefined}
            available={(norms?.available ?? false) && (!showField || Boolean(fieldNorms))}
            showRenure={norms?.showRenure ?? false}
            farmNorms={showField ? fieldNorms?.norms : norms?.farmNorms}
            current={showField ? fieldNorms?.fillings : norms?.farmFillings}
            after={
              showField && normsField ? normsAfter?.fieldsAfter[normsField] : normsAfter?.after
            }
            pending={preview.impactPending}
            counted={
              showField
                ? fieldIssues.length > 0
                  ? 0
                  : 1
                : (norms?.fieldCount ?? 0) -
                  (norms?.fieldIssues.filter((i) => !i.isWarning).length ?? 0)
            }
            total={showField ? 1 : (norms?.fieldCount ?? 0)}
            issues={showField ? fieldIssues : (normsAfter?.fieldIssues ?? norms?.fieldIssues ?? [])}
            title={showField ? "Gebruiksruimte perceel" : undefined}
            basis={showField ? "Dit perceel, in kg per ha (indicatief)" : undefined}
            perHectare={showField}
            controls={
              normsField ? (
                <span className="flex items-center gap-2">
                  <Switch
                    id={switchId}
                    checked={scope === "farm"}
                    onCheckedChange={(checked) => setScope(checked ? "farm" : "field")}
                  />
                  <Label htmlFor={switchId} className="text-sm font-normal">
                    Hele bedrijf
                  </Label>
                </span>
              ) : undefined
            }
          />
          <AdviceImpact
            detailHref={advice?.detailHref ?? `${base}/nutrient_advice`}
            loading={!adviceResult}
            error={adviceResult?.status === "error" ? adviceResult.message : undefined}
            summary={state.adviceSummary}
            pending={preview.impactPending}
            issues={state.adviceIssues}
            title={advice?.title}
            basis={advice?.basis}
            controls={advice?.controls}
            titleAddon={advice?.titleAddon}
            single={advice?.single}
          />
          <div className="@3xl/impact:col-span-2 @5xl/impact:col-span-1">
            <BalanceImpact
              detailHref={balance?.detailHref ?? `${base}/balance/nitrogen`}
              loading={!balanceResult}
              error={balanceResult?.status === "error" ? balanceResult.message : undefined}
              summary={state.balanceSummary}
              pending={preview.balancePending}
              issues={state.balanceIssues}
              title={balance?.title}
              basis={balance?.basis}
              single={balance?.single}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
