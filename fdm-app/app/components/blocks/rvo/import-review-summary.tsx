import { AlertCircle, ArrowLeftRight, Check, type LucideIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { clientConfig } from "~/lib/config"
import type { ChangeSummaryAgainstRvo, ImportChangeSummary, ImportIssue } from "./review-fields"

/** How many field names are listed per kind of change before the rest is summarized. */
const MAX_LISTED_NAMES = 8

function pluralizeFields(count: number) {
  return `${count} ${count === 1 ? "perceel" : "percelen"}`
}

/**
 * Lists the problems that block submitting an RVO import review, per field, so the user knows
 * which rows to correct.
 */
export function ImportIssuesAlert({ issues }: { issues: ImportIssue[] }) {
  if (issues.length === 0) return null

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Los deze problemen op voordat u opslaat</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {issues.map((issue) => (
            <li key={`${issue.itemId}-${issue.message}`}>
              <span className="font-medium">{issue.b_name}</span>: {issue.message}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

function ChangeGroup({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null
  const listed = names.slice(0, MAX_LISTED_NAMES)
  const remaining = names.length - listed.length

  return (
    <li>
      <span className="text-foreground font-medium">
        {pluralizeFields(names.length)} {label}
      </span>
      <span className="block">
        {listed.join(", ")}
        {remaining > 0 && ` en ${pluralizeFields(remaining)} meer`}
      </span>
    </li>
  )
}

/**
 * Shows the changes of an RVO import review grouped by kind, naming the fields involved. Removing
 * a field also removes everything recorded on it, which is stated explicitly.
 */
export function ImportChangeList({ summary }: { summary: ImportChangeSummary }) {
  return (
    <div className="space-y-4">
      <ul className="text-muted-foreground space-y-3 text-sm">
        <ChangeGroup label="toevoegen" names={summary.add} />
        <ChangeGroup label="bijwerken" names={summary.update} />
        <ChangeGroup label="afsluiten" names={summary.close} />
        <ChangeGroup label="verwijderen" names={summary.remove} />
      </ul>
      {summary.remove.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Verwijderen kan niet ongedaan worden gemaakt</AlertTitle>
          <AlertDescription>
            Bij het verwijderen van een perceel worden ook de teelten, oogsten, bemestingen,
            bodemanalyses en maatregelen van dat perceel verwijderd. Kies &quot;Behouden&quot; als u
            deze gegevens wilt bewaren.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

/** A count with its icon and label, as shown in the difference summary. */
export interface DifferenceCount {
  key: string
  count: number
  label: string
  icon?: LucideIcon
}

/** Names the state of the fields that one half of the summary compares with RVO. */
function SummaryHeading({ title }: { title: string }) {
  return (
    <p>
      <span className="font-medium">{title}</span>{" "}
      <span className="text-muted-foreground">vergeleken met RVO</span>
    </p>
  )
}

/**
 * States whether the fields will match RVO once the review is saved and, if not, which choices of
 * the user cause them to differ.
 */
function SavedResultSummary({
  changeSummaryAgainstRvo,
}: {
  changeSummaryAgainstRvo: ChangeSummaryAgainstRvo
}) {
  const choices = [
    { key: "ignore", count: changeSummaryAgainstRvo.ignore, label: "niet toegevoegd" },
    { key: "keep", count: changeSummaryAgainstRvo.keep, label: "behouden" },
    { key: "doNotClose", count: changeSummaryAgainstRvo.doNotClose, label: "niet afgesloten" },
    { key: "update", count: changeSummaryAgainstRvo.update, label: "met andere gegevens dan RVO" },
  ].filter((choice) => choice.count > 0)
  const total = choices.reduce((sum, choice) => sum + choice.count, 0)

  return (
    <div className="space-y-2 pt-3 md:pt-0 md:pl-6" aria-live="polite">
      <SummaryHeading title="Na opslaan" />
      {total === 0 ? (
        <>
          <p className="flex items-center gap-1.5">
            <Check className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            Alle percelen komen overeen met RVO.
          </p>
          <p className="text-muted-foreground">
            Standaard worden de gegevens van RVO overgenomen. Pas alleen aan wat niet klopt.
          </p>
        </>
      ) : (
        <>
          <p className="flex items-center gap-1.5">
            <ArrowLeftRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold tabular-nums">{total}</span>{" "}
              {total === 1 ? "perceel wijkt" : "percelen wijken"} af van RVO door uw keuzes:
            </span>
          </p>
          <p className="text-muted-foreground">
            {choices.map(({ key, count, label }, index) => (
              <span key={key}>
                {index > 0 && " · "}
                <span className="text-foreground tabular-nums">{count}</span> {label}
              </span>
            ))}
          </p>
        </>
      )}
    </div>
  )
}

/**
 * Summarizes how the fields in the app compare to RVO: before the user looks at the table, how
 * many fields there are per status and, for fields that differ, which columns differ; and, as the
 * user makes choices, whether the saved result will match RVO.
 */
export function ImportDifferenceSummary({
  statusCounts,
  columnCounts,
  changeSummaryAgainstRvo,
  matches,
}: {
  statusCounts: DifferenceCount[]
  columnCounts: DifferenceCount[]
  /** How the saved result will differ from RVO, given the choices of the user. */
  changeSummaryAgainstRvo: ChangeSummaryAgainstRvo
  /** Shows or hides the fields that match RVO, from their count in the summary. */
  matches?: { expanded: boolean; onToggle: () => void }
}) {
  const visibleStatuses = statusCounts.filter((status) => status.count > 0)
  if (visibleStatuses.length === 0) return null

  return (
    <section
      aria-label="Vergelijking met RVO"
      className="bg-card grid divide-y rounded-md border px-4 py-3 text-sm md:grid-cols-2 md:divide-x md:divide-y-0"
    >
      <div className="space-y-2 pb-3 md:pr-6 md:pb-0">
        <SummaryHeading title={`Nu in ${clientConfig.name}`} />
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {visibleStatuses.map(({ key, count, label, icon: Icon }) => (
            <li key={key} className="flex items-center gap-1.5">
              {Icon && <Icon className="text-muted-foreground size-4" aria-hidden="true" />}
              <span className="font-semibold tabular-nums">{count}</span>
              <span>{label}</span>
              {key === "MATCH" && matches && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-1 py-0"
                  aria-expanded={matches.expanded}
                  onClick={matches.onToggle}
                >
                  {matches.expanded ? "verbergen" : "tonen"}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {columnCounts.length > 0 && (
          <p className="text-muted-foreground">
            Verschillen per kolom:{" "}
            {columnCounts.map(({ key, count, label }, index) => (
              <span key={key}>
                {index > 0 && " · "}
                {label} <span className="text-foreground tabular-nums">{count}</span>
              </span>
            ))}
          </p>
        )}
      </div>
      <SavedResultSummary changeSummaryAgainstRvo={changeSummaryAgainstRvo} />
    </section>
  )
}

/** Counts all changes in the summary. */
export function countImportChanges(summary: ImportChangeSummary) {
  return summary.add.length + summary.update.length + summary.close.length + summary.remove.length
}
