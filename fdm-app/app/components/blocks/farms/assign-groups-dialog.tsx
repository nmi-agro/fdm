import { useState } from "react"
import { NavLink, useFetcher } from "react-router"
import { PeriodDateField } from "~/components/blocks/farm-groups/period-date-field"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { formatCalendarLabel, getPeriodError } from "~/lib/farm-groups"
import { cn } from "~/lib/utils"
import type { FarmExtended } from "./columns"

type GroupOption = { b_id_group: string; b_name_group: string }
type GroupState = boolean | "indeterminate"

/** Counts how many of the selected farms belong to a group in the selected calendar year. */
function countMembers(group: GroupOption, farms: FarmExtended[]): number {
  return farms.filter((farm) => farm.groups?.some((g) => g.b_id_group === group.b_id_group)).length
}

/**
 * Derives the checkbox state of a group: checked when all selected farms belong to it,
 * indeterminate when some do.
 */
function getInitialState(group: GroupOption, farms: FarmExtended[]): GroupState {
  const count = countMembers(group, farms)
  if (count === 0) return false
  return count === farms.length ? true : "indeterminate"
}

/**
 * Returns the next state when a checkbox is clicked. A group that started partly checked cycles
 * back to partly checked, so the user can undo the change.
 */
function getNextState(current: GroupState, initial: GroupState): GroupState {
  if (current === "indeterminate") return true
  if (current === true) return false
  return initial === "indeterminate" ? "indeterminate" : true
}

/** Formats a number of farms, for example `1 bedrijf` or `3 bedrijven`. */
function farmCount(count: number): string {
  return `${count} ${count === 1 ? "bedrijf" : "bedrijven"}`
}

/** Joins names into Dutch running text, for example `A, B en C`. */
function joinNames(names: string[]): string {
  return names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} en ${names[names.length - 1]}`
}

/**
 * Renders a button with a dialog to assign the selected farms to groups of the organization.
 *
 * A farm can be in multiple groups. Each group has a checkbox that starts in one of three
 * states, based on the selected calendar year: checked when all selected farms are part of the
 * group in that year, partly checked when some are, and unchecked when none are. Checking a
 * group adds the selected farms to it; unchecking it ends their membership. A group that started
 * partly checked can be clicked back to that state, which leaves it unchanged. Below every group
 * the dialog shows what will happen.
 *
 * Adding requires the date from which the farms are part of the group, and optionally the date
 * until which. Ending a membership uses the end date, or today when it is left empty. These are
 * the dates of the period itself, not the moment of the change. The changes are posted to the
 * route action with the intent `assign_groups`.
 *
 * @param props.groups - The groups of the organization.
 * @param props.farms - The selected farms (no field rows).
 * @param props.calendar - The selected calendar, a year such as `"2025"` or `"all"`.
 * @param props.defaultJoined - The default start date as `YYYY-MM-DD`: 1 January of the selected year.
 * @param props.groupsPath - Path of the group management page for the selected calendar year.
 * @param props.onAssigned - Called after the changes were submitted.
 * @returns A React node.
 */
export function AssignGroupsDialog({
  groups,
  farms,
  calendar,
  groupsPath,
  defaultJoined,
  onAssigned,
}: {
  groups: GroupOption[]
  farms: FarmExtended[]
  calendar: string
  groupsPath: string
  defaultJoined: string
  onAssigned: () => void
}) {
  const fetcher = useFetcher()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<Record<string, GroupState>>({})
  const [joined, setJoined] = useState(defaultJoined)
  const [leaved, setLeaved] = useState("")
  const calendarLabel = formatCalendarLabel(calendar)

  // The changes compared to the starting state of every group
  const adds: GroupOption[] = []
  const removes: GroupOption[] = []
  for (const group of groups) {
    const initial = getInitialState(group, farms)
    const next = state[group.b_id_group] ?? initial
    if (next === true && initial !== true) {
      adds.push(group)
    } else if (next === false && initial !== false) {
      removes.push(group)
    }
  }
  const hasChanges = adds.length > 0 || removes.length > 0
  const periodError = adds.length > 0 ? getPeriodError(joined, leaved) : undefined
  const missingJoined = adds.length > 0 && !joined
  const canSubmit = hasChanges && !missingJoined && !periodError

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setJoined(defaultJoined)
      setLeaved("")
      setState(
        Object.fromEntries(
          groups.map((group) => [group.b_id_group, getInitialState(group, farms)]),
        ),
      )
    }
    setOpen(nextOpen)
  }

  function handleSubmit() {
    if (!canSubmit) {
      return
    }
    const formData = new FormData()
    formData.set("intent", "assign_groups")
    if (adds.length > 0) {
      formData.set("b_group_joined", joined)
    }
    if (leaved) {
      formData.set("b_group_leaved", leaved)
    }
    for (const farm of farms) {
      formData.append("b_id_farm", farm.b_id_farm)
    }
    for (const group of adds) {
      formData.append("add_group", group.b_id_group)
    }
    for (const group of removes) {
      formData.append("remove_group", group.b_id_group)
    }
    void fetcher.submit(formData, { method: "post" })
    setOpen(false)
    onAssigned()
  }

  const summary = [
    adds.length > 0 &&
      `voeg je ${farms.length === 1 ? "het bedrijf" : `de ${farmCount(farms.length)}`} toe aan ${joinNames(adds.map((g) => g.b_name_group))}`,
    removes.length > 0 &&
      `beëindig je het lidmaatschap in ${joinNames(removes.map((g) => g.b_name_group))}`,
  ].filter(Boolean)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={farms.length === 0}>
          Groep toewijzen…
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Groep toewijzen</DialogTitle>
          <DialogDescription>
            {farms.length === 1
              ? "Kies de groepen voor het geselecteerde bedrijf."
              : `Kies de groepen voor de ${farms.length} geselecteerde bedrijven.`}{" "}
            Een bedrijf kan in meerdere groepen zitten.
          </DialogDescription>
        </DialogHeader>
        {groups.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Er zijn nog geen groepen.{" "}
            <NavLink to={groupsPath} className="underline">
              Maak eerst een groep aan.
            </NavLink>
          </p>
        ) : (
          <>
            <div className="text-muted-foreground space-y-1.5 text-sm">
              <p>
                Vink een groep aan om de bedrijven toe te voegen, vink hem uit om hun lidmaatschap
                te beëindigen.
              </p>
            </div>
            <ul className="max-h-60 space-y-3 overflow-y-auto rounded-md border p-3">
              {groups.map((group) => {
                const initial = getInitialState(group, farms)
                const current = state[group.b_id_group] ?? initial
                const members = countMembers(group, farms)
                const statusId = `group-${group.b_id_group}-status`
                let status: { text: string; className: string } | undefined
                if (current === true && initial !== true) {
                  status = {
                    text: `Wordt toegevoegd: ${farmCount(farms.length - members)}`,
                    className: "text-primary",
                  }
                } else if (current === false && initial !== false) {
                  status = {
                    text: `Lidmaatschap wordt beëindigd voor ${farmCount(members)}`,
                    className: "text-destructive",
                  }
                } else if (members > 0) {
                  status = {
                    text: `${members} van ${farmCount(farms.length)} in ${calendarLabel}`,
                    className: "text-muted-foreground",
                  }
                }
                return (
                  <li key={group.b_id_group} className="flex items-start gap-3">
                    <Checkbox
                      id={`group-${group.b_id_group}`}
                      className="mt-0.5"
                      checked={current}
                      aria-describedby={status ? statusId : undefined}
                      onCheckedChange={() =>
                        setState((previous) => ({
                          ...previous,
                          [group.b_id_group]: getNextState(
                            previous[group.b_id_group] ?? initial,
                            initial,
                          ),
                        }))
                      }
                    />
                    <div className="grow">
                      <label htmlFor={`group-${group.b_id_group}`} className="text-sm">
                        {group.b_name_group}
                      </label>
                      {status && (
                        <p id={statusId} className={cn("text-xs", status.className)}>
                          {status.text}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        {hasChanges && (
          <fieldset className="space-y-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">
              {adds.length > 0
                ? "Periode waarin de bedrijven deel uitmaken van de groep"
                : "Einde van het lidmaatschap"}
            </legend>
            <div className={cn("grid gap-3", adds.length > 0 && "sm:grid-cols-2")}>
              {adds.length > 0 && (
                <PeriodDateField label="Vanaf" value={joined} onChange={setJoined} required />
              )}
              <PeriodDateField
                label={
                  adds.length > 0
                    ? removes.length > 0
                      ? "Tot"
                      : "Tot (leeg = geen einddatum)"
                    : "Einddatum (leeg = vandaag)"
                }
                value={leaved}
                onChange={setLeaved}
              />
            </div>
            {adds.length > 0 && removes.length > 0 && (
              <p className="text-muted-foreground text-xs">
                De einddatum geldt voor de nieuwe periode én voor het beëindigen. Leeg betekent geen
                einddatum bij toevoegen en vandaag bij beëindigen.
              </p>
            )}
            {removes.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Heeft het lidmaatschap al een latere einddatum, dan wordt die vervroegd naar deze
                datum. Een lidmaatschap dat al eerder is afgelopen verandert niet; pas zo'n periode
                aan via{" "}
                <NavLink to={groupsPath} className="underline">
                  Groepen beheren
                </NavLink>
                .
              </p>
            )}
            {missingJoined && (
              <p role="alert" className="text-destructive text-sm">
                Vul de startdatum in.
              </p>
            )}
            {periodError && (
              <p role="alert" className="text-destructive text-sm">
                {periodError}
              </p>
            )}
          </fieldset>
        )}
        {groups.length > 0 && (
          <p className="text-sm" aria-live="polite">
            {hasChanges ? (
              `Hiermee ${summary.join(" en ")}.`
            ) : (
              <span className="text-muted-foreground">Wijzig eerst een of meer groepen.</span>
            )}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Annuleren
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
