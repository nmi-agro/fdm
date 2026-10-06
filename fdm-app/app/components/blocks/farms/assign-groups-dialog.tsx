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
import { getPeriodError } from "~/lib/farm-groups"
import type { FarmExtended } from "./columns"

type GroupOption = { b_id_group: string; b_name_group: string }
type GroupState = boolean | "indeterminate"

/**
 * Counts how many of the selected farms belong to a group and derives the checkbox state:
 * checked when all of them do, indeterminate when some do.
 */
function getInitialState(group: GroupOption, farms: FarmExtended[]): GroupState {
  const count = farms.filter((farm) =>
    farm.groups?.some((g) => g.b_id_group === group.b_id_group),
  ).length
  if (count === 0) return false
  return count === farms.length ? true : "indeterminate"
}

/**
 * Renders a button with a dialog to assign the selected farms to groups of the organization.
 *
 * A farm can be in multiple groups. A checked group adds all selected farms to it, an unchecked
 * group removes them. A group that is partly checked stays as it is until the user changes it.
 * The user also chooses the period in which the farms are part of the group: the date from
 * which (required) and until which (optional). These are the dates of the period itself, not
 * the moment the change is made. The changes are posted to the route action with the intent
 * `assign_groups`.
 *
 * @param props.groups - The groups of the organization.
 * @param props.farms - The selected farms (no field rows).
 * @param props.defaultJoined - The default start date as `YYYY-MM-DD`: 1 January of the selected year.
 * @param props.organizationSlug - Slug used to link to the group management page.
 * @param props.onAssigned - Called after the changes were submitted.
 * @returns A React node.
 */
export function AssignGroupsDialog({
  groups,
  farms,
  organizationSlug,
  defaultJoined,
  onAssigned,
}: {
  groups: GroupOption[]
  farms: FarmExtended[]
  organizationSlug: string
  defaultJoined: string
  onAssigned: () => void
}) {
  const fetcher = useFetcher()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<Record<string, GroupState>>({})
  const [joined, setJoined] = useState(defaultJoined)
  const [leaved, setLeaved] = useState("")
  const periodError = getPeriodError(joined, leaved)

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
    const formData = new FormData()
    formData.set("intent", "assign_groups")
    formData.set("b_group_joined", joined)
    if (leaved) {
      formData.set("b_group_leaved", leaved)
    }
    for (const farm of farms) {
      formData.append("b_id_farm", farm.b_id_farm)
    }
    for (const group of groups) {
      const initial = getInitialState(group, farms)
      const next = state[group.b_id_group] ?? initial
      if (next === true && initial !== true) {
        formData.append("add_group", group.b_id_group)
      } else if (next === false && initial !== false) {
        formData.append("remove_group", group.b_id_group)
      }
    }
    void fetcher.submit(formData, { method: "post" })
    setOpen(false)
    onAssigned()
  }

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
            <NavLink to={`/organization/${organizationSlug}/groups`} className="underline">
              Maak eerst een groep aan.
            </NavLink>
          </p>
        ) : (
          <ul className="max-h-60 space-y-3 overflow-y-auto">
            {groups.map((group) => (
              <li key={group.b_id_group} className="flex items-center gap-3">
                <Checkbox
                  id={`group-${group.b_id_group}`}
                  checked={state[group.b_id_group] ?? false}
                  onCheckedChange={() =>
                    setState((previous) => ({
                      ...previous,
                      // Both unchecked and indeterminate become checked; checked becomes unchecked
                      [group.b_id_group]: previous[group.b_id_group] !== true,
                    }))
                  }
                />
                <label htmlFor={`group-${group.b_id_group}`} className="grow text-sm">
                  {group.b_name_group}
                </label>
              </li>
            ))}
          </ul>
        )}
        {groups.length > 0 && (
          <fieldset className="space-y-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">
              Periode waarin de bedrijven deel uitmaken van de groep
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <PeriodDateField label="Vanaf" value={joined} onChange={setJoined} required />
              <PeriodDateField
                label="Tot (leeg = geen einddatum)"
                value={leaved}
                onChange={setLeaved}
              />
            </div>
            {periodError && (
              <p role="alert" className="text-destructive text-sm">
                {periodError}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              Dit zijn de datums van de periode zelf, niet het moment waarop u de wijziging invoert.
              Bij een groep die u uitvinkt, is dit de datum tot wanneer het bedrijf nog deel
              uitmaakt van de groep (leeg = vandaag).
            </p>
          </fieldset>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Annuleren
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={groups.length === 0 || !joined || Boolean(periodError)}
          >
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
