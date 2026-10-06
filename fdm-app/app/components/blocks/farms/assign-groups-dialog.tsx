import { useState } from "react"
import { NavLink, useFetcher } from "react-router"
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
 * The changes are posted to the route action with the intent `assign_groups`.
 *
 * @param props.groups - The groups of the organization.
 * @param props.farms - The selected farms (no field rows).
 * @param props.organizationSlug - Slug used to link to the group management page.
 * @param props.onAssigned - Called after the changes were submitted.
 * @returns A React node.
 */
export function AssignGroupsDialog({
  groups,
  farms,
  organizationSlug,
  onAssigned,
}: {
  groups: GroupOption[]
  farms: FarmExtended[]
  organizationSlug: string
  onAssigned: () => void
}) {
  const fetcher = useFetcher()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<Record<string, GroupState>>({})

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
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
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Annuleren
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={groups.length === 0}>
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
